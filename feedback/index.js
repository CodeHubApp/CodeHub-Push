var   apn    = require('apn')
    , async  = require('async')
    , db     = require('../lib/db')
    , _      = require('underscore')
    , config = require('../config');

var feedback = new apn.feedback({ address: config.push.feedbackGateway, interval: config.push.feedbackInterval, batchFeedback: true });

feedback.on('feedbackError', console.error);

feedback.on('feedback', function(feedbackData) {
    var tasks = _.map(feedbackData, function(i) {
        return function(callback) {
            console.log('device %s has been unresponsive since %s', i.device, i.time);
            db.removeExpiredRegistration(i.device, function(err) {
                if (err) console.err(err);
                callback(null);
            })
        };
    });

    console.log('Feedback service reports %s unresponsive devices', feedbackData.length);
    async.parallelLimit(tasks, 3);
});

console.log('Started listening for APN feedback on %s at %s', config.push.feedbackGateway, new Date().toString());
