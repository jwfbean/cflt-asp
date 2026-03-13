const start = new Date();
try {
	const result = db.order_events.aggregate([
		// Filter order events by date range
		{
			$match: {
				"event_created": { 
					$gte: new Date("2024-05-01"), 
					$lt: new Date("2024-06-01") 
				},
				// Match documents where status array contains both "Delayed" and "Priority"
				"event_payload.status": { 
					$all: ["Delayed", "Priority"] 
				}
			}
		},
		
		// Project to extract just the date portion (truncate to day)
		{
			$project: {
				day: {
					$dateToString: {
						format: "%Y-%m-%d",
						date: "$event_created"
					}
				}
			}
		},
		
		// Group by day and count occurrences
		{
			$group: {
				_id: "$day",
				count: { $sum: 1 }
			}
		},
		
		// Sort by count in descending order
		{
			$sort: { 
				count: -1 
			}
		},
		
		// Limit to top 20
		{
			$limit: 20
		},
		
		// Final projection to match the SQL format
		{
			$project: {
				day: "$_id",
				count: 1,
				_id: 0
			}
		}
  ], {maxTimeMS: 300000});
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
