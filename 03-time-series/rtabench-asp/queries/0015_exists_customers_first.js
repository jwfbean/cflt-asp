const start = new Date();
try {
  const result = db.orders.aggregate([
    {
      $match: {
        customer_id: 124 // Reduce 'orders' collection first
      }
    },
    {
      // Join into the 180M event collection
      $lookup: {
        from: "order_events",
        localField: "order_id",
        foreignField: "order_id",
        as: "events"
      }
    },
    {
      // Filter the joined array for the specific event
      $match: {
        "events.event_type": "Delivered"
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
  print("Time: -1 ms");
}
