'use strict';
const time = require('time')(Date);
const request = require('request');
const util = require('util');

function HttpError(statusCode, message, extra = {}) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.statusCode = statusCode;
  this.extra = extra;
};

util.inherits(HttpError, Error);

/**
 * Constructor
 * @param oauth The oauth identification token
 * @constructor
 */
function Client(oauth) {
    this.oauth = oauth;
    this.domain = 'https://api.github.com';
};

/**
 * Executes a GET request
 * @param url The url to execute it against
 * @param lastModified The date to test against
 * @param callback The callback
 * @param args Optional arguments
 */
Client.prototype.get = function(url, args) {
  const opts = {
    uri: url,
    qs: args,
    method: 'GET',
    json: {},
    headers: {
      'User-Agent': 'codehub-push',
      'Authorization': `token ${this.oauth}`
    }
  };

  return new Promise((resolve, reject) => {
    request(opts, (err, res, body) => {
      if (err) return reject(err);
      if (res.statusCode >= 400) return reject(new HttpError(res.statusCode, (body || {}).message));
      return resolve(body);
    });
  });
};

/**
 * Gets the notifications for the current user and tests it against the modified since date
 * @param lastModified The date to test against
 * @param callback The callback
 */
Client.prototype.notifications = function(lastModified) {
    var args = {};
    if (lastModified) {
        args['since'] = lastModified.toISOString();
    }

    return this.get(`${this.domain}/notifications`, args);
};

/**
 * Get the current user info
 */
Client.prototype.currentUser = function() {
  return this.get(`${this.domain}/user`);
};

/**
 * A Github cliente
 * @type {Client}
 */
exports.Client = Client;

/**
 * An Http Error
 * @type {HttpError}
 */
exports.HttpError = HttpError;
