var apn     = require('apn'),
    config  = require('../config');

function Push() {
    this.service = new apn.connection({ gateway: config.push.serviceGateway, certData: config.push.cert, keyData: config.push.key });

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
}

Push.prototype.send = function(tokens, msg, payload) {
    var data = new apn.Notification();
    data.alert = msg;
    data.sound = 'default';
    data.payload = payload;
    this.service.pushNotification(data, tokens)
    return this;
};

module.exports.Push = Push;


