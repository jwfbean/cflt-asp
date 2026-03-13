const start = new Date();
try {
	const result = db.order_events.aggregate([
		// Filter for order_id 700
		{
			$match: {
				order_id: 700
			}
		},
		
		// Project and truncate date to day
		{
			$project: {
				day: {
					$dateTrunc: {
						date: "$event_created",
						unit: "day"
					}
				},
				satisfaction: 1
			}
		},
		
		// Group by day and find maximum satisfaction
		{
			$group: {
				_id: "$day",
				max_satisfaction: { $max: "$satisfaction" }
			}
		},
		
		// Reshape for final output
		{
			$project: {
				_id: 0,
				day: "$_id",
				max_satisfaction: 1
			}
		},
		
		// Sort by day in descending order
		{
			$sort: {
				day: -1
			}
		}
  ], {maxTimeMS: 300000}).toArray();
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
