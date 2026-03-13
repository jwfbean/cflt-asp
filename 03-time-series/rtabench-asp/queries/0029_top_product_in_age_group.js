const start = new Date();
try {
  const result = db.orders.aggregate([
    // Match orders within date range
    {
      $match: {
        created_at: {
          $gt: '2024-12-24',
          $lt: '2025-01-01'
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
    
    // Calculate customer age and filter for 18-25 year olds
    {
      $addFields: {
        ageInYears: {
          $floor: {
            $divide: [
              { $subtract: [new Date(), "$customer.birthday"] },
              (365.25 * 24 * 60 * 60 * 1000) // Convert milliseconds to years
            ]
          }
        }
      }
    },
    
    {
      $match: {
        ageInYears: {
          $gte: 18,
          $lt: 26
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
    
    // Unwind the items array
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
    
    // Group by product
    {
      $group: {
        _id: "$product.product_id",
        productName: { $first: "$product.name" },
        totalSales: {
          $sum: {
            $multiply: ["$items.amount", "$product.price"]
          }
        }
      }
    },
    
    // Sort by total sales descending
    {
      $sort: {
        totalSales: -1
      }
    },
    
    // Limit to top 10
    {
      $limit: 10
    },
    
    // Project final shape
    {
      $project: {
        product_id: "$_id",
        name: "$productName",
        total_sales: "$totalSales",
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
