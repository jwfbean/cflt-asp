const start = new Date();
try {
	const result = db.order_events.aggregate([
		// Filter events by date range and event type
		{
			$match: {
				"event_created": { 
					$gte: new Date("2024-01-01"), 
					$lt: new Date("2024-07-01") 
				},
				"event_type": "Delivered"
			}
		},
		
		// Group by order_id to avoid counting multiple "Delivered" events per order
		{
			$group: {
				_id: "$order_id"
			}
		},
		
		// Join with orders to get customer_id
		{
			$lookup: {
				from: "orders",
				localField: "_id",
				foreignField: "order_id",
				as: "order"
			}
		},
		
		// Unwind the order array
		{
			$unwind: "$order"
		},
		
		// Join with customers
		{
			$lookup: {
				from: "customers",
				localField: "order.customer_id",
				foreignField: "customer_id",
				as: "customer"
			}
		},
		
		// Unwind the customer array
		{
			$unwind: "$customer"
		},
		
		// Group by customer to count orders
		{
			$group: {
				_id: "$customer.customer_id",
				name: { $first: "$customer.name" },
				order_count: { $sum: 1 }
			}
		},
		
		// Sort by order count descending
		{
			$sort: { 
				order_count: -1 
			}
		},
		
		// Limit to top 10
		{
			$limit: 10
		},
		
		// Final projection to match the SQL format
		{
			$project: {
				customer_id: "$_id",
				name: 1,
				order_count: 1,
				_id: 0
			}
		}
  ], {maxTimeMS: 300000});
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch (error) {
  print("Time: -1 ms")
}
