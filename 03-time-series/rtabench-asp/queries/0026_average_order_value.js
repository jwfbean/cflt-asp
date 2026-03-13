const start = new Date();
try {
  const result = db.orders.aggregate([
    // Match orders within date range
    {
      $match: {
        created_at: {
          $gte: '2024-01-01',
          $lt: '2024-01-07'
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
    
    // Calculate total value and count of orders
    {
      $group: {
        _id: null,
        totalValue: {
          $sum: {
            $multiply: ["$items.amount", "$product.price"]
          }
        },
        uniqueOrders: {
          $addToSet: "$order_id"
        }
      }
    },
    
    // Calculate the average
    {
      $project: {
        averageOrderValue: {
          $divide: [
            "$totalValue",
            { $size: "$uniqueOrders" }
          ]
        },
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
