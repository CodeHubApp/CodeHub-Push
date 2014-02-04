var kue     = require('kue'),
    jobs    = kue.createQueue({ disableSearch: true }),
    apn     = require('apn'),
    config  = require('../config');

var service = new apn.connection({ gateway: config.push.serviceGateway, certData: config.push.cert, keyData: config.push.key });
var feedback = new apn.feedback({ address: config.push.feedbackGateway, interval: config.push.feedbackInterval, batchFeedback: true });

feedback.on('feedback', function(feedbackData) {
    var time, device;
    for(var i in feedbackData) {
        time = feedbackData[i].time;
        device = feedbackData[i].device;

        console.log("Device: " + device.toString('hex') + " has been unreachable, since: " + time);
    }
});

feedback.on('feedbackError', console.error);

service.on('connected', function() {
    console.log("APN Connected");
});

service.on('transmitted', function(notification, device) {
    console.log("Notification " + JSON.stringify(notification) + " transmitted to: " + device.token.toString('hex'));
});

service.on('transmissionError', function(errCode, notification, device) {
    console.error("Notification caused error: " + errCode + " for device ", device, notification);
});

service.on('timeout', function () {
    console.log("Connection Timeout");
});

service.on('disconnected', function() {
    console.log("Disconnected from APNS");
});

service.on('socketError', console.error);

// Send a push notification!
function send(tokens, badge, msg, payload) {
    var data = new apn.Notification();
    //data.badge = badge;
    data.alert = msg;
    data.sound = 'default';
    data.payload = payload;
    service.pushNotification(data, tokens)
};

// Process 100 push jobs at a time
jobs.process('push', config.push.activeJobs, function(job, done) {
    send(job.data.tokens, job.data.badge, job.data.msg, job.data.payload);
    done();
});
