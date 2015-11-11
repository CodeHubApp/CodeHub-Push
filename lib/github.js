'use strict';
const time = require('time')(Date);
const request = require('request');

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
      if (err) return reject(new Error(err));
      if (res.statusCode >= 500) return reject(new Error(`Error ${res.statusCode}`));
      if (res.statusCode >= 400) return reject(new Error((body || {}).message));
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
