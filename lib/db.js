var mysql = require('mysql');

var connectionPool = mysql.createPool({
    host: 'localhost',
    user: process.env['DBUSER'],
    password: process.env['DBPASS'],
    database: 'codehub_push',
    timezone: 'Z'
});

exports.insertRegistration = function(token, auth, user, domain, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);

        var callback = function(error, value) {
            connection.release();
            cb(error, value);
        };

        connection.query('select 1 from records where token = ? and oauth = ? and domain = ?', [token, auth, domain], function(err, results) {
            if (err) return callback(err);
            if (results.length > 0) return callback(null, false);
            var updated_at = new Date();

            connection.query('insert into records (token, oauth, username, domain, updated_at) values (?, ?, ?, ?, ?)', [token, auth, user, domain, updated_at], function(err, results) {
                if (err) return callback(err);
                callback(null, results.affectedRows > 0);
            });
        });
    });
};

exports.removeRegistration = function(token, auth, domain, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);

        var callback = function(error, value) {
            connection.release();
            return cb(error, value);
        };
        
        connection.query('delete from records where token = ? and oauth = ? and domain = ?', [token, auth, domain], function(err, results) {
            if (err) return callback(err);
            callback(null, results.affectedRows > 0);
        });
    });
};


exports.getRegistrations = function(callback, resultCallback) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return callback(err);
        connection.query('select group_concat(token) as tokens, oauth, domain, username, updated_at from records group by oauth, domain')
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
            return cb(error, value);
        };

        connection.query('delete from records where token = ?', token, function(err, result) {
            if (err) return callback(err);
            callback(null, result.affectedRows > 0);
        });
    });
};

exports.isRegistered = function(token, oauth, domain, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);
        var callback = function(error, value) {
            connection.release();
            return cb(error, value);
        };

        connection.query('select 1 from records where token = ? and oauth = ? and domain = ?', [token, oauth, domain], function(err, results) {
            if (err) return callback(err);
            callback(null, results.length > 0);
        });
    });
};

exports.removeBadAuth = function(oauth, domain, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);
        var callback = function(error, value) {
            connection.release();
            return cb(error, value);
        };

        connection.query('delete from records where oauth = ? and domain = ?', [oauth, domain], function(err, result) {
            if (err) return callback(err);
            callback(null, result.affectedRows > 0);
        });
    });
}

exports.updateUpdatedAt = function(oauth, domain, updated_at, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);
        var callback = function(error, value) {
            connection.release();
            return cb(error, value);
        };

        connection.query('update records set updated_at = ? where oauth = ? and domain = ?', [updated_at, oauth, domain], function(err, result) {
            if (err) return callback(err);
            callback(null, result.affectedRows > 0);
        });
    });
};
