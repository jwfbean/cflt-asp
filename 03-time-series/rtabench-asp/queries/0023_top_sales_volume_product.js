const start = new Date();
try {
  const result = db.products.aggregate([
    {
      $lookup: {
        from: "order_items",
        localField: "product_id",
        foreignField: "product_id",
        as: "order_items"
      }
    },
      {$unwind: "$order_items"},
    {
      $group: {
        _id: "$product_id",
        product_name: { $first: "$name" },
        total_value: { $sum: { $multiply: ["$order_items.amount", "$price"] } }
      }
    },
    {
      $match: {
        "order_items.event_type": "Delivered"
      }
    },
    { $sort: { total_value: -1 } },
    { $limit: 10 }
  ], {maxTimeMS: 60000})
  print("Result:", result);
  const end = new Date();
  print("Time:", (end - start), "ms");
} catch (error) {
  print("Time: -1 ms")
}
