const start = new Date();
try {
  const result = db.order_events.find(
      {
          event_created: { $lt: ISODate("2024-09-01") },
          order_id: 333
      }
  ).maxTimeMS(300000).sort({ event_created: -1 }).limit(1).toArray();
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
