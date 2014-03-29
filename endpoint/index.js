var express = require('express')
  , http = require('http')
  , async = require('async')
  , db = require('../lib/db')
  , github = require('../lib/github')
  , config = require('../config');

var app = express();
app.set('port', config.port);
app.use(express.bodyParser());
express.logger.token('body', function(req, res) { return JSON.stringify(req.body) });
app.use(express.logger('[:date] :remote-addr - :method :status - :url :body'));
app.use(express.methodOverride());
app.use(app.router);

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

app.get('/in-app', function(req, res) {
    res.json(200, [
//        'com.dillonbuchanan.codehub.push'
    ]).end();
});

app.post('/unregister', function(req, res) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var domain = req.body.domain;

    db.removeRegistration(token, oauth, domain, function(err, found) {
        if (err) {
            console.error(err);
            return res.send(500).end();
        }

        res.send(found ? 200 : 404).end();
    });
});

app.post('/register', function(req, res) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var user   = req.body.user;
    var domain = req.body.domain;

    var client = new github.Client(domain, oauth, user);
    client.notifications(null, function(err) {
        if (err) {
            console.error(err);
            return res.json(400, { error: err.message }).end();
        }

        db.insertRegistration(token, oauth, user, domain, function(err, inserted) {
            if (err) {
                console.error(err);
                return res.send(500).end();
            }

            res.send(inserted ? 200 : 409).end();
        });
    });
});

app.post('/registered', function(req, res) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var domain = req.body.domain;

    db.isRegistered(token, oauth, domain, function(err, isRegistered) {
        if (err) return res.send(500).end();
        if (isRegistered) {
            res.send(200).end();
        } else {
            res.send(404).end();
        }
    });
});

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
