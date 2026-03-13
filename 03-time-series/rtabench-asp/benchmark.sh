#!/bin/bash

CONNECTION_STRING="mongodb+srv://jwfbean-rtabench:9SXqxTnIsO4epnGg@jwfbean-rtabench.0rr9yb.mongodb.net/rtabench" 

# Download the dataset
wget --no-verbose --continue 'https://rtadatasets.timescale.com/customers.csv.gz'
wget --no-verbose --continue 'https://rtadatasets.timescale.com/products.csv.gz'
wget --no-verbose --continue 'https://rtadatasets.timescale.com/orders.csv.gz'
wget --no-verbose --continue 'https://rtadatasets.timescale.com/order_items.csv.gz'
wget --no-verbose --continue 'https://rtadatasets.timescale.com/order_events.csv.gz'
gzip -d customers.csv.gz products.csv.gz orders.csv.gz order_items.csv.gz order_events.csv.gz
sudo chmod og+rX ~
chmod 777 customers.csv products.csv orders.csv order_items.csv order_events.csv
mkdir -p dataset
mv *.csv dataset/

mongosh $CONNECTION_STRING --eval 'db.createCollection("order_events", { timeseries: { timeField: "event_created", metaField: "event_type", bucketRoundingSeconds: 86400, bucketMaxSpanSeconds: 86400 }});'

mongoimport --uri=$CONNECTION_STRING --db rtabench --collection customers --type csv --fields customer_id,name,birthday,email,address,city,zip,state,country 'dataset/customers.csv' #import
mongoimport --uri=$CONNECTION_STRING --db rtabench --collection products --type csv --fields product_id,name,description,category,price,stock 'dataset/products.csv' #import
mongoimport --uri=$CONNECTION_STRING --db rtabench --collection orders --type csv --fields order_id,customer_id,created_at 'dataset/orders.csv' #import
mongoimport --uri=$CONNECTION_STRING --db rtabench --collection order_items --type csv --fields order_id,product_id,amount 'dataset/order_items.csv' #import
mongoimport --uri=$CONNECTION_STRING --db rtabench --collection order_events --type csv --fields order_id.int32\(\),counter.int32\(\),event_created.date\("2006-01-02 15:04:05"\),event_type.string\(\),satisfaction.double\(\),processor.string\(\),backup_processor.string\(\),event_payload.string\(\) --columnsHaveTypes 'dataset/order_events.csv' #import

mongosh $CONNECTION_STRING --eval "db.customers.createIndex({ customer_id: 1 }, { unique: true })" #import
mongosh $CONNECTION_STRING --eval "db.products.createIndex({ product_id: 1 }, { unique: true })" #import
mongosh $CONNECTION_STRING --eval "db.orders.createIndex({ order_id: 1 }, { unique: true })" #import
mongosh $CONNECTION_STRING --eval "db.order_items.createIndex({ order_id: 1, product_id: 1 }, { unique: true });" #import
mongosh $CONNECTION_STRING --eval "db.order_events.createIndex({ order_id: 1 })" #import
mongosh $CONNECTION_STRING --eval "db.order_events.createIndex({ event_created: 1 })" #import
mongosh $CONNECTION_STRING --eval "db.order_events.createIndex({ order_id: 1, event_type: 1 })" #import

mongosh $CONNECTION_STRING --eval "db.stats().totalSize;" #datasize
	
./run.sh 2>&1 | tee log.txt

cat log.txt | grep -oP '^Time: (-?\d+) ms$|MongoNetworkError' | sed -r -e 's/MongoNetworkError.*$/-1/; s/Time: (-?[0-9]+) ms/\1/' |
  awk '{ if (i % 3 == 0) { printf "[" }; printf $1 / 1000; if (i % 3 != 2) { printf "," } else { print "]," }; ++i; }' #results

echo "General Purpose" #tag
echo "MongoDB" #name
