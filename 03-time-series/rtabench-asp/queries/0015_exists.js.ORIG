const start = new Date();
try {
  const result = db.orders.find({
    customer_id: 124,
    event_type: "Delivered"
  }).maxTimeMS(300000).count() > 0
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
