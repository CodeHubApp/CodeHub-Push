const request = require('request');

class HttpError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);

    this.statusCode = statusCode;
    this.extra = extra;
  }
}

class Client {
  /**
   * Constructor
   * @param oauth The oauth identification token
   */
  constructor(oauth) {
    this.oauth = oauth;
    this.domain = 'https://api.github.com';
  }

  /**
   * Executes a GET request
   * @param url The url to execute it against
   * @param lastModified The date to test against
   * @param callback The callback
   * @param args Optional arguments
   */
  get(url, args) {
    const opts = {
      uri: url,
      qs: args,
      method: 'GET',
      json: {},
      timeout: 1000 * 15,
      headers: {
        'User-Agent': 'codehub-push',
        Authorization: `token ${this.oauth}`
      }
    };

    return new Promise((resolve, reject) => {
      request(opts, (err, res, body) => {
        if (err) {
          return reject(err);
        }
        if (res.statusCode >= 400) {
          return reject(new HttpError(res.statusCode, (body || {}).message));
        }
        return resolve(body);
      });
    });
  }

  /**
   * Gets the notifications for the current user and tests it against the modified since date
   * @param lastModified The date to test against
   * @param callback The callback
   */
  notifications(lastModified) {
    const args = {};

    if (lastModified) {
      args.since = lastModified.toISOString();
    }

    return this.get(`${this.domain}/notifications`, args);
  }

  /**
   * Get the current user info
   */
  currentUser() {
    return this.get(`${this.domain}/user`);
  }
}

module.exports = {
  Client,
  HttpError
};
