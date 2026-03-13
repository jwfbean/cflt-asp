const start = new Date();
try {
  const result = db.order_events.find(
      {
          event_created: {
              $gte: new Date("2024-01-01T00:00:00Z"),
              $lt: new Date("2024-01-01T23:55:00Z")
          },
          order_id: 512
      }
  ).maxTimeMS(300000).sort({ event_created: 1 }).toArray();
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
