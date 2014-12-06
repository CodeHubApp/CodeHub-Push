var express = require('express')
  , config = require('./config')
  , http = require('http')
  , db = require('../lib/db')
  , github = require('../lib/github')
  , raven = require('raven')
  , spawn = require('child_process').spawn
  , async = require('async');

// Configure Raven for error reporting
var ravenClient = new raven.Client(config.raven);
ravenClient.patchGlobal();

// The APN feedback object
var apnFeedback = new apn.feedback({ address: config.apnFeedbackGateway, certData: config.apnCert, keyData: config.apnKey });

// Do something on feedback from APN service
apnFeedback.on('feedback', function(feedbackData) {
    feedbackData = feedbackData || [];
    var tasks = feedbackData.map(function(i) {
        return function(callback) {
            console.log('device %s has been unresponsive since %s', i.device, i.time);
            db.removeExpiredRegistration(i.device, function(err) {
                if (err) {
                    ravenClient.captureError(err);
                    console.error(err);
                }
                callback(null);
            })
        };
    });

    console.log('Feedback service reports %s unresponsive devices', tasks.length);\
    async.series(tasks);
});

apnFeedback.on('feedbackError', console.error);

// Setup express
var app = express();
app.set('port', config.port);
app.use(express.bodyParser());
express.logger.token('body', function(req) { return JSON.stringify(req.body) });
app.use(express.logger('[:date] :remote-addr - :method :status - :url :body'));
app.use(express.methodOverride());
app.use(app.router);

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

/**
 * Get in-app purchase identifiers. Use this to disable purchases for in-app items
 * just incase there is an emergency. We don't need people purchasing items they can't
 * use!
 */
app.get('/in-app', function(req, res) {
    res.json(200, ['com.dillonbuchanan.codehub.push']);
});

/**
 * Register a user, their token, oauth, and domain in the system
 */
app.post('/register', function(req, res, next) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var user   = req.body.user;
    var domain = req.body.domain;

    var client = new github.Client(domain, oauth, user);
    client.notifications(null, function(err) {
        if (err) return res.json(400, { error: err.message });
        db.insertRegistration(token, oauth, user, domain, function(err, inserted) {
            if (err) return next(err);
            res.send(inserted ? 200 : 409);
        });
    });
});

/**
 * Check if a user is registered
 */
app.post('/registered', function(req, res, next) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var domain = req.body.domain;

    db.isRegistered(token, oauth, domain, function(err, isRegistered) {
        if (err) return next(err);
        res.send(isRegistered ? 200 : 404);
    });
});

/**
 * Unregister a user from push notifications
 */
app.post('/unregister', function(req, res, next) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var domain = req.body.domain;

    db.removeRegistration(token, oauth, domain, function(err, found) {
        if (err) return next(err);
        res.send(found ? 200 : 404);
    });
});

/**
 * Catch all errors
 */
app.use(function(err, req, res, next) {
    ravenClient.captureError(err);
    console.error(err);
    res.send(500);
});

// Start the server
http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));

    function doBackgroundWork() {
        var worker = spawn(__dirname + '/worker.js');

        worker.stdout.on('data', function (data) {
            console.log('[Worker] ' + data);
        });

        worker.stderr.on('data', function (data) {
            console.error('[Worker] ' + data)
        });

        worker.on('close', function(code) {
            setTimeout(doBackgroundWork, 1000 * 60 * 2);
        });
    }

    doBackgroundWork();
});