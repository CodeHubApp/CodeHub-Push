var express = require('express')
  , http = require('http')
  , db = require('../lib/db')
  , github = require('../lib/github')
  , raven = require('raven');

// Configure Raven for error reporting
var ravenClient = new raven.Client(process.env['RAVEN']);

// Install unhandled exception handler
ravenClient.patchGlobal();

// A method to report errors
function reportError(err) {
    ravenClient.captureError(err);
    console.err(err);
}

var app = express();
app.set('port', process.env['PORT'] || 3000);
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
    res.json(200, [
        'com.dillonbuchanan.codehub.push'
    ]);
});

/**
 * Register a user, their token, oauth, and domain in the system
 */
app.post('/register', function(req, res) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var user   = req.body.user;
    var domain = req.body.domain;

    var client = new github.Client(domain, oauth, user);
    client.notifications(null, function(err) {
        if (err) {
            reportError(err);
            return res.json(400, { error: err.message });
        }

        db.insertRegistration(token, oauth, user, domain, function(err, inserted) {
            if (err) {
                reportError(err);
                return res.send(500);
            }

            res.send(inserted ? 200 : 409);
        });
    });
});

/**
 * Check if a user is registered
 */
app.post('/registered', function(req, res) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var domain = req.body.domain;

    db.isRegistered(token, oauth, domain, function(err, isRegistered) {
        if (err) {
            reportError(err);
            return res.send(500);
        }

        res.send(isRegistered ? 200 : 404);
    });
});

/**
 * Unregister a user from push notifications
 */
app.post('/unregister', function(req, res) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var domain = req.body.domain;

    db.removeRegistration(token, oauth, domain, function(err, found) {
        if (err) {
            reportError(err);
            return res.send(500)
        }

        res.send(found ? 200 : 404);
    });
});

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
