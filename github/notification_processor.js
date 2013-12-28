var time = require('time')(Date)
  , github = require('./client')
  , async = require('async')
  , _ = require('underscore');

exports.process = function(oauth, lastUpdated, notification, callback) {
    // We don't care about things that we already sent in the past
    // However, we don't want to use the 'since' tag since we need to see
    // how many are still in the notifications queue.
    if (new Date(notification.updated_at) < lastUpdated) {
        callback();
    }

    var detailCallback = function(err, body, newEtag) {
        if (err) return callback(err);

        try {
            // If the two urls are the same then it's most likely that someone
            // just created the notification. If they're different it's most likely a comment
            var created = notification.subject.url === notification.subject.latest_comment_url;
            var num = notification.subject.url.substring(notification.subject.url.lastIndexOf('/') + 1);
            var msg = body.user.login + (created ? ' opened' : ' commented on');
         
            if (notification.subject.type === 'Issue') {
                msg += ' issue';
                msg += ' ' + notification.repository.full_name + '#' + num;
            } else if (notification.subject.type === 'PullRequest') {
                msg += ' pull request';
                msg += ' ' + notification.repository.full_name + '#' + num;
            } else if (notification.subject.type === 'Commit') {
                num = num.substring(0, 6);
                msg += ' commit';
                msg += ' ' + notification.repository.full_name + '@' + num;
            }

            callback(null, msg);
        } catch (err) {
            callback(err);
        }
    };

    console.log(notification.subject.latest_comment_url)

    // Get the latest comment
    github.get(notification.subject.latest_comment_url, oauth, null, detailCallback);
}
