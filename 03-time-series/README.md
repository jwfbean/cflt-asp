# (IN PROGRESS) rtabench: Confluent Cloud & MongoDB Atlas Stream Processing

This project attempts to show how Apache Kafka (in **Confluent Cloud**) and MongoDB Atlas Stream Processing can be used to
convert real-time analytics data models and queries (provided by the RTABench project courtesy of Tiger Data) to streaming
queries.


## Architecture

* **Confluent Cloud**: Provides the Kafka infrastructure for the `rtabench` data streams.
* **MongoDB Atlas**: An `M10+` cluster configured to handle the high-throughput ingest of the benchmark data.
* **Atlas Stream Processing**: A managed processing layer that bridges Kafka and Atlas, providing real-time ingestion and transformation.
* **Automated Networking**: Terraform dynamically manages Confluent Egress IP whitelisting within the MongoDB Atlas Project Access List.

---
In the existing setup, setup-stream.sh populates everything except for order-events. This is a lot of data so it takes a while. 
Then, the javascript file `create-order-events.sh` contains an ASP pipeline for reading order-events from a Kafka topic and enriching
against ASP via `$lookup` into a time series colleciton which can serve as an "everything table" to best handle aggregate or analytic queries.

* TODO: Stream orders and order-items, enrich against customers and items into order-details collection using $merge.
* TODO: stream order-events, enrich against order-details using $merge.
* TODO: Model an RTABench query into a stream.

---

## Deployment Steps

### 1. Provision Infrastructure
Initialize and apply the Terraform configuration. This will create your Kafka clusters, service accounts, ACLs, and the MongoDB Atlas environment.

```bash
terraform init
terraform apply
```

Get the secrets:
```bash
terraform output -json
```
Copy `mongodb_atlas_connection_string` and put it the `CONNECTION_STRING` environment variable

`export CONNECTION_STRING=mongodb_atlas_connection_string`

### 2. Pre-load RTA Bench base data

In `rtabench-mongodb`, run `setup-stream.sh`. This populates MongoDB Atlas with the background data for RTABench. We've commented out the population of order, order_events and order_items because we convert them to streams in this example.

### 3. Start the order and order_items streams
`terraform output -json` will give you the API key and secret. Copy and paste from there into client.properties

Run `produce-order.sh` to send a stream to Confluent Cloud with order data.
Run `produce-order-item.sh` to send a stream to Conflunet Cloud with order item data.

