const start = new Date();
try {
  const result = db.customers.aggregate([
    {
      $lookup: {
        from: "orders",
        localField: "customer_id",
        foreignField: "customer_id",
        as: "orders"
      }
    },
    {
      $unwind: "$orders"
    },
    {
      $lookup: {
        from: "order_items",
        localField: "orders.order_id", // Corrected field name
        foreignField: "order_id",
        as: "order_items"
      }
    },
      {
      $unwind: "$order_items"
    },
    {
      $lookup: {
        from: "products",
        localField: "order_items.product_id",
        foreignField: "product_id",
        as: "products"
      }
    },
      {
      $unwind: "$products"
    },
    {
      $match: {
        "orders.created_at": {
          $gte: new Date("2024-01-01"),
          $lt: new Date("2024-02-01")
        }
      }
    },
    {
      $group: {
        _id: "$customer_id",
        customer_name: { $first: "$name" },
        total_spent: { $sum: { $multiply: ["$order_items.amount", "$products.price"] } }
      }
    },
    { $sort: { total_spent: -1 } },
    { $limit: 10 }
  ], {maxTimeMS: 300000})
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch(error) {
  print("Time: -1 ms")
}
