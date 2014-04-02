var _      = require('underscore'),
    async  = require('async');

/**
 * Process the notifications
 * @param client The GitHub client
 * @param notification The notification object
 * @param callback The callback
 */
function processNotification(client, notification, callback) {
    var detailCallback = function(err, body) {
        if (err) return callback(err);

        try {
            // If the two urls are the same then it's most likely that someone
            // just created the notification. If they're different it's most likely a comment
            var created = notification.subject.url === notification.subject.latest_comment_url;
            var num = notification.subject.url.substring(notification.subject.url.lastIndexOf('/') + 1);
            var msg = body.user.login + (created ? ' opened' : ' commented on');
            var data = {};

            if (notification.subject.type === 'Issue') {
                msg += ' issue';
                msg += ' ' + notification.repository.full_name + '#' + num;
                data['i'] = num;
            } else if (notification.subject.type === 'PullRequest') {
                msg += ' pull request';
                msg += ' ' + notification.repository.full_name + '#' + num;
                data['p'] = num;
            } else if (notification.subject.type === 'Commit') {
                num = num.substring(0, 6);
                msg += ' commit';
                msg += ' ' + notification.repository.full_name + '@' + num;
                data['c'] = num;
            }

            data['u'] = client.username;
            data['r'] = notification.repository.full_name;

            callback(null, {
                msg: msg,
                data: data
            });
        } catch (err) {
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
exports.processNotifications = function(client, lastModified, callback) {
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
