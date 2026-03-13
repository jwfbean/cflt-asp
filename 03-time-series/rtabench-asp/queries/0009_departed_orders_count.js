const start = new Date();
try {
  const result = db.order_events.countDocuments({
      event_created: {
          $gte: new Date("2024-01-01"),
          $lt: new Date("2024-02-01")
      },
      event_type: "Departed",
      order_id: 27
  }, {maxTimeMS: 300000});
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
