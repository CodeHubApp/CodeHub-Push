var  _       = require('underscore'),
    async   = require('async'),
    db      = require('../db'),
    config  = require('../config'),
    redis   = require('redis'),
    apn     = require('apn'),
    redisq  = require('redisq');

var service = new apn.connection({ gateway: config.push.serviceGateway, certData: config.push.cert, keyData: config.push.key });
var feedback = new apn.feedback({ address: config.push.feedbackGateway, interval: config.push.feedbackInterval, batchFeedback: true });

feedback.on('feedback', function(feedbackData) {
    var time, device;
    var tasks = [];
    for(var i in feedbackData) {
        time = feedbackData[i].time;
        device = feedbackData[i].device;
        tasks.push(function(callback) {
            console.log("Device: " + device.toString('hex') + " has been unreachable, since: " + time);
            db.removeExpiredRegistration(device, function() {
                callback();
            });
        });
    }
    async.parallelLimit(tasks, 3);
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


// Create the queues
var queue = redisq.queue('process');
queue.retry = false;
var queue2 = redisq.queue('push');
queue2.retry = false;

// Setup redisq options
redisq.options(config.redisq.options);

var client = redis.createClient();
function workQueueLength(callback) {
    client.llen('redisq:process:queue', function(err, result) {
        callback(err, result);
    });
}

queue2.process(function(task, cb) {
    for (var i = 0; i < task.messages.length; i++) {
        send(task.tokens, 0, task.messages[i].msg, task.messages[i].data);
    }

    db.updateEtagAndUpdatedAt(task.oauth, task.etag, task.updated_at, function() {
        cb(null);
    })
})

function registrationLoop(callback) {
    db.getRegistrations(
        function(err) {
            if (err) {
                console.error(err)
            } else {
                callback();
            }
        },
        function(row) {
            queue.push({
                tokens: row.tokens.split(','),
                oauth: row.oauth,
                username: row.username,
                etag: row.etag,
                updated_at: new Date(row.updated_at)
            });
    });
}

var doStuff = function() {
    var timeoutLoop = function(callback) {
        setTimeout(function() {
            workQueueLength(function(err, result) {
                if (err === null && result == 0) {
                    return callback(result);
                }
                timeoutLoop();
            });
        }, 1000)
    };

    registrationLoop(function() {
        timeoutLoop(function() {
            console.log('sleeping...');
            setTimeout(doStuff, 1000 * 60);
        });
    });
}

// Welcome!
console.log('Staring update loop: ' + new Date().getTime());
doStuff();

