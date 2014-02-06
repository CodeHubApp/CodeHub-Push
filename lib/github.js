var time = require('time')(Date)
    , async = require('async')
    , _ = require('underscore')
    , request = require('request')
    , config = require('../config');

// Grab things from the config
var portal = config.github.portal;

function createUri(path, args) {
    var base = path + '?';
    if (typeof args !== 'undefined') { 
        for (var prop in args) {
            base += prop + '=' + encodeURIComponent(args[prop]) + '&';
        }
    }
    return base;
}

function parseResponse(callback) {
    return function(err, res, body) {
        if (err) {
            return callback(new Error(err));
        }

        var _ref;
        if (Math.floor(res.statusCode / 100) === 5) {
            return callback(new Error('Error ' + res.statusCode));
        }
        try {
            body = JSON.parse(body || '{}');
        } catch (err) {
            return callback(err);
        }
        if (body.message && res.statusCode === 422) {
            return callback(new Error(body.message));
        }
        if (body.message && ((_ref = res.statusCode) === 400 || _ref === 401 || _ref === 404)) {
            return callback(new Error(body.message));
        }
        return callback(null, res.statusCode, body, res.headers);
    };
}

function get(url, oauth, etag, callback, args) {
    var response = function(err, status, body, headers) {
        if (err) return callback(err);
        if (status == 304) return callback(null, {}, etag);
        return callback(null, body, headers.etag);
    };

    request({
        uri: createUri(url, args),
        method: 'GET',
        headers: {
            'User-Agent': config.github.userAgent,
            'If-None-Match': etag,
            'Authorization': 'token ' + oauth
        }
    }, parseResponse(response));
}

// Get the notifications for an oauth user
exports.notifications = function(oauth, etag, callback) {
    get(portal + '/notifications', oauth, etag, callback);
};

exports.process = function(oauth, lastUpdated, notification, callback) {
    var detailCallback = function(err, body, newEtag) {
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

            callback(null, msg, data);
        } catch (err) {
            callback(err);
        }
    };

    // Get the latest comment
    get(notification.subject.latest_comment_url, oauth, null, detailCallback);
}