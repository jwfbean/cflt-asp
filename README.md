# The First Thing I did with MongoDB Atlas Stream processing


## 🏗️ Project Structure

The repository is split into two phases of architectural maturity:

* **`01-terraform-atlas-sink/`**: The "Connector" pattern. Uses the Confluent Cloud Managed Atlas Sink Connector to move raw data from Kafka into a MongoDB collection.
* **`02-terraform-asp/`**: The "Direct" pattern. Leverages **Atlas Stream Processing (ASP)** to connect directly to Kafka as a consumer, performing Complex Event Processing (CEP) and windowed aggregations in-flight.

---


## 🚀 Deployment Guide

### Prerequisites
* Terraform CLI
* Confluent Cloud Cluster & API Keys
* MongoDB Atlas Project & API Keys

### Setup Instructions
1. **Initialize Environment**: Ensure your `terraform.tfvars` contains your specific organization and project IDs.
2. **Deploy Phase 1**: Navigate to `/01` to establish the baseline ingestion.
3. **Deploy Phase 2**: Navigate to `/02`. Note that this will establish a direct connection from the Atlas Stream Instance to the Confluent Brokers.

---
