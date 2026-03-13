const start = new Date();
try {
  const result = db.orders.aggregate([
    // First match orders within date range
    {
      $match: {
        created_at: {
          $gt: '2024-12-01',
          $lt: '2024-12-07'
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
    
    // Group by customer and calculate total
    {
      $group: {
        _id: "$customer.customer_id",
        customerName: { $first: "$customer.name" },
        total: {
          $sum: { 
            $multiply: ["$items.amount", "$product.price"]
          }
        }
      }
    },
    
    // Sort by total descending
    {
      $sort: {
        total: -1
      }
    },
    
    // Limit to top 10
    {
      $limit: 10
    },
    
    // Project final shape
    {
      $project: {
        customer_id: "$_id",
        name: "$customerName",
        total: 1,
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
