var config = require('../config');
var mysql = require('mysql');

var connectionPool = mysql.createPool({
    host: 'localhost',
    user: config.db.user,
    password: config.db.pass,
    database: 'codehub_push',
    timezone: 'Z'
});

exports.insertRegistration = function(token, auth, user, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);

        var callback = function(error, value) {
            connection.release();
            cb(error, value);
        };

        connection.query('select 1 from records where token = ? and oauth = ?', [token, auth], function(err, results) {
            if (err) return callback(err);
            if (results.length > 0) return callback(null, false);

            connection.query('insert into records (token, oauth, username) values (?, ?, ?)', [token, auth, user], function(err, results) {
                if (err) return callback(err);
                callback(null, true);
            });
        });
    });
};

exports.removeRegistration = function(token, auth, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);

        var callback = function(error, value) {
            connection.release();
            cb(error, value);
        };

        connection.query('delete from records where token = ? and oauth = ?', [token, auth], function(err, result) {
            if (err) return callback(err);
            callback(null, results.affectedRows > 0);
        });
    });
};


exports.getRegistrations = function(callback, resultCallback) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return callback(err);
        connection.query('select group_concat(token) as tokens, oauth, username, etag, updated_at from records group by oauth')
        .on('error', function(err) {
            callback(err);
        }).on('result', function(row) {
            resultCallback(row);
        }).on('end', function() {
            connection.release();
            callback(null);
        });
    });
};

exports.removeExpiredRegistration = function(token, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);
        var callback = function(error, value) {
            connection.release();
            cb(error, value);
        };

        connection.query('delete from records where token = ?', token, function(err, result) {
           if (err) return callback(err);
            callback(null, result.affectedRows > 0);
        });
    });
};

exports.isRegistered = function(token, oauth, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);
        var callback = function(error, value) {
            connection.release();
            cb(error, value);
        };

        connection.query('select 1 from records where token = ? and oauth = ?', [token, oauth], function(err, results) {
            if (err) return callback(err);
            callback(null, results.length > 0);
        });
    });
}

exports.updateEtagAndUpdatedAt = function(oauth, etag, updated_at, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);
        var callback = function(error, value) {
            connection.release();
            cb(error, value);
        };

        connection.query('update records set etag = ?, updated_at = ?', [etag, updated_at], function(err, result) {
            if (err) return callback(err);
            callback(null, result.affectedRows > 0);
        });
    });
};
