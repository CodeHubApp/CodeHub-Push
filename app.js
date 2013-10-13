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

app.post('/unregister', function(req, res) {
    var token = req.body.token;
    var oauth = req.body.oauth;

    // TODO: Unregister
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
            reg.save(function (err) {
                if (err) {
                    console.error(err);
                    res.send(300);
                } else {
                    res.send(200);
                }
                res.send();
            });
        } else {
            db.Registration.create({
                'tokens': [token],
                'oauth': oauth,
                'username': user
            }, function(err) {
                if (err) {
                    console.error(err);
                    res.send(300);
                } else {
                    res.send(201);
                }
                res.end();
            });
        }
    });
});

function processNotifications(reg, notifications, callback) {
    var total = notifications.length;
    var tasks = _.map(notifications, function(entry) {
        // We don't care about things that we already sent in the past
        // However, we don't want to use the 'since' tag since we need to see
        // how many are still in the notifications queue.
        if (new Date(entry.updated_at) < reg.updated_at) {
            return function(callback) { callback(); };
        }

        return function(callback) {
            var detailCallback = function(err, body, newEtag) {
                if (err) return callback(err);

                try {
                    // If the two urls are the same then it's most likely that someone
                    // just created the entry. If they're different it's most likely a comment
                    var created = entry.subject.url === entry.subject.latest_comment_url;
                    var num = entry.subject.url.substring(entry.subject.url.lastIndexOf('/') + 1);
                    var msg = body.user.login + (created ? ' opened' : ' commented on');
                 
                    if (entry.subject.type === 'Issue') {
                        msg += ' issue';
                        msg += ' ' + entry.repository.full_name + '#' + num;
                    } else if (entry.subject.type === 'PullRequest') {
                        msg += ' pull request';
                        msg += ' ' + entry.repository.full_name + '#' + num;
                    } else if (entry.subject.type === 'Commit') {
                        num = num.substring(0, 6);
                        msg += ' commit';
                        msg += ' ' + entry.repository.full_name + '@' + num;
                    }

                    push.send(reg.tokens, total, msg);
                    callback(null);
                } catch (err) {
                    callback(err);
                }
            };

            // Get the latest comment
            github.get(entry.subject.latest_comment_url, reg.oauth, null, detailCallback);
        };
    });

    // Do all the tasks, in series though and if one fails then stop processing!
    // We don't want to attack GitHub with requests that ultimiately fail somehow.
    async.series(tasks, callback);
}

// Process a registration by grabbing the notifications for it
// then we'll process the notificiations & save the registration with the updated
// etag in parallel to save some time
function processRegistration(reg, callback) {
    github.notifications(reg.oauth, reg.etag, function(err, results, newEtag) {
        if (err) return callback(err);
        if (newEtag === reg.etag) return callback();

        async.parallel([
            function(callback) {
                processNotifications(reg, results, function(err) {
                    if (err) console.error(err);
                    callback();
                });
            },
            function(callback) {
                reg.etag = newEtag;
                reg.save(function(err) {
                    if (err) console.error(err);
                    callback();
                });
            }
        ], function() {
            console.log('Processed registration for ' + reg.username);
            callback();
        });
    });
}

function doUpdates() {
    console.log('Staring update loop');

    db.Registration.find({}, function(err, regs) {
        // Create a task for each registration we  have
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

        // Do things 5 at a time to avoid flooding the server
        async.parallelLimit(tasks, config.registrationBatch, function(err, results) {
            console.log("Update loop complete.");
            setTimeout(doUpdates, config.updateTime);
        });
    });
};

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));

  //Start loop for updates
  setTimeout(doUpdates, config.updateTime);
});
