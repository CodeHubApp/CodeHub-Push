'use strict';
const pg = require('pg-promise')();
const fs = require('fs');
const path = require('path');
let db = null;

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
    const dbScript = fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8');
    return db.none(dbScript);
  },
  insertRegistration(token, auth, user) {
    return db.none('insert into records (token, oauth, username) values ($1, $2, $3) ' + 
      'on conflict (token, username) do update set oauth = excluded.oauth, ' + 
      'updated_at = (now() at time zone \'utc\')', [token, auth, user]);
  },
  removeRegistration(token, auth) {
    return db.query('delete from records where token = $1 and oauth = $2', [token, auth]);
  },
  getRegistrations() {
    return db.query('select array_agg(token) as tokens, oauth, username, max(updated_at) as ' +
      'updated_at from records group by oauth, username');
  },
  removeExpiredRegistration(token) {
    return db.query('delete from records where token = $1', [token]);
  },
  isRegistered(token, oauth) {
    return db.query('select 1 from records where token = $1 and oauth = $2', [token, oauth])
      .then(results => results.length > 0);
  },
  removeBadAuth(oauth, cb) {
    return db.query('delete from records where oauth = $1', [oauth]);
  },
  updateUpdatedAt(oauth) {
    return db.query('update records set updated_at = (now() at time zone \'utc\') where oauth = $1', [oauth]);
  }
}
