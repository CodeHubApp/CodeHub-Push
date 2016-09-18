'use strict';
const pg = require('pg-promise')();
const path = require('path');
let db = null;

var dbScript = new pg.QueryFile(path.join(__dirname, 'database.sql'), {minify: true});

module.exports = {
  load(config) {
    db = pg({
      host: 'postgres',
      database: 'codehubpush',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD,
      ssl: false
    });
    return db.any('select 1');
  },
  sync() {
    return db.none(dbScript);
  },
  insertRegistration(token, auth, user) {
    return db.none('insert into records (token, oauth, username) values ($1, $2, $3) ' + 
      'on conflict (token, username) do update set oauth = excluded.oauth, ' + 
      'updated_at = (now() at time zone \'utc\')', [token, auth, user]);
  },
  removeRegistration(token, auth) {
    return db.none('delete from records where token = $1 and oauth = $2', [token, auth]);
  },
  getRegistrations() {
    return db.any('select array_agg(token) as tokens, oauth, username, max(updated_at) as ' +
      'updated_at from records group by oauth, username');
  },
  removeExpiredRegistration(token) {
    return db.none('delete from records where token = $1', [token]);
  },
  isRegistered(token, oauth) {
    return db.oneOrNone('select 1 from records where token = $1 and oauth = $2', [token, oauth], r => !!r);
  },
  removeBadAuth(oauth, cb) {
    return db.none('delete from records where oauth = $1', [oauth]);
  },
  updateUpdatedAt(oauth) {
    return db.none('update records set updated_at = (now() at time zone \'utc\') where oauth = $1', [oauth]);
  }
}
