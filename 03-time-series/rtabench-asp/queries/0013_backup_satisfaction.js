const start = new Date();
try {
  const result = db.order_events.aggregate([
    {
      $match: { order_id: 111 }
    },
    {
      $group: {
        _id: { month: { $month: "$event_created" } },
        count_with_backup: {
          $sum: {
            $cond: [{ $ne: ["$backup_processor", ""] }, 1, 0]
          }
        },
        count_without_backup: {
          $sum: {
            $cond: [{ $eq: ["$backup_processor", null] }, 1, 0]
          }
        },
        avg_satisfaction_with_backup: {
          $avg: {
            $cond: [{ $ne: ["$backup_processor", ""] }, "$satisfaction", 0]
          }
        },
        avg_satisfaction_without_backup: {
          $avg: {
            $cond: [{ $eq: ["$backup_processor", null] }, "$satisfaction", 0]
          }
        }
      }
    },
    { $sort: { _id: -1 } }
  ], {maxTimeMS: 300000})
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
