var express = require('express')
  , http = require('http')
  , path = require('path')
  , routes = require('./routes')
  , config = require('../config');

var app = express();
app.set('port', config.port);
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use('/public', express.static('public'));
app.use(express.bodyParser());
express.logger.token('body', function(req) { return JSON.stringify(req.body) });
app.use(express.logger('[:date] :remote-addr - :method :status - :url :body'));
app.use(express.methodOverride());
app.use(app.router);

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/in-app', routes.features);
app.post('/register', routes.registration.register);
app.post('/registered', routes.registration.registered);
app.post('/unregister', routes.registration.unregister);

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
