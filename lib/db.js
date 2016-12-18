'use strict';
const pg = require('pg-promise')();

const syncSql = () => `
CREATE TABLE IF NOT EXISTS records (
    id serial primary key,
    token varchar(128) NOT NULL,
    oauth varchar(64) NOT NULL,
    username varchar(64) NOT NULL,
    created_at timestamp with time zone default (now() at time zone 'utc'),
    updated_at timestamp with time zone default (now() at time zone 'utc'),
    UNIQUE (token, username)
);

CREATE INDEX oauth_idx ON records (oauth);
CREATE INDEX user_idx ON records (username);
`;

class Database {
  constructor() {
    this.db = pg({
      host: process.env.PGHOST || '127.0.0.1',
      database: process.env.PGDB || 'codehubpush',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT || 5432,
      ssl: false
    });
  }
  ping() {
    return this.db.any('select 1');
  }
  sync() {
    return this.db.none(syncSql());
  }
  insertRegistration(token, auth, user) {
    return this.db
      .none('insert into records (token, oauth, username) values ($1, $2, $3) ' +
        'on conflict (token, username) do update set oauth = excluded.oauth, ' +
        'updated_at = (now() at time zone \'utc\')', [token, auth, user])
      .then(() => {
        return this.db.none('update records set oauth = $1 where username = $2', [auth, user]);
      })
  }
  removeRegistration(token, auth) {
    return this.db.none('delete from records where token = $1 and oauth = $2', [token, auth]);
  }
  removeRegistrationByUser(token, user) {
    return this.db.none('delete from records where token = $1 and username = $2', [token, user]);
  }
  getRegistrations() {
    return this.db.any('select array_agg(token) as tokens, oauth, username, max(updated_at) as ' +
      'updated_at from records group by oauth, username');
  }
  removeExpiredRegistration(tokens) {
    return this.db.none('delete from records where token in ($1)', [tokens]);
  }
  removeBadAuth(oauth) {
    return this.db.none('delete from records where oauth = $1', [oauth]);
  }
  updateUpdatedAt(oauth) {
    return this.db.none('update records set updated_at = (now() at time zone \'utc\') where oauth = $1', [oauth]);
  }
}

module.exports = Database;
