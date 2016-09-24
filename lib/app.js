'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const assert = require('http-assert');
const wrap = require('co-express');
const morgan = require('morgan');
const validator = require('express-validator');
const logger = require('winston');
const GitHub = require('./github').Client;
const RateLimit = require('express-rate-limit');

// Forward morgan logging into winston
logger.stream = {
  write(message, encoding) {
    logger.info(message.trim());
  }
};

module.exports = function create(db) {
  const app = express();
  app.set('etag', false);
  app.set('x-powered-by', false);
  app.use(morgan('combined', { stream: logger.stream }));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(validator(), function(req, res, next) {
    req.validate = function() {
      const errors = req.validationErrors();
      assert(!errors, 401, 'Validation failure', { errors: errors });
    }
    next();
  });

  /**
   * Get in-app purchase identifiers. Use this to disable purchases for in-app items
   * just incase there is an emergency. We don't need people purchasing items they can't
   * use!
   */
  app.get('/in-app', (req, res) => res.status(200).json(['com.dillonbuchanan.codehub.push']));

  // Rate limit all subsequent endpoints
  app.use(new RateLimit({
    windowsMs: 15*60*1000,
    max: 100,
    delayMs: 0,
    handler: (req, res, next) => {
      const err = new Error('Too many requests, please try again later.');
      err.status = 429
      next(err);
    }
  }));

  /**
   * Register a user, their token, oauth, and domain in the system
   */
  app.post('/register', wrap(function *(req, res) {
    req.checkBody('token').notEmpty().withMessage('Must have a valid iOS push token');
    req.checkBody('oauth').notEmpty().withMessage('Must have a valid GitHub OAuth token');
    req.validate();

    const isRegistered = yield db.isRegistered(req.body.token, req.body.oauth);
    if (isRegistered) {
      // Delay is neccessary to prevent timing attacks to exfiltrate data
      yield (done) => setTimeout(done, Math.floor(100 + Math.random() * 100));
      return res.status(200).end();
    }

    const client = new GitHub(req.body.oauth);
    yield client.notifications();
    const user = yield client.currentUser();
    yield db.insertRegistration(req.body.token, req.body.oauth, user.login);
    res.status(200).end();
  }));

  /**
   * Unregister a user from push notifications
   */
  app.post('/unregister', wrap(function *(req, res) {
    req.checkBody('token', 'Invalid token').notEmpty();
    req.checkBody('oauth', 'Invalid oAuth token').notEmpty();
    req.validate();
    yield db.removeRegistration(req.body.token, req.body.oauth);
    res.status(200).end();
  }));

  /**
   * Catch all errors
   */
  app.use(function(err, req, res, next) {
    res.status(err.status || 500).json({
      message: err.message,
      errors: err.errors
    });
  });

  return app;
}
