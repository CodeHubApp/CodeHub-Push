/**
 * Module dependencies.
 */
var time = require('time')(Date)
 , express = require('express')
 , http = require('http')
 , db = require('./db')
 , github = require('./github')
 , async = require('async')
 , push = require('./push')
 , config = require('./config')
 , _ = require('underscore');

// NewRelic
require('./misc/newrelic');

var app = express();

// all environments
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

app.post('/unregister', function(req, res) {
	var token = req.body.token;
	var oauth = req.body.oauth;

	console.log(token + " - " + oauth);

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


// Process a registration by grabbing the notifications for it
// then we'll process the notificiations & save the registration with the updated
// etag in parallel to save some time
function processRegistration(reg, callback) {
	github.notifications(reg.oauth, reg.etag, function(err, results, newEtag) {
		if (err) return callback(err);
		if (newEtag === reg.etag) return callback();

		var saveEtagTask = function(callback) {
			//reg.etag = newEtag;
			reg.save(function(err) {
				if (err) console.error(err);
				callback();
			});
		};

		var processTask = function(callback) {
			var total = results.length;
			var tasks = _.map(results, function(entry) {
				return function(callback) {
					github.process(reg.oauth, reg.lastUpdated, entry, function(err, msg) {
						push.send(reg.tokens, 0, msg, {});
						callback(err);
					});
				};
			});

			// Do all the tasks, in series though and if one fails then stop processing!
			// We don't want to attack GitHub with requests that ultimiately fail somehow.
			async.series(tasks, callback);
		};


		async.parallel([processTask, saveEtagTask], function() {
			console.log('Processed registration for ' + reg.username);
			callback();
		});
	});
}

function doUpdates() {
	console.log('Staring update loop: ' + new Date().getTime());

	var execute = function(tasks) {
		async.parallelLimit(tasks, config.registrationBatch, function(err, results) {
			console.log("Update loop complete: " + new Date().getTime());
			setTimeout(doUpdates, config.updateTime);
		});
	};

	var handleRegistrations = function(err, regs) {
		if (err) {
			console.error(err);
			return setTimeout(doUpdates, config.updateTime);
		}

		var tasks = _.map(regs, function(reg) {
			return function(callback) {

				// Avoid flooding the server which means we need to delay our callback
				// so the next task doesn't start right away.
				// Also, don't report an error back since it will immediately call the
				// main callback and we don't want that...
				var finish = function(err) {
					if (err) console.error('Error processing registration for ' + reg.username + ': ' + err);
					setTimeout(callback, 1000);
				};

				try {
					// Process this registration
					processRegistration(reg, finish);
				} catch (err) {
					finish(err);
				}
			};
		});
		execute(tasks);
	};

	db.Registration.find({}, handleRegistrations);
};

http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
	//setTimeout(doUpdates, config.updateTime);
	doUpdates();
});
