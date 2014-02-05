var github  = require('./github'),
    time    = require('time'),
    _       = require('underscore'),
    async   = require('async'),
    config  = require('../config'),
    redisq  = require('redisq');

redisq.options(config.redisq.options);

var queue = redisq.queue('process'),
    queue2 = redisq.queue('push');
    concurency = 10;
queue.retry = false;
queue2.retry = false;

/*
 Process a registration by grabbing the notifications for it
 then we'll process the notifications & save the registration with the updated
 etag in parallel to save some time
 */
function processRegistration(reg, callback) {
    github.notifications(reg.oauth, reg.etag, function(err, results, newEtag) {
        if (err) return callback(err);
        if (newEtag === reg.etag) return callback(null);
        var date = new time.Date();
        date.setTimezone('UTC');

        var total = results.length;
        var tasks = _.map(results, function(entry) {
            return function(callback) {
                github.process(reg.oauth, reg.updated_at, entry, function(err, msg, data) {
                    if (err) return callback(err);
                    if (msg === undefined) return callback(new Error('no message'));

                    callback(null, {
                        msg: msg,
                        data: _.extend({u: reg.username, r: entry.repository.full_name}, data)
                    });
                });
            };
        });

        // Do all the tasks, in series though and if one fails then stop processing!
        // We don't want to attack GitHub with requests that ultimiately fail somehow.
        async.series(tasks, function(err, results) {
            if (err) return callback(err);

            if (results.length > 0) {
                callback(null, {
                    oauth: reg.oauth,
                    tokens: reg.tokens,
                    etag: newEtag,
                    updated_at: date,
                    messages: results
                });
            } else {
                callback(null);
            }
        });
    });
}

queue.process(function(task, cb) {
    console.log('beginning processing for ' + task.username);
    var done = function(err) {
        if (err) console.error('error processing ' + task.username);
        else console.log('finished processing ' + task.username);
        cb(err);
    };

    processRegistration(task, function(err, data) {
        if (err) return done(err);
        if (data !== undefined) queue2.push(data);
        done();
    });
}, concurency);

console.log('waiting for records...');