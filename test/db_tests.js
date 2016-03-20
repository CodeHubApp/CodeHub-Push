'use strict';
const request = require('supertest-as-promised');
const should = require('chai').should();
const db = require('../lib/db');
const co = require('co');

describe('Database', function() {
  beforeEach(() => db.load('postgresql://codehub_push_dev:dev@localhost/codehub_push').then(() => db.sync(true)));

  it('Should list the registrations', co.wrap(function *() {
    yield db.insertRegistration('token1', 'auth1', 'user1');
    yield db.insertRegistration('token2', 'auth2', 'user2');
    const registrations = yield db.getRegistrations();
    registrations.should.have.length(2);
    registrations[0].updated_at.should.be.an.instanceof(Date);
    registrations[1].updated_at.should.be.an.instanceof(Date);
  }));

  it('Should aggregate tokens for single user', co.wrap(function *() {
    yield db.insertRegistration('token1', 'auth1', 'user1');
    yield db.insertRegistration('token2', 'auth1', 'user1');
    const registrations = yield db.getRegistrations();
    registrations.should.have.length(1);
    registrations[0].tokens.should.equal('token1,token2');
  }));

  it('Should remove expired devices', co.wrap(function *() {
    yield db.insertRegistration('token1', 'auth1', 'user1');
    yield db.insertRegistration('token2', 'auth2', 'user2');
    yield db.removeExpiredRegistration('token1');
    yield db.removeExpiredRegistration('something wrong');
    const registrations = yield db.getRegistrations();
    registrations.should.have.length(1);
    registrations[0].tokens.should.equal('token2');
    registrations[0].oauth.should.equal('auth2');
  }));
});
