var apn     = require('apn'),
    db      = require('../lib/db'),
    async   = require('async'),
    config  = require('../config');

function Apn() {
    this.service = new apn.connection({ gateway: config.push.serviceGateway, certData: config.push.cert, keyData: config.push.key });
    this.feedback = new apn.feedback({ address: config.push.feedbackGateway, interval: config.push.feedbackInterval, batchFeedback: true });

    this.service.on('connected', function() {
        console.log("APN Connected");
    });

    this.service.on('transmitted', function(notification, device) {
        console.log("Notification " + JSON.stringify(notification) + " transmitted to: " + device.token.toString('hex'));
    });

    this.service.on('transmissionError', function(errCode, notification, device) {
        console.error("Notification caused error: " + errCode + " for device ", device, notification);
    });

    this.service.on('timeout', function () {
        console.log("Connection Timeout");
    });

    this.service.on('disconnected', function() {
        console.log("Disconnected from APN");
    });

    this.feedback.on('feedback', function(feedbackData) {
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
        async.series(tasks);
    });

    this.service.on('socketError', console.error);
    this.feedback.on('feedbackError', console.error);
}

Apn.prototype.send = function(tokens, msg, payload) {
    var data = new apn.Notification();
    data.alert = msg;
    data.sound = 'default';
    data.payload = payload;
    this.service.pushNotification(data, tokens)
    return this;
};

exports.Apn = Apn;