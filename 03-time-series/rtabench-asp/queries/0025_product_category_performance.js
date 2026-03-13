const start = new Date();
try {
	const result = db.order_events.aggregate([
		// Filter order events by date range and type
		{
			$match: {
				"event_created": { 
					$gte: new Date("2024-01-01"), 
					$lt: new Date("2024-01-07") 
				},
				"event_type": "Delivered"
			}
		},
		
		// Join with orders table
		{
			$lookup: {
				from: "orders",
				localField: "order_id",
				foreignField: "order_id",
				as: "order"
			}
		},
		
		// Unwind the joined order array
		{
			$unwind: "$order"
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
		
		// Unwind the joined items array
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
		
		// Unwind the product array (should be one product per item)
		{
			$unwind: "$product"
		},
		
		// Calculate the amount * price for each item and keep category
		{
			$project: {
				category: "$product.category",
				item_total: { $multiply: ["$items.amount", "$product.price"] }
			}
		},
		
		// Group by category to sum up the totals
		{
			$group: {
				_id: "$category",
				total_sales: { $sum: "$item_total" }
			}
		},
		
		// Sort by category alphabetically
		{
			$sort: { _id: 1 }
		},
		
		// Final projection to match the SQL format
		{
			$project: {
				category: "$_id",
				total_sales: 1,
				_id: 0
			}
		}
  ], {maxTimeMS: 300000})
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch (error) {
  print("Time: -1 ms")
}
