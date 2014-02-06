var  _       = require('underscore'),
    async   = require('async'),
    db      = require('../lib/db'),
    config  = require('../config'),
    misc    = require('../lib/misc'),
    apn     = require('../lib/apn');

var push = new apn.Push();

function registrationLoop(callback) {
    var tasks = [];
    db.getRegistrations(
        function(err) {
            if (err) {
                console.error(err)
            } else {
                callback(tasks);
            }
        },
        function(row) {
            tasks.push(function(callback) {
                misc.processRegistration(row.oauth, row.etag, new Date(Date.parse(row.updated_at)), row.username, function(err, newEtag, updated_at, results) {
                    if (err) return callback();
                    if (results === undefined || results.length == 0) return callback();

                    for (var i = 0; i < results.length; i++) {
                        push.send(row.tokens.split(','), results[i].msg, results[i].data);
                    }

                    db.updateEtagAndUpdatedAt(row.oauth, row.etag, updated_at, function() {
                        callback();
                    });
                });
            });
        });
}

var doStuff = function() {
    console.log('Staring update loop: ' + new Date().toString());
    registrationLoop(function(tasks) {
        async.parallelLimit(tasks, 5, function() {
            setTimeout(doStuff, 1000 * 60);
        })
    });
}

// Welcome!
doStuff();

