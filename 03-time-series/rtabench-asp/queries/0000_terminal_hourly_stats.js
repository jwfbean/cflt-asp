const start = new Date();
try {
	const result = db.order_events.aggregate([
		{
			$match: {
				event_created: {
					$gte: new ISODate("2024-01-01T00:00:00Z"),
					$lt: new ISODate("2024-02-01T00:00:00Z")
				},
				event_type: { $in: ["Created", "Departed", "Delivered"] }
			}
		},
		{
			$project: {
				hour: { $dateTrunc: { date: "$event_created", unit: "hour" } },
				terminal: "$event_payload.terminal",
				order_id: "$event_payload.order_id"
			}
		},
		{
			$group: {
				_id: { hour: "$hour", terminal: "$terminal" },
				event_count: { $sum: 1 },
				unique_orders: { $addToSet: "$order_id" }
			}
		},
		{
			$project: {
				_id: 0,
				hour: "$_id.hour",
				terminal: "$_id.terminal",
				event_count: 1,
				unique_orders: { $size: "$unique_orders" }
			}
		},
		{
			$match: {
				terminal: { $in: ["Berlin", "Hamburg", "Munich"] }
			}
		},
		{
			$setWindowFields: {
				partitionBy: "$terminal",
				sortBy: { hour: 1 },
				output: {
					moving_avg_events: {
						$avg: "$event_count",
						window: { documents: [-3, 0] } // 3 preceding and current row
					}
				}
			}
		},
		{
			$sort: { terminal: 1, hour: 1 }
		}
	], {maxTimeMS: 300000}).toArray();
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
