'use strict';
const sqlite3 = require('sqlite3');
const fs = require('fs');
const path = require('path');
let db = null;

exports.load = function(type) {
  return new Promise(function(resolve, reject) {
    db = new sqlite3.Database(type, function(err) {
      if (err) return reject(err);

      db.configure('busyTimeout', 5000);
      resolve(db);
    });
  });
};

exports.sync = function() {
  return new Promise((resolve, reject) =>
    db.run(fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8'), err => err ? reject(err) : resolve()));
};

exports.insertRegistration = function(token, auth, user) {
  return new Promise(function(resolve, reject) {
    db.get('select * from records where token = ? and oauth = ?', [token, auth],
      (err, row) => err ? reject(err) : resolve(row));
  })
  .then(function(row){
    if (row) return false;
    return new Promise(function(resolve, reject) {
      db.run('insert into records (token, oauth, username) values (?, ?, ?)', [token, auth, user],
        function(err) { err ? reject(err) : resolve(!!this.lastID); });
    });
  });
};

exports.removeRegistration = function(token, auth) {
  return new Promise(function(resolve, reject) {
    db.run('delete from records where token = ? and oauth = ?', [token, auth],
      function(err) { err ? reject(err) : resolve(this.changes); });
  });
};

exports.getRegistrations = function() {
  const select = 'select group_concat(token) as tokens, oauth, username, updated_at from records group by oauth';
  return new Promise(function(resolve, reject) {
    db.all(select, (err, rows) => err ? reject(err) : resolve(rows));
  })
  .then(x => x.map(y => {
    y.updated_at = new Date(y.updated_at * 1000);
    return y;
  }));
};

exports.removeExpiredRegistration = function(token) {
  return new Promise(function(resolve, reject) {
    db.run('delete from records where token = ?', [token],
      function(err) { err ? reject(err) : resolve(this.changes); });
  });
};

exports.isRegistered = function(token, oauth) {
  return new Promise(function(resolve, reject) {
    db.get('select 1 from records where token = ? and oauth = ?', [token, oauth],
      (err, row) => err ? reject(err) : resolve(!!row));
  });
};

exports.removeBadAuth = function(oauth, cb) {
  return new Promise(function(resolve, reject) {
    db.run('delete from records where oauth = ?', [oauth],
      function(err) { err ? reject(err) : resolve(this.changes); });
  });
}

exports.updateUpdatedAt = function(oauth) {
  return new Promise(function(resolve, reject) {
    db.run("update records set updated_at = (cast(strftime('%s','now') as int)) where oauth = ?", [oauth],
      function(err) { err ? reject(err) : resolve(this.changes); });
  });
};
