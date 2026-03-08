######################################
# Confluent Cloud Variables
######################################

variable "confluent_cloud_api_key" {
  description = "Confluent Cloud API Key (Global/Organization level)"
  type        = string
  sensitive   = true
}

variable "confluent_cloud_api_secret" {
  description = "Confluent Cloud API Secret"
  type        = string
  sensitive   = true
}

variable "sg_package" {
  description = "Stream Governance package (e.g., ESSENTIAL or ADVANCED)"
  type        = string
  default     = "ESSENTIAL"
}

######################################
# MongoDB Atlas Variables
######################################

variable "mongodbatlas_project_id" {
  type    = string
}

variable "mongodbatlas_public_key" {
  description = "The public API key for MongoDB Atlas"
  type        = string
}

variable "mongodbatlas_private_key" {
  description = "The private API key for MongoDB Atlas"
  type        = string
  sensitive   = true
}

variable "mongodbatlas_org_id" {
  description = "The MongoDB Atlas Organization ID"
  type        = string
}

variable "mongodb_username" {
  description = "Username for the trades_processor database user"
  type        = string
}

variable "mongodb_password" {
  description = "Password for the trades_processor database user"
  type        = string
  sensitive   = true
}

#
# Atlas Stream Processiong variables
#

variable "stream_db_name" {
  type        = string
  description = "The MongoDB database name for the stream"
  default     = "cep"
}

variable "source_connection_name" {
  type        = string
  description = "The name of the Atlas stream connection"
  default     = "mongodb1"
}

variable "input_collection" {
  type        = string
  default     = "ticker-trades"
}

