var config = require('../config');
var mysql = require('mysql');

var connectionPool = mysql.createPool({
    host: 'localhost',
    user: config.db.user,
    password: config.db.pass,
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

exports.totalNumberOfRecords = function(cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);
        var callback = function(error, value) {
            connection.release();
            return cb(error, value);
        };

        connection.query('select count(*) as c from records', function(err, result) {
            if (err) return callback(err);
            callback(null, result[0].c);
        });
    });
};

function runQuery(sql, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);
        var callback = function(error, value) {
            connection.release();
            return cb(error, value);
        };

        connection.query(sql, function(err, result) {
            if (err) return callback(err);
            callback(null, result);
        });
    });
}


exports.logUpdateCycle = function(start, stop, tasks, cb) {
    connectionPool.getConnection(function(err, connection) {
        if (err) return cb(err);
        var callback = function(error, value) {
            connection.release();
            return cb(error, value);
        };

        connection.query('replace into update_cycles set row_id = (SELECT COALESCE(MAX(id), 0) % 1440 + 1 FROM update_cycles as t), started_at = ?, ended_at = ?, tasks = ?', [start, stop, tasks], function(err, result) {
            if (err) return callback(err);
            callback(null, result.affectedRows > 0);
        });
    });
};

exports.getUpdateCycles = function(cb) {
    runQuery('select FROM_UNIXTIME(UNIX_TIMESTAMP(started_at) - MOD(UNIX_TIMESTAMP(started_at), 600)) as started_at, AVG(TIMEDIFF(ended_at, started_at)) as time from update_cycles ' +
             'group by DATE(started_at), HOUR(started_at), FLOOR(MINUTE(started_at) / 10)', cb);
};

exports.getLastUpdateCycle = function(cb) {
    runQuery('select * from update_cycles order by started_at desc limit 1', cb);
};