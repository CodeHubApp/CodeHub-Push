var  _       = require('underscore'),
    async   = require('async'),
    db      = require('../lib/db'),
    config  = require('../config'),
    github  = require('../lib/github'),
    misc    = require('../lib/misc'),
    apn     = require('../lib/apn');

var push = new apn.Push();

/**
 * Process a record
 * @param row The row in the database
 * @param callback The
 */
function processRecord(record, callback) {
    var client = new github.Client(record.domain, record.oauth, record.username);

    // Convert the date object in the database
    var updatedDate = Date.parse(record.updated_at);
    if (isNaN(updatedDate)) {
        updatedDate = new Date(0);
    } else {
        updatedDate = new Date(updatedDate);
    }

    misc.processRegistration(client, updatedDate, function(err, lastModified, results) {
        if (err) {
            console.error('Error procesing registrations: %s - %s', err, err.stack);
            if (err.message === 'Bad credentials') {
                console.error('Removing %s at %s for bad credentials', record.oauth, record.domain);
                return db.removeBadAuth(record.oauth, record.domain, function() {
                    callback();
                });
            }
            else {
                results = [];
                lastModified = new Date();
            }
        }

        if (results === undefined || results.length == 0) {
            console.log('No notifications for %s', record.username);
        } else {
            _.each(results, function(result) {
                //console.log('pushing to %s: %s', record.tokens, result.msg);
                push.send(record.tokens.split(','), result.msg, result.data);
            });
        }

        db.updateUpdatedAt(record.oauth, record.domain, lastModified, function(err) {
            if (err) console.error(err);
            callback();
        });
    });
}


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
            tasks.push(function(callback) { processRecord(row, callback); });
        });
}

var main = function() {
    var timeStart = new Date();
    console.log('Staring update loop at %s', timeStart.toString());
    registrationLoop(function(tasks) {
        console.log('There are %s tasks to complete...', tasks.length);
        async.parallelLimit(tasks, 5, function() {
            var timeEnd = new Date();
            var diff = timeEnd - timeStart;
            console.log('%s tasks complete in %s minutes', tasks.length, (diff / 1000 / 60).toFixed(2));
            setTimeout(main, 1000 * 60);
        })
    });
}

// Welcome!
main();

