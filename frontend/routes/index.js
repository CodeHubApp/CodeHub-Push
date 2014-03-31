var db = require('../../lib/db')
  , _ = require('underscore')
  , moment = require('moment')
  , async = require('async');

exports.registration = require('./registration');

exports.index = function(req, res) {
    async.parallel({
        'totalNumberOfRecords': function(callback) {
            db.totalNumberOfRecords(callback);
        },
        'update_cycle': function(callback) {
            db.getUpdateCycles(callback);
        },
        'last_update_cycle': function(callback) {
            db.getLastUpdateCycle(function(err, result) {
                if (err) return callback(err);
                callback(null, {
                    ended_at: result[0].ended_at,
                    duration: Date.parse(result[0].ended_at) - Date.parse(result[0].started_at),
                    tasks: result[0].tasks
                });
            })
        }

    }, function(err, results) {
        if (err) return res.send(500);
        res.render('index', {
            stats: {
                user_count: [[0, 0], [1, 5], [2, 10], [3, 20], [4, 15], [5, 30], [6, 34]],
                cycle_durations: _.map(results.update_cycle, function(i) { return [Date.parse(i.started_at), i.time] }),
                last_update_cycle: moment(results.last_update_cycle.ended_at).fromNow(),
                last_update_cycle_duration: results.last_update_cycle.duration,
                last_update_cycle_tasks: results.last_update_cycle.tasks,
                total_records: results.totalNumberOfRecords
            }
        });
    });
}

exports.features = function(req, res) {
    res.json(200, [
        'com.dillonbuchanan.codehub.push'
    ]);
};