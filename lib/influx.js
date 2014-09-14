var influx = require('influx');

// Influx time series logging
var flux = influx({
  host : 'localhost',
  username : process.env['INFLUX_USER'],
  password : process.env['INFLUX_PASS'],
  database : 'codehub-push',
  requestTimeout : 1000 * 30
});

var fluxBatches = {};

var transmitInfluxBatches = function() {
    if (Object.keys(fluxBatches).length === 0) {
        setTimeout(transmitInfluxBatches, 1000);
    }

    flux.writeSeries(fluxBatches, function(err) {
        if (err) console.error('Unable to transmit flux batch');
        setTimeout(transmitInfluxBatches, 1000);
    });

    fluxBatches = {};
}

setTimeout(transmitInfluxBatches, 1000);

exports.sendInflux = function(series, data) {
    fluxBatches[series] = fluxBatches[series] || []
    data['time'] = new Date();
    fluxBatches[series].push(data);
}
