var time = require('time')(Date)
    , request = require('request');

/**
 * Parse a response object
 * @param callback The callback
 * @returns {Function}
 */
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

/**
 * Constructor
 * @param domain The domain the oauth belongs to
 * @param oauth The oauth identification token
 * @param username The username the oauth belongs to
 * @param userAgent The user agent for the github client
 * @constructor
 */
function Client(domain, oauth, username, userAgent) {
    this.domain = domain;
    this.oauth = oauth;
    this.username = username;
    this.userAgent = (userAgent || 'codehub-push')
}

/**
 * Executes a GET request
 * @param url The url to execute it against (without the domain)
 * @param lastModified The date to test against
 * @param callback The callback
 * @param args Optional arguments
 */
Client.prototype.get = function(url, lastModified, callback, args) {
    var uri = url + '?';
    if (typeof args !== 'undefined') {
        for (var prop in args) {
            uri += prop + '=' + encodeURIComponent(args[prop]) + '&';
        }
    }

    var response = function(err, status, body, headers) {
        if (err) return callback(err);
        if (status == 304) return callback(null, {}, lastModified);
        return callback(null, body, new Date(headers['last-modified']));
    };

    var headers = {};
    headers['User-Agent'] = this.userAgent;
    headers['Authorization'] = 'token ' + this.oauth;
    if (lastModified !== null && lastModified !== undefined) {
        headers['If-Modified-Since'] = lastModified.toUTCString();
    }

    request({
        uri: uri,
        method: 'GET',
        headers: headers
    }, parseResponse(response));
};

/**
 * Gets the notifications for the current user and tests it against the modified since date
 * @param lastModified The date to test against
 * @param callback The callback
 */
Client.prototype.notifications = function(lastModified, callback) {
    var args = {};
    if (lastModified !== null && lastModified !== undefined) {
        args['since'] = lastModified.toISOString();
    }
    this.get(this.domain + '/notifications', lastModified, callback, args);
};

module.exports.Client = Client;