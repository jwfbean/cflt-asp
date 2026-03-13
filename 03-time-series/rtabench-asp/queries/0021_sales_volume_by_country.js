const start = new Date();
try {
	const result = db.orders.aggregate([
		// Filter orders by date range
		{
			$match: {
				"created_at": { 
					$gte: new Date("2024-01-01"), 
					$lt: new Date("2024-02-01") 
				}
			}
		},
		
		// Join with customers
		{
			$lookup: {
				from: "customers",
				localField: "customer_id",
				foreignField: "customer_id",
				as: "customer"
			}
		},
		
		// Unwind the customer array
		{
			$unwind: "$customer"
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
		
		// Unwind the order_items array
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
		
		// Calculate total for each item
		{
			$project: {
				country: "$customer.country",
				item_total: { $multiply: ["$items.amount", "$product.price"] }
			}
		},
		
		// Group by country to sum up the totals
		{
			$group: {
				_id: "$country",
				total_sales: { $sum: "$item_total" }
			}
		},
		
		// Sort by total_sales descending (matching ORDER BY 2 DESC in SQL)
		{
			$sort: { 
				total_sales: -1 
			}
		},
		
		// Final projection to match the SQL format
		{
			$project: {
				country: "$_id",
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
