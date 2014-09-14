var influx = require('influx');

// Influx time series logging
var flux = influx({
  host : 'localhost',
  username : process.env['INFLUX_USER'],
  password : process.env['INFLUX_PASS'],
  database : 'codehub-push',
  requestTimeout : 1000 * 30
});

// The batches container
var fluxBatches = {};

// Process the batch every 2s
var batchTime = 2000;

var transmitInfluxBatches = function() {
    if (Object.keys(fluxBatches).length === 0) {
        return setTimeout(transmitInfluxBatches, batchTime);
    }

    flux.writeSeries(fluxBatches, function(err) {
        if (err) console.error('Unable to transmit flux batch: %s', err);
        setTimeout(transmitInfluxBatches, batchTime);
    });

    fluxBatches = {};
}

setTimeout(transmitInfluxBatches, batchTime);

exports.send = function(series, data) {
    fluxBatches[series] = fluxBatches[series] || []
    data = data || {}
    data['time'] = new Date();
    fluxBatches[series].push(data);
}
