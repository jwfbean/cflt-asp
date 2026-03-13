const start = new Date();
try {
  // We use aggregate because the criteria spans two collections (Join)
  const result = db.order_events.aggregate([
    {
      $match: {
        event_type: "Delivered"
      }
    },
    {
      $lookup: {
        from: "orders",
        localField: "order_id",
        foreignField: "order_id",
        as: "joined_order"
      }
    },
    {
      $match: {
        "joined_order.customer_id": 124
      }
    },
    {
      $limit: 1
    }
  ], { maxTimeMS: 300000 }).toArray().length > 0;

  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  // Maintaining the benchmark harness error pattern
  print("Time: -1 ms");
}
