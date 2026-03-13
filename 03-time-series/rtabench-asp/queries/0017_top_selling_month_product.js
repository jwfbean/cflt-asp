const start = new Date();
try {
	const result = db.order_events.aggregate([
		// Filter for delivered events in January 2024
		{
			$match: {
				event_type: "Delivered",
				event_created: {
					$gte: new Date("2024-01-01"),
					$lt: new Date("2024-02-01")
				}
			}
		},
		
		// Join with order_items
		{
			$lookup: {
				from: "order_items",
				localField: "order_id",
				foreignField: "order_id",
				as: "items"
			}
		},
		
		// Unwind the items
		{
			$unwind: "$items"
		},
		
		// Join with products
		{
			$lookup: {
				from: "products",
				localField: "items.product_id",
				foreignField: "product_id",
				as: "product"
			}
		},
		
		// Unwind the product
		{
			$unwind: "$product"
		},
		
		// Group by product
		{
			$group: {
				_id: {
					product_id: "$product.product_id",
					name: "$product.name"
				},
				total_amount: { $sum: "$items.amount" }
			}
		},
		
		// Sort by total amount ascending and name descending
		{
			$sort: {
				total_amount: 1,
				"_id.name": -1
			}
		},
		
		// Limit to 10 results
		{
			$limit: 10
		},
		
		// Final projection
		{
			$project: {
				_id: 0,
				product_id: "$_id.product_id",
				name: "$_id.name",
				total_amount: 1
			}
		}
  ], {maxTimeMS: 300000});
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
