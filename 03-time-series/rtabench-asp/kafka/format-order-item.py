import csv, sys, json, time; 
reader = csv.reader(sys.stdin); 
for row in reader:
    time.sleep(0.1);
    msg = {'order_id': int(row[0]), 'product_id': row[1], 'amount': row[2]};
    print(json.dumps(msg))
