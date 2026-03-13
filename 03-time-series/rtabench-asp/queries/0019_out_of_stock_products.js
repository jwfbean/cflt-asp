const start = new Date();
try {
  const result = db.order_items.aggregate([
    // Group order_items first to reduce intermediate results
    {
      $group: {
        _id: "$product_id",
        total_ordered: { $sum: "$amount" },
        orders: { $push: "$order_id" }
      }
    },
    // Lookup product details (join with products)
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "product_id",
        as: "product"
      }
    },
    // Unwind the product details
    { $unwind: "$product" },
    // Filter early to exclude products with sufficient stock
    {
      $match: {
        $expr: { $lt: ["$total_ordered", "$product.stock"] }
      }
    },
    // Lookup related order events (join with order_events)
    {
      $lookup: {
        from: "order_events",
        let: { orders: "$orders" },
        pipeline: [
          { $match: { $expr: { $in: ["$order_id", "$$orders"] } } },
          { $match: { event_type: { $nin: ["Shipped"] } } }
        ],
        as: "events"
      }
    },
    // Filter only products with relevant events
    {
      $match: {
        "events.0": { $exists: true } // Ensure there are matching events
      }
    },
    // Project the required fields
    {
      $project: {
        product_id: "$_id",
        product_name: "$product.name",
        product_stock: "$product.stock",
        total_ordered: 1
      }
    }
  ], {maxTimeMS: 300000});
  print("Result:", result.toArray());
  const end = new Date();
  print("Time:", end - start, "ms");
} catch(error) {
  print("Time: -1 ms")
}
