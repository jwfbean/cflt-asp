/* Read Datagen data from Kafka topic */

mdb1={$source:{connectionName:'mongodb1', db: "cep", coll: "ticker-trades", timeField: "$fullDocument.kconnect_ts"}}
rr={$replaceRoot: {newRoot : "$fullDocument"}}
check_meta = { $addFields: { "stream_metadata": { $meta: "stream" } } }


/* Unique Ticker Count over 15 second Tumbling Window */

uniqueTickers = {
  $tumblingWindow: {
    interval: { size: NumberInt(15), unit: "second" },
    pipeline: [
      { $group: { _id: 1, symbols: { $addToSet: "$symbol" } } },
      { $project: { _id: 0, uniqueTickerCount: { $size: "$symbols" } } }
    ]
  }
}

/* Trades per ticker over 30 second Tumbling Window */

tradesPerTicker = {
  $tumblingWindow: {
    interval: { size: NumberInt(30), unit: "second" },
    pipeline: [
      { $group: { _id: "$symbol", count: { $sum: 1 } } },
      { $project: { _id: 0, symbol: "$_id", tradeCount: "$count" } }
    ]
  }
}

minMax = {
  $tumblingWindow: {
    interval: { size: NumberInt(30), unit: "second" },
    pipeline: [
      {
        $group: {
          _id: "$symbol",
          tradeCount: { $sum: 1 },
          minTrade: { $min: "$price" },
          maxTrade: { $max: "$price" }
        }
      },
      {
        $project: {
          _id: 0,
          symbol: "$_id",
          tradeCount: 1,
          minTrade: 1,
          maxTrade: 1,
          windowStart: "$window.start",
          windowEnd: "$window.end"
        }
      }
    ]
  }
};

// --- Merge-enabled pipeline (writes matches/output to `ticker-bounces`) ---
// This appends a deterministic _id (symbol + windowStart) to help dedupe
setId = {
  $addFields: {
    _id: { symbol: "$symbol", windowStart: "$windowStart" }
  }
};


// Choose which window stage to use in the pipeline (w, w1, w2, w3, etc.)
// Here we use w3 (min/max per ticker) and then write results to `ticker-bounces`.
pipeline = [ mdb1, rr, check_meta, w3, setId, mergeOut ];

// Run the pipeline with sp.process(pipeline)
// sp.process(pipeline);

// -----------------------------------------------------------------------------
// CEP example: detect runs of continuously decreasing price followed by an increase
// using a hopping window and write detected bounces to `ticker-bounces`.
// The CEP pipeline groups events per symbol within each hopping window, scans the
// ordered list for PRICE_DOWN+ then PRICE_UP, emits one document per match, and
// writes results to the same `ticker-bounces` collection using a bottomTime-based id.
patternHopping = {
  $hoppingWindow: {
    interval: { size: NumberInt(5), unit: "minute" },
    hopSize: { size: NumberInt(30), unit: "second" },
    pipeline: [
      { $sort: { kconnect_ts: 1 } },

      { $group: {
          _id: "$symbol",
          events: { $push: { price: "$price", t: "$kconnect_ts" } }
      } },

      { $project: {
          symbol: "$_id",
          matches: {
            $function: {
              body: function(events){
                var matches = [];
                if (!events || events.length < 2) return matches;
                var start = null;
                for (var i = 1; i < events.length; ++i){
                  var prev = events[i-1].price;
                  var cur  = events[i].price;
                  if (start === null){
                    if (cur < prev) start = i-1;
                  } else {
                    if (cur < prev){
                      // still decreasing
                    } else if (cur > prev){
                      matches.push({
                        symbol: events[start] && events[start].symbol || null,
                        startTime: events[start].t,
                        bottomTime: events[i-1].t,
                        endTime: events[i].t,
                        startPrice: events[start].price,
                        bottomPrice: events[i-1].price,
                        endPrice: events[i].price
                      });
                      start = null;
                    } else {
                      // equal price -> reset
                      start = null;
                    }
                  }
                }
                return matches;
              },
              args: ["$events"],
              lang: "js"
            }
          },
          windowStart: "$window.start",
          windowEnd: "$window.end"
      } },

      { $unwind: "$matches" },

      { $project: {
          _id: 0,
          symbol: 1,
          startTime: "$matches.startTime",
          bottomTime: "$matches.bottomTime",
          endTime: "$matches.endTime",
          startPrice: "$matches.startPrice",
          bottomPrice: "$matches.bottomPrice",
          endPrice: "$matches.endPrice",
          windowStart: 1,
          windowEnd: 1
      } }
    ]
  }
};

// For CEP results dedupe key: symbol + bottomTime gives a stable id per bounce
setIdCep = {
  $addFields: {
    _id: { symbol: "$symbol", bottomTime: "$bottomTime" }
  }
};

cepWrite = {
  $merge: {
    into: { connectionName: "mongodb1", db: "cep", coll: "ticker-bounces" },
    whenMatched: "replace",
    whenNotMatched: "insert"
  }
};

aggWrite1 = {
  $merge: {
    into: { connectionName: "mongodb1", db: "cep", coll: "unique-tickers" },
    whenMatched: "replace",
    whenNotMatched: "insert"
  }   
}

aggWrite2 = {
  $merge: {
    into: { connectionName: "mongodb1", db: "cep", coll: "trades-per-ticker" },
    whenMatched: "replace",
    whenNotMatched: "insert"
  }
}

aggWrite3 = {
  $merge: {
    into: { connectionName: "mongodb1", db: "cep", coll: "min-max-trades" },
    whenMatched: "replace",
    whenNotMatched: "insert"
  }
}


pipeline_uniqueTickers = [ mdb1, rr, check_meta, uniqueTickers, aggWrite1 ];
pipeline_tradesPerTicker = [ mdb1, rr, check_meta, tradesPerTicker, aggWrite2 ];
pipeline_minMaxTrades = [ mdb1, rr, check_meta, minMax, aggWrite3 ];
pipeline_cep = [ mdb1, rr, check_meta, patternHopping, setIdCep, cepWrite ];

sp.createStreamProcessor("CEP Demo - Unique Tickers", pipeline_uniqueTickers);
sp.createStreamProcessor("CEP Demo - Trades Per Ticker", pipeline_tradesPerTicker);
sp.createStreamProcessor("CEP Demo - MinMax Trades", pipeline_minMaxTrades);
sp.createStreamProcessor("CEP Demo - Ticker Bounces", pipeline_cep);

// To start processing, use the following commands:
sp.startStreamProcessor("CEP Demo - Unique Tickers");
sp.startStreamProcessor("CEP Demo - Trades Per Ticker");
sp.startStreamProcessor("CEP Demo - MinMax Trades");
sp.startStreamProcessor("CEP Demo - Ticker Bounces"); 

