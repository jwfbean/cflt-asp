const start = new Date();
try {
  const result = db.order_events.aggregate([
      {
          $match: {
              event_created: {
                  $gte: new Date("2024-01-29"),
                  $lt: new Date("2024-02-05")
              },
              "event_payload.status": { $all: ["Delayed"] }
          }
      },
      {
          $group: {
              _id: "$order_id",
              count: { $sum: 1 }
          }
      },
      { $sort: { count: -1 } },
      { $limit: 1 }
  ], {maxTimeMS: 300000}).toArray();

  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
