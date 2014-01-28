var time = require('time')(Date)
    , express = require('express')
    , http = require('http')
    , db = require('../db')
    , async = require('async')
    , config = require('../config')
    , _ = require('underscore');

var app = express();
app.set('port', config.port);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

function errorAndEnd(okCode, errorCode, res) {
    return function(err) {
        if (err) {
            console.error(err);
            res.send(errorCode);
        } else {
            res.send(okCode);
        }
        res.end();
    };
}

app.get('/', function(req, res) {
    res.send(200);
    res.end();
});

app.post('/unregister', function(req, res) {
    var token = req.body.token;
    var oauth = req.body.oauth;

    var query = db.Registration.findOne({'oauth': oauth}).exec(function(err, reg) {
        if (err) {
            console.error(err);
            res.send(400);
            res.end();
            return;
        }

        if (!reg || !_.contains(reg.tokens, token)) {
            res.send(404);
            res.end();
            return;
        }

        if (reg.tokens.length == 1) {
            db.Registration.remove(reg, errorAndEnd(200, 300, res));
        } else {
            reg.tokens = _.reject(reg.tokens, function(x) { return x === token; });
            reg.save(errorAndEnd(200, 300, res));
        }
    });
});

app.post('/register', function(req, res) {
    var token = req.body.token;
    var oauth = req.body.oauth;
    var user = req.body.user;

    var query = db.Registration.findOne({'oauth': oauth}).exec(function(err, reg) {
        if (reg) {
            // Check to see if we already are aware of that token
            if (_.contains(reg.tokens, token)) {
                res.send(200);
                res.end();
                return;
            }

            // Add the token to that registration
            reg.tokens.push(token);
            reg.save(errorAndEnd(200, 300, res));
        } else {
            db.Registration.create({
                'tokens': [token],
                'oauth': oauth,
                'username': user
            }, errorAndEnd(201, 300, res));
        }
    });
});

app.get('/registered', function(req, res) {
    var token = req.query.token;
    var oauth = req.query.oauth;

    db.Registration.findOne({'oauth': oauth}).exec(function(err, reg) {
        if (err) {
            console.error(err);
            res.send(400);
            res.end();
        }

        if (reg && _.contains(reg.tokens, token)) {
            res.send(200);
            res.send();
        } else {
            res.send(404);
            res.send();
        }
    });
});

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
