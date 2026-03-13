const start = new Date();
try {
  const result = db.orders.aggregate([
    // Match orders within date range
    {
      $match: {
        created_at: {
          $gt: '2024-01-01',
          $lt: '2024-01-07'
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
    
    // Calculate item total and age
    {
      $addFields: {
        itemTotal: {
          $multiply: ["$items.amount", "$product.price"]
        },
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
    
    // Group all together with conditional sums
    {
      $group: {
        _id: null,
        "18-25": {
          $sum: {
            $cond: [
              { $and: [
                { $gte: ["$ageInYears", 18] },
                { $lt: ["$ageInYears", 26] }
              ]},
              "$itemTotal",
              0
            ]
          }
        },
        "26-35": {
          $sum: {
            $cond: [
              { $and: [
                { $gte: ["$ageInYears", 26] },
                { $lt: ["$ageInYears", 36] }
              ]},
              "$itemTotal",
              0
            ]
          }
        },
        "36-50": {
          $sum: {
            $cond: [
              { $and: [
                { $gte: ["$ageInYears", 36] },
                { $lt: ["$ageInYears", 51] }
              ]},
              "$itemTotal",
              0
            ]
          }
        },
        "51-65": {
          $sum: {
            $cond: [
              { $and: [
                { $gte: ["$ageInYears", 51] },
                { $lt: ["$ageInYears", 66] }
              ]},
              "$itemTotal",
              0
            ]
          }
        },
        "66+": {
          $sum: {
            $cond: [
              { $gte: ["$ageInYears", 66] },
              "$itemTotal",
              0
            ]
          }
        }
      }
    },
    
    // Remove _id from the output
    {
      $project: {
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
