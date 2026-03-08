#
# DEMO 1: CONFLUENT CLOUD + MONGODB ATLAS & ATLAS STREAM PROCESSING WITH TERRAFORM
#
# This Terraform code sets up a Confluent Cloud Kafka cluster, a MongoDB Atlas cluster, and configures a Datagen source connector to generate stock trade
# data and a MongoDB Atlas sink connector to write that data into MongoDB Atlas. It also includes the necessary RBAC and network access configurations.
#
# We also run three stream processors in Atlas Stream Processing to do basic Complex Event Processing (CEP) on the data that the connector is writing to Atlas.
#
# Note: Remember to populate your terraform.tfvars file with the required credentials before running terraform -apply
#

terraform {
  required_providers {
    confluent = {
      source  = "confluentinc/confluent"
      version = "2.62.0"
    }
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "2.7.0"
    }
  }
}

# 1. PROVIDERS
provider "confluent" {
  cloud_api_key    = var.confluent_cloud_api_key
  cloud_api_secret = var.confluent_cloud_api_secret
}

provider "mongodbatlas" {
  public_key  = var.mongodbatlas_public_key
  private_key = var.mongodbatlas_private_key
}

# 2. CONFLUENT CLOUD INFRASTRUCTURE
resource "confluent_environment" "demo" {
  display_name = "MongoDB_ASP_Is_Kewl"
}

resource "confluent_kafka_cluster" "standard" {
  display_name = "stock_trades_cluster"
  availability = "SINGLE_ZONE"
  cloud        = "AWS"
  region       = "us-east-2"
  standard {}
  environment { id = confluent_environment.demo.id }
}

resource "confluent_kafka_topic" "trades" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  topic_name    = "stock-trades"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
  
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

resource "confluent_service_account" "connector_sa" {
  display_name = "connector-sa"
  description  = "Service Account for the Datagen and Sink connectors"
}

resource "confluent_api_key" "connector_kafka_key" {
  display_name = "connector-kafka-key"
  owner {
    id          = confluent_service_account.connector_sa.id
    api_version = confluent_service_account.connector_sa.api_version
    kind        = confluent_service_account.connector_sa.kind
  }

  managed_resource {
    id          = confluent_kafka_cluster.standard.id # Use your cluster resource name
    api_version = confluent_kafka_cluster.standard.api_version
    kind        = confluent_kafka_cluster.standard.kind

    environment {
      id = confluent_environment.demo.id # Use your environment resource name
    }
  }
}

resource "confluent_kafka_acl" "connector_source_write" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  resource_type = "TOPIC"
  resource_name = confluent_kafka_topic.trades.topic_name
  pattern_type  = "LITERAL"
  principal     = "User:${confluent_service_account.connector_sa.id}"
  operation     = "WRITE"
  permission    = "ALLOW"
  host          = "*"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

resource "confluent_kafka_acl" "connector_source_read" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  resource_type = "TOPIC"
  resource_name = confluent_kafka_topic.trades.topic_name
  pattern_type  = "LITERAL"
  principal     = "User:${confluent_service_account.connector_sa.id}"
  operation     = "READ"
  permission    = "ALLOW"
  host          = "*"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

resource "confluent_kafka_acl" "connector_consumer_group" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  resource_type = "GROUP"
  resource_name = "connect-MongoDbAtlasSinkConnector_0"
  pattern_type  = "LITERAL"
  principal     = "User:${confluent_service_account.connector_sa.id}"
  operation     = "READ"
  permission    = "ALLOW"
  host          = "*"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}


# 3. MONGODB ATLAS INFRASTRUCTURE

resource "mongodbatlas_advanced_cluster" "CEP" {
  project_id   = var.mongodbatlas_project_id
  name         = "trades-storage"
  cluster_type = "REPLICASET"

  replication_specs = [{
    region_configs = [{
      priority      = 7
      provider_name = "AWS"
      region_name   = "US_EAST_2" 
      electable_specs = {
        instance_size = "M10"
        node_count    = 3
      }
    }  ]
  } ]
}

resource "mongodbatlas_database_user" "db_user" {
  username           = var.mongodb_username
  password           = var.mongodb_password
  project_id         = var.mongodbatlas_project_id
  auth_database_name = "admin"
  roles {
    role_name     = "readWrite"
    database_name = "cep"
  }
}

# 4. THE AUTO-WHITELIST (No more manual entry!)
data "confluent_ip_addresses" "confluent_egress" {
  filter {
    clouds        = ["AWS"]
    regions       = ["us-east-2"]
    services      = ["CONNECT"] 
    address_types = ["EGRESS"]
  }
}

