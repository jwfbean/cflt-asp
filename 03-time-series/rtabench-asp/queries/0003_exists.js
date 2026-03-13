const start = new Date();
try {
  const result = db.orders.aggregate([
      {
          $match: { customer_id: 124 }
      },
      {
          $lookup: {
              from: "order_events",
              localField: "order_id",
              foreignField: "order_id",
              as: "events"
          }
      },
      {
          $unwind: "$events"
      },
      {
          $match: {
              "events.event_type": "Delivered",
              "events.event_payload.terminal": "London",
              "events.event_created": {
                  $gte: new Date("2024-03-01"),
                  $lt: new Date("2024-04-01")
              }
          }
      },
      { $limit: 1 }
  ], {maxTimeMS: 300000}).toArray().length > 0;
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms");
}
