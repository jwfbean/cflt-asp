const start = new Date();
try {
  const result = db.order_events.aggregate([
    {
      $match: {
        event_type: "Delivered",
        event_created: { $gte: new Date("2024-03-01"), $lt: new Date("2024-08-01") }
      }
    },
    {
      $group: {
        _id: null,
        total_count: { $sum: "$counter" }
      }
    }
  ], {maxTimeMS: 300000})
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
