
cflt2 = { $source: { connectionName: 'cc-kafka', topic: 'order_events_stream', "partitionIdleTimeout": { "size": 1, "unit": "second" } } }
orders = {$source:{connectionName:'atlas-rtabench', db: "rtabench", coll: "orders"}}


fixDate = {
  $set: {
    event_created: { $dateFromString: { dateString: "$event_created" } }
  }
};

// Stage 2: Hop to Orders to get the Customer ID
enrich1 =  {
    $lookup: {
      from: { connectionName: 'atlas-rtabench', db: "rtabench", coll: "orders" },
      localField: "order_id",
      foreignField: "order_id",
      as: "order_details"
    }
  }
unwindOrders = { $unwind: "$order_details" };

enrichCustomer = {
  $lookup: {
    from: { connectionName: 'atlas-rtabench', db: "rtabench", coll: "customers" },
    localField: "order_details.customer_id",
    foreignField: "customer_id",
    as: "customer_details"
  }
};

unwindCustomers = { $unwind: "$customer_details" };

enrichItems = {
  $lookup: {
    from: { connectionName: 'atlas-rtabench', db: 'rtabench', coll: 'order_items' },
    localField: 'order_id',
    foreignField: 'order_id',
    as: 'items'
  }
};

enrichProductNames = {
  $lookup: {
    from: { connectionName: 'atlas-rtabench', db: 'rtabench', coll: 'products' },
    localField: 'items.product_id',
    foreignField: 'product_id',
    as: 'product_details'
  }
};

finalClean = {
  $project: {
    _id: 0,
    event_created: 1,
    order_id: 1,
    event_type: 1,
    customer: '$customer_details.name',
    // This creates a clean list of just the product names
    items_ordered: '$product_details.name'
  }
};


/*This one matches RTABench setup for MongoDB and is intellectually dishonest: event_type is not the proper metafield for Timeseries analysis of order events per order over time. However, it does match the existing RTABench TimescaleDB setup for comparison purposes.
writeTimeSeries = {$emit: { connectionName: "atlas-rtabench", db: "rtabench", coll: "order_events_stream", timeseries: { timeField: "event_created", metaField: "event_type", bucketRoundingSeconds: 86400, bucketMaxSpanSeconds: 86400 }}}
*/ 
// This is the 'Honest' mapping for Timeseries analysis of order events per order over time.
writeTimeSeries = {
  $emit: { 
    connectionName: "atlas-rtabench", 
    db: "rtabench", 
    coll: "order_event_stream", 
    timeseries: { 
      timeField: "event_created", 
      metaField: "order_id", // This is the 'Honest' mapping
      bucketRoundingSeconds: 259200, // 3 days to match Timescale
      bucketMaxSpanSeconds: 259200 
    }
  }
}

pipeline_tsEnrich = [cflt2, fixDate, enrich1, unwindOrders, enrichCustomer, unwindCustomers, enrichItems, enrichProductNames, finalClean, writeTimeSeries]

sp.createStreamProcessor("RTABench Order Events Enrichment", pipeline_tsEnrich);