resource "mongodbatlas_project_ip_access_list" "confluent_whitelist" {
  for_each   = toset(data.confluent_ip_addresses.confluent_egress.ip_addresses[*].ip_prefix)
  project_id = var.mongodbatlas_project_id
  cidr_block = each.value # Use cidr_block for the prefix returned by the API
  comment    = "Managed by Terraform: Confluent Cloud Connector Egress IP"
}

locals {
  bootstrap_servers = replace(confluent_kafka_cluster.standard.bootstrap_endpoint, "SASL_SSL://", "")
}

# 5. SECURITY & CONNECTORS
resource "confluent_service_account" "app_manager" {
  display_name = "app-manager"
}

# Allow the Connector to manage its own Dead Letter Queue topics
resource "confluent_kafka_acl" "connector_dlq_create" {
  kafka_cluster {
    id = confluent_kafka_cluster.standard.id
  }
  resource_type = "TOPIC"
  resource_name = "dlq-lcc" # Confluent uses this prefix for connector DLQs
  pattern_type  = "PREFIXED"
  principal     = "User:${confluent_service_account.connector_sa.id}"
  host          = "*"
  operation     = "CREATE"
  permission    = "ALLOW"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

# You also need WRITE permission for that same prefix
resource "confluent_kafka_acl" "connector_dlq_write" {
  kafka_cluster {
    id = confluent_kafka_cluster.standard.id
  }
  resource_type = "TOPIC"
  resource_name = "dlq-lcc"
  pattern_type  = "PREFIXED"
  principal     = "User:${confluent_service_account.connector_sa.id}"
  host          = "*"
  operation     = "WRITE"
  permission    = "ALLOW"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

# Allow the connector to manage its Consumer Group
resource "confluent_kafka_acl" "connector_group_acl" {
  kafka_cluster {
    id = confluent_kafka_cluster.standard.id
  }
  resource_type = "GROUP"
  resource_name = "connect-lcc-" # Matches the prefix Confluent uses for connectors
  pattern_type  = "PREFIXED"
  principal     = "User:${confluent_service_account.connector_sa.id}"
  host          = "*"
  operation     = "ALL" # Grants READ, DESCRIBE, and DELETE as requested
  permission    = "ALLOW"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

# The "Describe" ACL - Allows Atlas to find the brokers
resource "confluent_kafka_acl" "atlas_cluster_describe" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  resource_type = "CLUSTER"
  resource_name = "kafka-cluster"
  pattern_type  = "LITERAL"
  principal     = "User:${confluent_service_account.connector_sa.id}"
  operation     = "DESCRIBE"
  permission    = "ALLOW"
  host          = "*"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
  
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

# The "Group" ACL - Allows Atlas to manage consumer offsets
resource "confluent_kafka_acl" "atlas_group_read" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  resource_type = "GROUP"
  resource_name = "*" 
  pattern_type  = "LITERAL"
  principal     = "User:${confluent_service_account.connector_sa.id}"
  operation     = "READ"
  permission    = "ALLOW"
  host          = "*"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint

  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}



resource "confluent_role_binding" "app_manager_rbac" {
  principal   = "User:${confluent_service_account.app_manager.id}"
  role_name   = "CloudClusterAdmin"
  crn_pattern = confluent_kafka_cluster.standard.rbac_crn
}

resource "confluent_api_key" "app_manager_key" {
  display_name = "app-manager-key"
  owner {
    id          = confluent_service_account.app_manager.id
    api_version = confluent_service_account.app_manager.api_version
    kind        = confluent_service_account.app_manager.kind
  }
  managed_resource {
    id          = confluent_kafka_cluster.standard.id
    api_version = confluent_kafka_cluster.standard.api_version
    kind        = confluent_kafka_cluster.standard.kind
    environment { id = confluent_environment.demo.id }
  }
}

resource "confluent_connector" "datagen" {
  environment { id = confluent_environment.demo.id }
  kafka_cluster { id = confluent_kafka_cluster.standard.id }

  config_sensitive = {
    "kafka.api.secret" = confluent_api_key.connector_kafka_key.secret
  }

  config_nonsensitive = {
    "kafka.api.key" = confluent_api_key.connector_kafka_key.id
    "connector.class"    = "DatagenSource"
    "name"               = "Datagen_Stock_Trades_V2"
    "kafka.topic"        = confluent_kafka_topic.trades.topic_name
    "output.data.format" = "JSON"
    "quickstart"         = "STOCK_TRADES"
    "tasks.max"          = "1"
    "transforms"         = "system_time",
    "transforms.system_time.type"  = "com.github.jcustenborder.kafka.connect.transform.common.TimestampNowField$Value"
    "transforms.system_time.fields" = "kconnect_ts"
  }
  depends_on = [
    confluent_kafka_acl.connector_source_write,
    confluent_role_binding.app_manager_rbac
  ]
}

 
# 1. THE ENGINE
resource "mongodbatlas_stream_workspace" "jwfbean_cep" {
  project_id    = var.mongodbatlas_project_id
  workspace_name = "jwfbean-cep-workspace" 

  # This must be a block (no equal sign)
  data_process_region = {
    cloud_provider = "AWS"
    region         = "VIRGINIA_USA" # Double check your provider's region string!
  }
}

resource "mongodbatlas_stream_connection" "kafka_connection" {
 project_id      = var.mongodbatlas_project_id
  workspace_name  = mongodbatlas_stream_workspace.jwfbean_cep.workspace_name
  connection_name = var.kafka_connection_name
  type            = "Kafka"
  bootstrap_servers = local.bootstrap_servers
  authentication = {
    mechanism = "PLAIN"
    username  =  confluent_api_key.connector_kafka_key.id
    password  = confluent_api_key.connector_kafka_key.secret
  }

  security = {
    protocol = "SASL_SSL"
  }
  config = {
    "auto.offset.reset" = "latest"
  }
}

resource "mongodbatlas_stream_connection" "atlas_connection" {
 project_id      = var.mongodbatlas_project_id
  workspace_name  = mongodbatlas_stream_workspace.jwfbean_cep.workspace_name
  connection_name = var.source_connection_name
  type            = "Cluster"
  cluster_name    = "trades-storage"

  # This is the winner from your doc search
  db_role_to_execute = {
    role = "readWriteAnyDatabase"
    type = "BUILT_IN"
  }
}

resource "mongodbatlas_stream_processor" "unique_tickers" {
  project_id     = var.mongodbatlas_project_id
  processor_name = "UniqueTickers"
  workspace_name = "jwfbean-cep-workspace"

  pipeline = templatefile("${path.module}/pipelines/unique_tickers_json.tftpl", {
    # Using the name directly from the connection resource
    source_connection_name   = mongodbatlas_stream_connection.kafka_connection.connection_name
    sink_connection_name   = mongodbatlas_stream_connection.atlas_connection.connection_name
    db_name           = var.stream_db_name
    kafka_topic        = confluent_kafka_topic.trades.topic_name
    output_collection = "unique-tickers"
  })

  state = "STARTED"
}


resource "mongodbatlas_stream_processor" "ticker_minmax" {
  project_id     = var.mongodbatlas_project_id
  processor_name = "TickerMinMax"
  workspace_name = "jwfbean-cep-workspace"

  pipeline = templatefile("${path.module}/pipelines/min_max_trades_json.tftpl", {
    # Using the name directly from the connection resource
    source_connection_name   = mongodbatlas_stream_connection.kafka_connection.connection_name
    sink_connection_name   = mongodbatlas_stream_connection.atlas_connection.connection_name
    db_name           = var.stream_db_name
    kafka_topic        = confluent_kafka_topic.trades.topic_name
    output_collection = "ticker-minmax"
  })

  state = "STARTED"
}

resource "mongodbatlas_stream_processor" "ticker_cep" {
  project_id     = var.mongodbatlas_project_id
  processor_name = "TickerCEP"
  workspace_name = "jwfbean-cep-workspace"

  pipeline = templatefile("${path.module}/pipelines/ticker_bounces_json.tftpl", {
    # Using the name directly from the connection resource
    source_connection_name   = mongodbatlas_stream_connection.kafka_connection.connection_name
    sink_connection_name   = mongodbatlas_stream_connection.atlas_connection.connection_name
    db_name           = var.stream_db_name
    kafka_topic        = confluent_kafka_topic.trades.topic_name
    output_collection = "ticker-bounces"
  })

  state = "STARTED"
}

resource "mongodbatlas_stream_processor" "trades_per" {
  project_id     = var.mongodbatlas_project_id
  processor_name = "TradesPerTicker"
  workspace_name = "jwfbean-cep-workspace"

  pipeline = templatefile("${path.module}/pipelines/trades_per_ticker_json.tftpl", {
    # Using the name directly from the connection resource
    source_connection_name   = mongodbatlas_stream_connection.kafka_connection.connection_name
    sink_connection_name   = mongodbatlas_stream_connection.atlas_connection.connection_name
    db_name           = var.stream_db_name
    kafka_topic        = confluent_kafka_topic.trades.topic_name
    output_collection = "ticker-trades_per"
  })

  state = "STARTED"
}