const start = new Date();
try {
  const result = db.order_events.aggregate([
      {
          $match: {
              event_created: {
                  $gte: new Date("2024-04-01"),
                  $lt: new Date("2024-05-01")
              },
              event_type: "Departed",
              "event_payload.terminal": "Berlin"
          }
      },
      {
          $group: {
              _id: {
                  day: { $dateTrunc: { date: "$event_created", unit: "day" } },
                  order_id: "$order_id"
              },
              count: { $sum: 1 }
          }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
  ], {maxTimeMS: 300000}).toArray();
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
