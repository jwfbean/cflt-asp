const start = new Date();
try {
  const result = db.order_events.find(
      {
          event_created: {
              $gte: new Date("2024-03-01"),
              $lt: new Date("2024-08-01")
          },
          processor: { $regex: "ron" }
      }
  ).maxTimeMS(300000).sort({ event_created: 1 }).limit(10);
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
