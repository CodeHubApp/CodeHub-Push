var  _      = require('underscore'),
    fs      = require('fs'),
    async   = require('async'),
    db      = require('../lib/db'),
    github  = require('../lib/github'),
    notify  = require('./notifications'),
    apn     = require('apn'),
    raven   = require('raven');

// Configure Raven for error reporting
var ravenClient = new raven.Client(process.env['RAVEN']);

// Install unhandled exception handler
ravenClient.patchGlobal();

// A method to report errors
function reportError(err) {
    if (!err) return;
    ravenClient.captureError(err);
    console.error(err);
}

// determine values for these based on environment mode
var apnServiceGateway, apnFeedbackGateway, apnCert, apnKey;

if (process.env.NODE_ENV === 'production') {
    apnServiceGateway = 'gateway.push.apple.com';
    apnFeedbackGateway = 'feedback.push.apple.com';
    apnCert = fs.readFileSync(__dirname + '/certs/cert.production.pem');
    apnKey = fs.readFileSync(__dirname + '/certs/key.production.pem');
}
else {
    apnServiceGateway = 'gateway.sandbox.push.apple.com';
    apnFeedbackGateway = 'feedback.sandbox.push.apple.com';
    apnCert = fs.readFileSync(__dirname + '/certs/cert.development.pem');
    apnKey = fs.readFileSync(__dirname + '/certs/key.development.pem');
}

// Instantiate the APN service mechanisms
var apnService = new apn.connection({ address: apnServiceGateway, certData: apnCert, keyData: apnKey });
var apnFeedback = new apn.feedback({ address: apnFeedbackGateway, certData: apnCert, keyData: apnKey });

apnService.on('connected', function() {
    console.log("APN Connected");
});

apnService.on('transmitted', function(notification, device) {
    console.log("Notification " + JSON.stringify(notification) + " transmitted to: " + device.token.toString('hex'));
});

apnService.on('transmissionError', function(errCode, notification, device) {
    reportError(new Error("Notification caused error: " + errCode + " for device " + device + " : " + notification));
});

apnService.on('timeout', function () {
    console.log("Connection Timeout");
});

apnService.on('disconnected', function() {
    console.log("Disconnected from APN");
});

apnService.on('socketError', console.error);

apnFeedback.on('feedbackError', console.error);

// Do something on feedback from APN service
apnFeedback.on('feedback', function(feedbackData) {
    var tasks = _.map(feedbackData, function(i) {
        return function(callback) {
            console.log('device %s has been unresponsive since %s', i.device, i.time);
            db.removeExpiredRegistration(i.device, function(err) {
                if (err) reportError(err);
                callback(null);
            })
        };
    });

    console.log('Feedback service reports %s unresponsive devices', feedbackData.length);
    async.series(tasks);
})

/**
 * Sends an APN notification
 * @param tokens the tokens to send to
 * @param msg The message to send
 * @param payload The payload which includes arbitrary data
 */
function apnSend(tokens, msg, payload) {
    var data = new apn.Notification();
    data.alert = msg;
    data.sound = 'default';
    data.payload = payload;
    apnService.pushNotification(data, tokens)
};

/**
 * Process a record
 * @param row The row in the database
 * @param callback The
 */
function processRecord(record, callback) {
    var client = new github.Client(record.domain, record.oauth, record.username);

    // Convert the date object in the database
    var updatedDate = Date.parse(record.updated_at);
    if (isNaN(updatedDate)) {
        updatedDate = new Date(0);
    } else {
        updatedDate = new Date(updatedDate);
    }

    notify.processNotifications(client, updatedDate, function(err, lastModified, results) {
        if (err) {
            console.error('Error procesing registrations: %s - %s', err, err.stack);

            if (err.message === 'Bad credentials') {
                console.error('Removing %s at %s for bad credentials', record.oauth, record.domain);
                return db.removeBadAuth(record.oauth, record.domain, callback);
            }
            else {
                results = [];
                lastModified = new Date();
            }
        }

        if (results !== undefined && results.length > 0) {
            _.each(results, function(result) {
                //console.log('pushing to %s: %s', record.tokens, result.msg);
                apnSend(record.tokens.split(','), result.msg, result.data);
            });
        }

        db.updateUpdatedAt(record.oauth, record.domain, lastModified, callback);
    });
};

/**
 * The registration loop
 * @param callback
 */
function registrationLoop(callback) {
    var tasks = [];
    db.getRegistrations(function(err) {
        if (err) {
            reportError(err);
        } else {
            callback(tasks);
        }
    },
    function(row) {
        tasks.push(function(callback) {
            processRecord(row, function(err) {
                if (err) reportError(err);
		setTimeout(callback, 100);
            });
        });
    });
};

/**
 * Main method
 */
function main() {
    var timeStart = new Date();
    //console.log('Staring update loop at %s', timeStart.toString());
    registrationLoop(function(tasks) {
        var numberOfTasks = tasks.length;
        //console.log('There are %s tasks to complete...', numberOfTasks);

        async.parallelLimit(tasks, 5, function() {
            var timeEnd = new Date();
            var diff = timeEnd - timeStart;
            console.log('%s tasks complete in %s minutes', numberOfTasks, (diff / 1000 / 60).toFixed(2));
            mainTimer();
        })
    });
}

function mainTimer() {
    setTimeout(main, 1000 * 60 * 2);
}

// Welcome!
main();

