var express = require('express')
  , http = require('http')
  , db = require('../lib/db')
  , config = require('../config');

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

app.get('/', function(req, res) {
    res.send(200);
    res.end();
});

app.post('/unregister', function(req, res) {
    db.removeRegistration(req.body.token, req.body.oauth,
        function(err, found) {
            if (err) {
                console.error(err);
                return res.send(500).end();
            }
            res.send(found ? 200 : 404).end();
    });
});

app.post('/register', function(req, res) {
    db.insertRegistration(req.body.token, req.body.oauth, req.body.user,
        function(err, inserted) {
            if (err) {
                console.error(err);
                return res.send(500).end();
            }
            res.send(inserted ? 200 : 409).end();
    });
});

app.get('/registered', function(req, res) {
    db.isRegistered(req.query.token, req.query.oauth, function(err, isRegistered) {
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

//frontend.listen(config.redisq.frontendPort, 'localhost', config.redisq.options, function() {
//    console.log("Redisq frontend running on port " + config.redisq.frontendPort);
//});