python3 ./format-order-item.py < ../dataset/order_items.csv | kcat -F ./client.properties -P -t order-items -v 
