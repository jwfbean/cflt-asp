const start = new Date();
try {
  const result = db.order_events.aggregate([
  {
    $match: { // First, filter on customer_id using the orders collection
      order_id: {
        $in: db.orders.distinct("order_id", { order_id: 2344 })
      }
    }
  },
  {
    $sort: {  // Use the index for sorting
      order_id: 1,
      event_created: -1
    }
  },
  {
    $group: {
      _id: "$order_id",
      event_created: { $first: "$event_created" },
      event_type: { $first: "$event_type" }
    }
  },
  {
    $project: {
      _id: 0,
      order_id: "$_id",
      event_created: 1,
      event_type: 1
    }
  }], {maxTimeMS: 300000}).toArray();
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch (error) {
  print("Time: -1 ms")
}
