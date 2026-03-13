const start = new Date();
try {
	const result = db.customers.aggregate([
		// Join with orders
		{
			$lookup: {
				from: "orders",
				localField: "customer_id",
				foreignField: "customer_id",
				as: "orders"
			}
		},
		
		// Filter orders by date range
		{
			$addFields: {
				orders: {
					$filter: {
						input: "$orders",
						as: "order",
						cond: {
							$and: [
								{ $gte: ["$$order.created_at", new Date("2024-01-01")] },
								{ $lt: ["$$order.created_at", new Date("2024-07-01")] }
							]
						}
					}
				}
			}
		},
		
		// Count filtered orders
		{
			$addFields: {
				order_count: { $size: "$orders" }
			}
		},
		
		// Filter out customers with no orders in period
		{
			$match: {
				order_count: { $gt: 0 }
			}
		},
		
		// Sort by order count (descending) and name
		{
			$sort: {
				order_count: -1,
				name: 1
			}
		},
		
		// Limit to top 10
		{
			$limit: 10
		},
		
		// Project final shape
		{
			$project: {
				_id: 0,
				customer_id: 1,
				name: 1,
				order_count: 1
			}
		}
  ], {maxTimeMS: 300000})
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
