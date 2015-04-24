#!/usr/bin/node
var  _      = require('underscore'),
    config  = require('./config'),
    fs      = require('fs'),
    async   = require('async'),
    db      = require('./lib/db'),
    github  = require('./lib/github'),
    apn     = require('apn'),
    StatsD  = require('node-statsd'),
    raven   = require('raven');

// Configure Raven for error reporting
var ravenClient;
if (config.raven) {
    ravenClient = new raven.Client(config.raven);
    ravenClient.patchGlobal();
}

// A method to report errors
function reportError(err) {
    if (ravenClient)
        ravenClient.captureError(err);
    console.error(err);
}

// The statsD client for reporting statistics
var stats = new StatsD({
    host: 'graphite.dillonbuchanan',
    prefix: 'codehub_push.',
    cacheDns: true,
});

// Instantiate the APN service mechanisms
var apnService = new apn.connection({ address: config.apnServiceGateway, certData: config.apnCert, keyData: config.apnKey });

apnService.on('connected', function() {
    if (!config.production) {
        console.log("APN Connected");
    }
});

apnService.on('transmitted', function(notification, device) {
    stats.increment('transmitted');
    if (!config.production) {
        console.log("Notification " + JSON.stringify(notification) + " transmitted to: " + device.token.toString('hex'));
    }
});

apnService.on('transmissionError', function(errCode, notification, device) {
    stats.increment('transmission_error');
    reportError(new Error("Notification caused error: " + errCode + " for device " + device + " : " + notification));
});

apnService.on('timeout', function () {
    stats.increment('timeout');
    console.error("Connection Timeout");
});

apnService.on('disconnected', function() {
    stats.increment('disconnected');
    console.error("Disconnected from APN");
});

apnService.on('socketError', function(err) {
    stats.increment('socket_error');
    console.error(err);
});

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
 * Process the notifications
 * @param client The GitHub client
 * @param notification The notification object
 * @param callback The callback
 */
function processNotification(client, notification, callback) {
    if (!notification) {
        return callback(new Error('Notification object was undefined.'));
    } else if (!notification.subject) {
        return callback(new Error('Notification subject was undefined: ' + JSON.stringify(notification)));
    } else if (!notification.subject.type) {
        return callback(new Error('Notification type was undefined!'));
    }

    var detailCallback = function(err, body) {
        if (err) return callback(err);

        try {
            var data = {};
            var msg = '';

            if (notification.subject.type === 'Release') {
              msg = body.author.login + ' released ' + notification.subject.title;
            } else if (notification.subject.type === 'Commit') {
              // Get the number from the URL & create a short version for display
              var num = notification.subject.url.substring(notification.subject.url.lastIndexOf('/') + 1);
              var shortNum = num.substring(0, 6);
              msg = body.user.login + ' commented on ';
              msg += ' commit';
              msg += ' ' + notification.repository.full_name + '@' + num.substring(0, 6);
              data['c'] = num;
            } else if (notification.subject.type === 'Issue' || notification.subject.type === 'PullRequest') {
              // If the two urls are the same then it's most likely that someone
              // just created the notification. If they're different it's most likely a comment
              var stateChange = notification.subject.url === notification.subject.latest_comment_url;
              var num = notification.subject.url.substring(notification.subject.url.lastIndexOf('/') + 1);
              var shortNum = num.substring(0, 6);

              msg = body.user.login;
              if (stateChange) {
                msg += (body.state === 'open') ? ' opened' : ' closed';
              } else {
                msg += ' commented on';
              }

              if (notification.subject.type === 'Issue') {
                msg += ' issue';
                msg += ' ' + notification.repository.full_name + '#' + shortNum;
                data['i'] = num;
              } else if (notification.subject.type === 'PullRequest') {
                msg += ' pull request';
                msg += ' ' + notification.repository.full_name + '#' + shortNum;
                data['p'] = num;
              }
            } else {
              return callback(new Error('No support for subject type ' + notification.subject.type));
            }

            data['u'] = client.username;
            data['r'] = notification.repository.full_name;

            callback(null, {
                msg: msg,
                data: data
            });
        } catch (err) {
            console.error('Unable to parse notification: ' + JSON.stringify(body) + ' -- ' + JSON.stringify(notification));
            callback(err);
        }
    };


    // Get the latest comment
    client.get(notification.subject.latest_comment_url, null, detailCallback);
};

/**
 * Process a registration object
 * @param client The GitHub client
 * @param lastModified The date the last request was updated
 * @param callback The callback
 */
function processNotifications(client, lastModified, callback) {
    var notificationCallback = function(err, results, lastModified) {
        if (err) return callback(err);

        var tasks = _.map(results, function(entry) {
            return function(callback) {
                processNotification(client, entry, function(err, data) {
                    if (err) return callback(err);
                    if (data.msg === undefined) return callback(new Error('no message'));
                    callback(null, data);
                });
            };
        });

        // Do all the tasks, in series though and if one fails then stop processing!
        // We don't want to attack GitHub with requests that ultimiately fail somehow.
        async.series(tasks, function(err, results) {
            if (err) return callback(err);
            callback(null, lastModified, results);
        });
    };

    client.notifications(lastModified, notificationCallback);
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

    processNotifications(client, updatedDate, function(err, lastModified, results) {
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

// The main loop
var timeStart = new Date();
registrationLoop(function(tasks) {
    stats.gauge('tasks', tasks.length);
    async.parallelLimit(tasks, 5, function() {
        var diff = (new Date()) - timeStart;
        stats.timing('task_loop_duration', diff);
        if (!config.production) {
            console.log('%s tasks complete in %s minutes', tasks.length, (diff / 1000 / 60).toFixed(2));
        }
        process.exit(0);
    });
});
