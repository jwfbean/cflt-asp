const start = new Date();
try {
	const result = db.customers.aggregate([
		{
			$lookup: {
				from: "orders",
				let: { customer_id: "$customer_id" },
				pipeline: [
					{
						$match: {
							$expr: { $eq: ["$customer_id", "$$customer_id"] },
							"created_at": { 
								$gte: new Date("2024-12-25"), 
								$lt: new Date("2025-01-01") 
							}
						}
					},
					// For each matching order, check if it has any "Delivered" events
					{
						$lookup: {
							from: "order_events",
							let: { order_id: "$order_id" },
							pipeline: [
								{
									$match: {
										$expr: { $eq: ["$order_id", "$$order_id"] },
										"event_type": "Delivered"
									}
								},
								// We only need to know if any records exist, so limit to 1
								{ $limit: 1 }
							],
							as: "delivery_events"
						}
					},
					// Only keep orders with no delivery events
					{
						$match: {
							"delivery_events": { $size: 0 }
						}
					},
					// We only need to know if any undelivered orders exist
					{ $limit: 1 }
				],
				as: "undelivered_holiday_orders"
			}
		},
		// Only include customers who have at least one undelivered holiday order
		{
			$match: {
				"undelivered_holiday_orders": { $not: { $size: 0 } }
			}
		},
		// Project only the needed fields
		{
			$project: {
				customer_id: 1,
				name: 1,
				_id: 0
			}
		}
  ], { maxTimeMS: 300000 });

  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch (error) {
  print("Time: -1 ms");
}
