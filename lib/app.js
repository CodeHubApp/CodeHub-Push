'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const assert = require('http-assert');
const wrap = require('co-express');
const morgan = require('morgan');
const validator = require('express-validator');
const db = require('./db');
const logger = require('winston');
const github = require('./github').Client;

// Forward morgan logging into winston
logger.stream = {
  write: function(message, encoding) {
    logger.info(message.trim());
  }
};

// Create the application & middleware
var app = express();
app.set('etag', false);
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

/**
 * Register a user, their token, oauth, and domain in the system
 */
app.post('/register', wrap(function *(req, res) {
  req.checkBody('token').notEmpty().withMessage('Must have a valid iOS push token');
  req.checkBody('oauth').notEmpty().withMessage('Must have a valid GitHub OAuth token');
  req.validate();

  const isRegistered = yield db.isRegistered(req.body.token, req.body.oauth);
  if (isRegistered) {
    return res.status(409).end();
  }

  const client = new github(req.body.oauth);
  yield client.notifications();
  const user = yield client.currentUser();
  const inserted = yield db.insertRegistration(req.body.token, req.body.oauth, user.login);
  res.status(inserted ? 200 : 409).end();
}));

/**
 * Check if a user is registered [Deprecated]
 */
app.post('/registered', wrap(function *(req, res) {
  req.checkBody('token', 'Invalid token').notEmpty();
  req.checkBody('oauth', 'Invalid oAuth token').notEmpty();
  req.validate();
  const registered = yield db.isRegistered(req.body.token, req.body.oauth);
  res.status(registered ? 200 : 404).end();
}));

/**
 * Check if a user is registered
 */
app.get('/registered', wrap(function *(req, res) {
  req.checkQuery('token', 'Invalid token').notEmpty();
  req.checkQuery('oauth', 'Invalid oAuth token').notEmpty();
  req.validate();
  const registered = yield db.isRegistered(req.query.token, req.query.oauth);
  res.status(registered ? 200 : 404).end();
}));

/**
 * Unregister a user from push notifications
 */
app.post('/unregister', wrap(function *(req, res) {
  req.checkBody('token').notEmpty().withMessage('Invalid token');
  req.checkBody('oauth').notEmpty().withMessage('Invalid oAuth token');
  req.validate();
  const found = yield db.removeRegistration(req.body.token, req.body.oauth);
  res.status(found ? 200 : 404).end();
}));

/**
 * Catch all errors
 */
app.use(function(err, req, res, next) {
  res.status(err.status || 500).json({
    message: err.message,
    errors: err.errors,
    stack: err.stack
  });
});

module.exports = app;
