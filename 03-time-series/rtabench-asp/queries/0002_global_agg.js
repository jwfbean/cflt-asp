const start = new Date();
try {
  const result = db.order_events.aggregate([
      {
          $match: {
              event_created: {
                  $gte: new Date("2024-04-20"),
                  $lt: new Date("2024-05-20")
              }
          }
      },
      { $group: { _id: null, maxCounter: { $max: "$counter" } } }
  ], {maxTimeMS: 300000}).toArray();

  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
