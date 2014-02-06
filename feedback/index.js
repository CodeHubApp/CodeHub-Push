var   apn    = require('apn')
    , async  = require('async')
    , db     = require('../lib/db')
    , config = require('../config');

var feedback = new apn.feedback({ address: config.push.feedbackGateway, interval: config.push.feedbackInterval, batchFeedback: true });

feedback.on('feedbackError', console.error);

feedback.on('feedback', function(feedbackData) {
    var time, device;
    var tasks = [];
    for(var i in feedbackData) {
        time = feedbackData[i].time;
        device = feedbackData[i].device;

        tasks.push(function(callback) {
            console.log('device ' + device + ' has been unresponsive since ' + time);
            db.removeExpiredRegistration(device, function(err) {
                if (err) console.err(err);
                callback(null);
            })

        });
    }

    async.parallelLimit(tasks, 3);
});

console.log('Started listening for APN feedback: ' + new Date().toString());