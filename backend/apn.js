var apn     = require('apn'),
    db      = require('../lib/db'),
    async   = require('async');

function Apn(apnAddress, feedbackAddress, certData, keyData) {
    this.service = new apn.connection({ address: apnAddress, certData: certData, keyData: keyData });
    this.feedback = new apn.feedback({ address: feedbackAddress, certData: certData, keyData: keyData });

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