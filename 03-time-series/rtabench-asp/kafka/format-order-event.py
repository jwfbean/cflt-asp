import csv, sys, json, time; 
reader = csv.reader(sys.stdin); 
for row in reader:
    time.sleep(0.1);
    msg = {'order_id': int(row[0]), 'event_type': row[3], 'event_created': row[2], 'satisfaction': row[4], 'processor': row[5], 'backup_processor': row[6], 'event_payload': row[7]};
    print(json.dumps(msg))
