const start = new Date();
try {
	const result = db.order_events.aggregate([
		// Filter order events by date range and type
		{
			$match: {
				"event_created": { 
					$gte: new Date("2024-01-01"), 
					$lt: new Date("2024-02-01") 
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
		
		// Join with customers table
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
		
		// Filter for Swiss customers only
		{
			$match: {
				"customer.country": "Switzerland"
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
		
		// Unwind the product array
		{
			$unwind: "$product"
		},
		
		// Calculate the amount * price for each item and keep country and category
		{
			$project: {
				country: "$customer.country",
				category: "$product.category",
				item_total: { $multiply: ["$items.amount", "$product.price"] }
			}
		},
		
		// Group by country and category to sum up the totals
		{
			$group: {
				_id: { 
					country: "$country",
					category: "$category" 
				},
				total_sales: { $sum: "$item_total" }
			}
		},
		
		// Sort by country and category
		{
			$sort: { 
				"_id.country": 1, 
				"_id.category": 1 
			}
		},
		
		// Final projection to match the SQL format
		{
			$project: {
				country: "$_id.country",
				category: "$_id.category",
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
