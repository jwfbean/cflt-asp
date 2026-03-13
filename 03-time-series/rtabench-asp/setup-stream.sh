#!/bin/bash

CONNECTION_STRING=$CONNECTION_STRING

# Download the dataset

#wget --no-verbose --continue 'https://rtadatasets.timescale.com/customers.csv.gz'
#wget --no-verbose --continue 'https://rtadatasets.timescale.com/products.csv.gz'
#wget --no-verbose --continue 'https://rtadatasets.timescale.com/orders.csv.gz'
#wget --no-verbose --continue 'https://rtadatasets.timescale.com/order_items.csv.gz'
#wget --no-verbose --continue 'https://rtadatasets.timescale.com/order_events.csv.gz'
#gzip -d customers.csv.gz products.csv.gz orders.csv.gz order_items.csv.gz order_events.csv.gz
# sudo chmod og+rX ~
chmod 777 customers.csv products.csv orders.csv order_items.csv order_events.csv
mkdir -p dataset
mv *.csv dataset/

mongoimport --uri=$CONNECTION_STRING --db rtabench --collection customers --type csv --fields customer_id,name,birthday,email,address,city,zip,state,country 'dataset/customers.csv' #import
mongoimport --uri=$CONNECTION_STRING --db rtabench --collection products --type csv --fields product_id,name,description,category,price,stock 'dataset/products.csv' #import
# TODO work on streaming these
mongoimport --uri=$CONNECTION_STRING --db rtabench --collection orders --type csv --fields order_id,customer_id,created_at 'dataset/orders.csv' --numInsertionWorkers 4 #import
mongoimport --uri=$CONNECTION_STRING --db rtabench --collection order_items --type csv --fields order_id,product_id,amount 'dataset/order_items.csv' --numInsertionWorkers 4 #import

mongosh $CONNECTION_STRING --eval "db.customers.createIndex({ customer_id: 1 }, { unique: true })" #import
mongosh $CONNECTION_STRING --eval "db.products.createIndex({ product_id: 1 }, { unique: true })" #import
mongosh $CONNECTION_STRING --eval "db.orders.createIndex({ order_id: 1 }, { unique: true })" #import
mongosh $CONNECTION_STRING --eval "db.order_items.createIndex({ order_id: 1, product_id: 1 }, { unique: true });" #import
