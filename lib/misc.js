var github = require('./github'),
    _      = require('underscore'),
    time   = require('time'),
    async  = require('async');

/*
 Process a registration by grabbing the notifications for it
 then we'll process the notifications & save the registration with the updated
 etag in parallel to save some time
 */
module.exports.processRegistration = function(oauth, etag, updated_at, username, callback) {
    github.notifications(oauth, etag, function(err, results, newEtag) {
        if (err) return callback(err);
        if (newEtag === etag) return callback(null);

	console.log('results before: ' + results.length);
        results = _.reject(results, function(i) { return new Date(i.updated_at) < updated_at; })
	console.log('results after: ' + results.length);

        var tasks = _.map(results, function(entry) {
            return function(callback) {
                github.process(oauth, updated_at, entry, function(err, msg, data) {
                    if (err) return callback(err);
                    if (msg === undefined) return callback(new Error('no message'));

                    callback(null, {
                        msg: msg,
                        data: _.extend({u: username, r: entry.repository.full_name}, data)
                    });
                });
            };
        });

        // Do all the tasks, in series though and if one fails then stop processing!
        // We don't want to attack GitHub with requests that ultimiately fail somehow.
        var date = new Date();
        async.series(tasks, function(err, results) {
            if (err) return callback(err);
            callback(null, newEtag, date, results);
        });
    });
};
