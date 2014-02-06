var github  = require('../lib/github'),
    time    = require('time'),
    _       = require('underscore'),
    async   = require('async'),
    config  = require('../config'),
    misc    = require('../lib/misc'),
    redisq  = require('redisq');

redisq.options(config.redisq.options);

var queue = redisq.queue('process'),
    queue2 = redisq.queue('push');
    concurency = 5;
queue.retry = false;
queue2.retry = false;

queue.process(function(task, cb) {
    console.log('beginning processing for ' + task.username);

    // The done action
    var done = function(err) {
        if (err) console.error('error processing ' + task.username);
        else console.log('finished processing ' + task.username);
        cb(err);
    };

    misc.processRegistration(task.oauth, task.etag, task.updated_at, task.username, function(err, newEtag, updated_at, results) {
       if (err) return done(err);
        if (results === undefined || results.length == 0) return done();
        queue2.push({
            tokens: task.tokens,
            oauth: task.oauth,
            etag: newEtag,
            updated_at: updated_at,
            messages: results
        });
        done();
    });
}, concurency);

console.log('waiting for work...');
