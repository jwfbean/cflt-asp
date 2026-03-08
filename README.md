# MongoDB Atlas + Confluent Cloud: Stock Trade Processing

This project demonstrates two evolutionary patterns for processing real-time Kafka data from Confluent Cloud into MongoDB Atlas using Terraform.

## 🏗️ Project Structure

The repository is split into two phases of architectural maturity:

* **`01-terraform-atlas-sink/`**: The "Connector" pattern. Uses the Confluent Cloud Managed Atlas Sink Connector to move raw data from Kafka into a MongoDB collection.
* **`02-terraform-asp/`**: The "Direct" pattern. Leverages **Atlas Stream Processing (ASP)** to connect directly to Kafka as a consumer, performing Complex Event Processing (CEP) and windowed aggregations in-flight.

---

## ⚡ Architecture Comparison

| Feature | 01 Atlas Sink | 02 Atlas Stream Processing |
| :--- | :--- | :--- |
| **Logic Location** | Passive (Database Sink) | Active (In-flight Pipeline) |
| **Complexity** | Simple "Pipe" | Stateful Aggregations (CEP) |
| **ACL Requirements** | Standard Topic Write | Cluster `DESCRIBE` + Group `READ` |
| **Handshake** | Managed by Confluent | Direct SASL_SSL Handshake |

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

## 💡 Key Learnings & Troubleshooting

### 1. The "Locksmith" vs. "Guest" ACL Pattern
When using ASP, the Service Account used by the connection needs more than just topic access. It requires:
* **Cluster `DESCRIBE`**: To allow Atlas to map the partitions.
* **Group `READ`**: To allow Atlas to manage its own offsets.
* **Topic `READ`**: To pull the actual trade data.

### 2. Watermarks and Windowing
Stateful processors (CEP and Ticker counts) rely on the passage of time. If data isn't flowing to all partitions, use a `partitionIdleTimeout` (e.g., `1s`) to ensure the watermark advances and windows close.

### 3. Explicit Time Fields
Unlike the Sink Connector, ASP needs to know which field to use for event
