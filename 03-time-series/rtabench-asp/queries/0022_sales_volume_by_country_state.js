const start = new Date();
try {
	// MongoDB doesn't have a direct equivalent to GROUPING SETS, so we'll need to run 
	// multiple aggregations and combine the results
	// First aggregation: Group by country and state
	const countryStateAgg = db.orders.aggregate([
		// Filter orders by date range (Christmas to New Year's)
		{
			$match: {
				"created_at": { 
					$gte: new Date("2024-12-24"), 
					$lt: new Date("2025-01-01") 
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
				state: "$customer.state",
				item_total: { $multiply: ["$items.amount", "$product.price"] }
			}
		},
		
		// Group by country and state
		{
			$group: {
				_id: { 
					country: "$country", 
					state: "$state" 
				},
				total_sales: { $sum: "$item_total" }
			}
		},
		
		// Add a type field to indicate this is country+state grouping
		{
			$addFields: {
				grouping_type: "country_state"
			}
		}
	], {maxTimeMS: 300000}).toArray();

	// Second aggregation: Group by country only
	const countryAgg = db.orders.aggregate([
		// Filter orders by date range
		{
			$match: {
				"created_at": { 
					$gte: new Date("2024-12-24"), 
					$lt: new Date("2025-01-01") 
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
		
		// Group by country
		{
			$group: {
				_id: { country: "$country" },
				total_sales: { $sum: "$item_total" }
			}
		},
		
		// Add a type field to indicate this is country grouping
		{
			$addFields: {
				grouping_type: "country",
				_id: { country: "$_id.country", state: null }
			}
		}
	], {maxTimeMS: 300000}).toArray();

	// Third aggregation: Grand total
	const grandTotalAgg = db.orders.aggregate([
		// Filter orders by date range
		{
			$match: {
				"created_at": { 
					$gte: new Date("2024-12-24"), 
					$lt: new Date("2025-01-01") 
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
				item_total: { $multiply: ["$items.amount", "$product.price"] }
			}
		},
		
		// Calculate grand total
		{
			$group: {
				_id: null,
				total_sales: { $sum: "$item_total" }
			}
		},
		
		// Add a type field and format to match other results
		{
			$addFields: {
				grouping_type: "grand_total",
				_id: { country: null, state: null }
			}
		}
	], {maxTimeMS: 300000}).toArray();

	// Combine all results
	const combinedResults = [...countryStateAgg, ...countryAgg, ...grandTotalAgg];

	// Sort the combined results
	combinedResults.sort((a, b) => {
		// First by total_sales
		if (a.total_sales !== b.total_sales) {
			return a.total_sales - b.total_sales;
		}
		
		// Then by country (nulls last)
		if (a._id.country !== b._id.country) {
			if (a._id.country === null) return 1;
			if (b._id.country === null) return -1;
			return a._id.country.localeCompare(b._id.country);
		}
		
		// Then by state (nulls last)
		if (a._id.state !== b._id.state) {
			if (a._id.state === null) return 1;
			if (b._id.state === null) return -1;
			return a._id.state.localeCompare(b._id.state);
		}
		
		return 0;
	});

	// Format the final results for display
	const result = combinedResults.map(result => {
		return {
			country: result._id.country,
			state: result._id.state,
			total_sales: result.total_sales,
			grouping_type: result.grouping_type
		};
	});
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch (error) {
  print("Time: -1 ms")
}
