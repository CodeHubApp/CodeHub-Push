var github  = require('./github'),
    _       = require('underscore'),
    async   = require('async'),
    db      = require('../db'),
    kue     = require('kue'),
    jobs    = kue.createQueue({ disableSearch: true }),
    config  = require('../config');

/*
    Push the payload to the push notification processing service
 */
function push(tokens, badge, msg, payload, callback) {
    jobs.create('push', {
        "tokens": tokens,
        "badge": badge,
        "msg": msg,
        "payload": payload
    }).save(callback);
}

/*
    Process a registration by grabbing the notifications for it
    then we'll process the notificiations & save the registration with the updated
    etag in parallel to save some time
*/
function processRegistration(reg, callback) {
    github.notifications(reg.oauth, reg.etag, function(err, results, newEtag) {
        if (err) return callback(err);
        if (newEtag === reg.etag) return callback();

        var saveEtagTask = function(callback) {
            reg.etag = newEtag;
            reg.save(function(err) {
                if (err) console.error(err);
                callback();
            });
        };

        var processTask = function(callback) {
            var total = results.length;
            var tasks = _.map(results, function(entry) {
                return function(callback) {
                    github.process(reg.oauth, reg.updated_at, entry, function(err, msg, data) {
                        if (err) return callback(err);
                        if (msg === undefined) return callback(null);

                        push(reg.tokens, 0, msg, _.extend({u: reg.username, r: entry.repository.full_name}, data));
                        callback(null);
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

/*
    Process the registrations from the database
 */
function processRegistrations(regs, callback) {
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

    async.parallelLimit(tasks, config.registrationBatch, callback);
}

// Welcome!
console.log('Staring update loop: ' + new Date().getTime());

db.Registration.find({}).batchSize(1000).exec(function(err, regs) {
    if (err) {
        console.error(err);
        process.exit(-1);
    } else {
        processRegistrations(regs, function(err) {
            if (err) {
                console.error(err);
                process.exit(-1);
            }
            else {
                console.log('Loop completed successfully: ' + new Date().getTime());
                process.exit(0);
            }
        });
    }
});
