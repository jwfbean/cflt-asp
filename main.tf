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
  display_name = "Trading_Data_Env"
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
resource "mongodbatlas_project" "trading_project" {
  name   = "Stock_Trading_Project"
  org_id = var.mongodbatlas_org_id
}

resource "mongodbatlas_advanced_cluster" "CEP" {
  project_id   = mongodbatlas_project.trading_project.id
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
  project_id         = mongodbatlas_project.trading_project.id
  auth_database_name = "admin"
  roles {
    role_name     = "readWrite"
    database_name = "trading_data"
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
  project_id = mongodbatlas_project.trading_project.id
  cidr_block = each.value # Use cidr_block for the prefix returned by the API
  comment    = "Managed by Terraform: Confluent Cloud Connector Egress IP"
}

locals {
  # This grabs the SRV string (e.g., mongodb+srv://cluster0.abc.mongodb.net)
  # and inserts "user:pass@" right after "mongodb+srv://"
  atlas_sink_uri = replace(
    mongodbatlas_advanced_cluster.CEP.connection_strings[0].standard_srv,
    "mongodb+srv://",
    "mongodb+srv://${mongodbatlas_database_user.db_user.username}:${mongodbatlas_database_user.db_user.password}@"
  )
}

# 5. SECURITY & CONNECTORS
resource "confluent_service_account" "app_manager" {
  display_name = "app-manager"
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

 resource "confluent_connector" "mongodb_atlas_sink" {
  environment { id = confluent_environment.demo.id }
  kafka_cluster { id = confluent_kafka_cluster.standard.id }

  # Sensitive stuff (Passwords/Secrets)
  config_sensitive = {
    "kafka.api.secret" = confluent_api_key.connector_kafka_key.secret
    "connection.password" = mongodbatlas_database_user.db_user.password
  }

  # The rest of your JSON config
  config_nonsensitive = {
    "kafka.api.key" = confluent_api_key.connector_kafka_key.id
    "connector.class"     = "MongoDbAtlasSink"
    "name"                = "MongoDbAtlasSinkConnector_0"
    "kafka.auth.mode"     = "KAFKA_API_KEY"
    
    # DYNAMIC INJECTION FROM ATLAS
    "connection.host"     = trimprefix(mongodbatlas_advanced_cluster.CEP.connection_strings[0].standard_srv, "mongodb+srv://")
    "connection.user"     = mongodbatlas_database_user.db_user.username
    
    # LOGIC FROM YOUR JSON
    "topics"              = "stock-trades"
    "database"            = "cep"
    "collection"          = "ticker-trades"
    "input.data.format"   = "JSON"
    "input.key.format"    = "STRING"
    "mongodb.instance.type" = "MONGODB_ATLAS"
    "mongodb.auth.mechanism" = "SCRAM-SHA-256"
    
    # BEHAVIOR SETTINGS
    "tasks.max"           = "1"
    "doc.id.strategy"     = "BsonOidStrategy"
    "errors.tolerance"    = "all"
    "auto.restart.on.user.error" = "true"
    "value.converter.schemas.enable" = "false"
  }

depends_on = [
    mongodbatlas_advanced_cluster.CEP,
    mongodbatlas_database_user.db_user,
    confluent_role_binding.app_manager_rbac,
    confluent_kafka_topic.trades,
    mongodbatlas_project_ip_access_list.confluent_whitelist, 
    confluent_kafka_acl.connector_source_read,     
    confluent_kafka_acl.connector_consumer_group   
  ]
}
