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
  display_name = "time-series-stream"
  availability = "SINGLE_ZONE"
  cloud        = "AWS"
  region       = "us-east-2"
  standard {}
  environment { id = confluent_environment.demo.id }
}

resource "confluent_service_account" "client_sa" {
  display_name = "client-sa"
  description  = "Service Account for the clients"
}

resource "confluent_api_key" "client_kafka_key" {
  display_name = "client-kafka-key"
  owner {
    id          = confluent_service_account.client_sa.id
    api_version = confluent_service_account.client_sa.api_version
    kind        = confluent_service_account.client_sa.kind
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

resource "confluent_kafka_topic" "orders" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  topic_name    = "orders"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
    
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

resource "confluent_kafka_topic" "order-items" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  topic_name    = "order-items"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
    
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

resource "confluent_kafka_topic" "order-events" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  topic_name    = "order-events"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
    
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

resource "confluent_kafka_acl" "client_source_write_all" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  resource_type = "TOPIC"
  resource_name = "*"           
  pattern_type  = "LITERAL"     
  principal     = "User:${confluent_service_account.client_sa.id}"
  operation     = "ALL"         
  permission    = "ALLOW"
  host          = "*"
  rest_endpoint = confluent_kafka_cluster.standard.rest_endpoint
  credentials {
    key    = confluent_api_key.app_manager_key.id
    secret = confluent_api_key.app_manager_key.secret
  }
}

resource "confluent_kafka_acl" "client_consumer_group" {
  kafka_cluster { id = confluent_kafka_cluster.standard.id }
  resource_type = "GROUP"
  resource_name = "connect-MongoDbAtlasSinkConnector_0"
  pattern_type  = "LITERAL"
  principal     = "User:${confluent_service_account.client_sa.id}"
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

resource "mongodbatlas_advanced_cluster" "time-series-cluster" {
  project_id   = var.mongodbatlas_project_id
  name         = "time-series-cluster"
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
    role_name     = "readWriteAnyDatabase"
    database_name = "admin"
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
  atlas_sink_uri = replace(
    mongodbatlas_advanced_cluster.time-series-cluster.connection_strings.standard_srv,
    "mongodb+srv://",
    "mongodb+srv://${mongodbatlas_database_user.db_user.username}:${mongodbatlas_database_user.db_user.password}@"
  )
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
  principal     = "User:${confluent_service_account.client_sa.id}"
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
  principal     = "User:${confluent_service_account.client_sa.id}"
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
  principal     = "User:${confluent_service_account.client_sa.id}"
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
  principal     = "User:${confluent_service_account.client_sa.id}"
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
  principal     = "User:${confluent_service_account.client_sa.id}"
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

resource "mongodbatlas_stream_workspace" "jwfbean_time-series" {
  project_id    = var.mongodbatlas_project_id
  workspace_name = "jwfbean-time-series-workspace" 

  # This must be a block (no equal sign)
  data_process_region = {
    cloud_provider = "AWS"
    region         = "VIRGINIA_USA" # Double check your provider's region string!
  }
}

resource "mongodbatlas_stream_connection" "kafka_connection" {
 project_id      = var.mongodbatlas_project_id
  workspace_name  = mongodbatlas_stream_workspace.jwfbean_time-series.workspace_name
  connection_name = var.kafka_connection_name
  type            = "Kafka"
  bootstrap_servers = local.bootstrap_servers
  authentication = {
    mechanism = "PLAIN"
    username  =  confluent_api_key.client_kafka_key.id
    password  = confluent_api_key.client_kafka_key.secret
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
  workspace_name  = mongodbatlas_stream_workspace.jwfbean_time-series.workspace_name
  connection_name = var.source_connection_name
  type            = "Cluster"
  cluster_name    = "time-series-cluster"

  # This is the winner from your doc search
  db_role_to_execute = {
    role = "readWriteAnyDatabase"
    type = "BUILT_IN"
  }
}

output "confluent_bootstrap" {
  value = local.bootstrap_servers
}

output "confluent_key" {
  value = confluent_api_key.client_kafka_key.id
}

output "confluent_secret" {
  value     = confluent_api_key.client_kafka_key.secret
  sensitive = true
}

output "mongodb_uri" {
  value     = local.atlas_sink_uri
  sensitive = true
}

output "mongodb_atlas_connection_string" {
  value       = local.atlas_sink_uri
  description = "Connection string for the Atlas Cluster (used for rtabench seeding)"
  sensitive   = true
}

output "atlas_stream_workspace_name" {
  value       = mongodbatlas_stream_workspace.jwfbean_time-series.workspace_name
  description = "The workspace where you will create your Stream Processor"
}

output "asp_kafka_connection_name" {
  value       = mongodbatlas_stream_connection.kafka_connection.connection_name
  description = "The 'Source' name to use in your ASP pipeline ($source)"
}

output "asp_atlas_connection_name" {
  value       = mongodbatlas_stream_connection.atlas_connection.connection_name
  description = "The 'Merge' name to use in your ASP pipeline ($merge)"
}

