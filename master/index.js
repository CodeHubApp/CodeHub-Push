var  _       = require('underscore'),
    async   = require('async'),
    db      = require('../lib/db'),
    config  = require('../config'),
    redis   = require('redis'),
    apn     = require('../lib/apn'),
    redisq  = require('redisq');

var push = new apn.Push();

// Create the queues
var queue = redisq.queue('process');
queue.retry = false;
var queue2 = redisq.queue('push');
queue2.retry = false;

// Setup redisq options
redisq.options(config.redisq.options);

var client = redis.createClient();
function workQueueLength(callback) {
    client.llen('redisq:process:queue', function(err, result) {
        callback(err, result);
    });
}

queue2.process(function(task, cb) {
    for (var i = 0; i < task.messages.length; i++) {
        push.send(task.tokens, task.messages[i].msg, task.messages[i].data);
    }

    db.updateEtagAndUpdatedAt(task.oauth, task.etag, task.updated_at, function() {
        cb(null);
    })
})

function registrationLoop(callback) {
    db.getRegistrations(
        function(err) {
            if (err) {
                console.error(err)
            } else {
                callback();
            }
        },
        function(row) {
            queue.push({
                tokens: row.tokens.split(','),
                oauth: row.oauth,
                username: row.username,
                etag: row.etag,
                updated_at: new Date(row.updated_at)
            });
    });
}

var doStuff = function() {
    var timeoutLoop = function(callback) {
        setTimeout(function() {
            workQueueLength(function(err, result) {
                if (err === null && result == 0) {
                    return callback(result);
                }
                timeoutLoop();
            });
        }, 1000)
    };

    registrationLoop(function() {
        timeoutLoop(function() {
            console.log('sleeping...');
            setTimeout(doStuff, 1000 * 60);
        });
    });
}

// Welcome!
console.log('Staring update loop: ' + new Date().toString());
doStuff();

