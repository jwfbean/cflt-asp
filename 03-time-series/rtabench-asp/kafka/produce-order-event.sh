python3 ./format-order-event.py < ../dataset/order_events.csv | kcat -F ./client.properties -P -t order_event_stream -v 
