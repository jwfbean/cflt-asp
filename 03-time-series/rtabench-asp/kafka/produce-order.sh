python3 ./format-order.py < ../dataset/orders.csv | kcat -F ./client.properties -P -t orders -v 
