'use strict';
const pg = require('pg-promise')();
const fs = require('fs');
const path = require('path');
const co = require('co');
let db = null;

exports.load = function(cn) {
  return new Promise((res) => {
    db = pg(cn);
    res(db);
  });
};

exports.sync = co.wrap(function *(destroy) {
  if (destroy) {
    yield db.query('drop table if exists records');
  }

  const qf = new pg.QueryFile(path.join(__dirname, 'database.sql'));
  return yield db.query(qf).then(a => a, err => { });
});

exports.insertRegistration = function(token, auth, user) {
  return db
    .none('select * from records where token=$1 and oauth=$2', [token, auth])
    .then(() => db.one('insert into records (token, oauth, username) values ($1, $2, $3) returning id', [token, auth, user]), err => {});
};

exports.removeRegistration = function(token, auth) {
  return db.query('delete from records where token=$1 and oauth=$2', [token, auth]);
};

exports.getRegistrations = function() {
  return db.query('select string_agg(token, \',\') tokens, min(oauth) oauth, min(username) username, max(updated_at) updated_at from records group by oauth');
};

exports.removeExpiredRegistration = function(token) {
  return db.none('delete from records where token=$1', [token]);
};

exports.isRegistered = function(token, oauth) {
  return db.query('select 1 from records where token=$1 and oauth=$2', [token, oauth])
    .then(data => data.length > 0 ? true : false);
};

exports.removeBadAuth = function(oauth) {
  return db.none('delete from records where oauth=$1', [oauth]);
};

exports.updateUpdatedAt = function(oauth) {
  return db.query('update records set updated_at=now() where oauth=$1', [oauth]);
};
