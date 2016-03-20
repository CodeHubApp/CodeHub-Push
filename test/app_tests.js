'use strict';
const request = require('supertest-as-promised');
const nock = require('nock');
const db = require('../lib/db');
const app = require('../lib/app');
const co = require('co');
const winston = require('winston');

describe('App', function() {
  winston.level = 'fatal';
  before(() => db.load('postgresql://codehub_push_dev:dev@localhost/codehub_push').then(() => db.sync(true)));

  function registerUser(token, oauth) {
    nock('https://api.github.com').get('/notifications').reply(200);
    nock('https://api.github.com').get('/user').reply(200, { login: 'moo' });
    const body = { token: token, oauth: oauth };
    return request(app).post('/register').send(body).expect(200);
  }

  it('Should register and unregister a user', co.wrap(function *() {
    yield registerUser('test1', 'test1');
    yield request(app).post('/registered').send({ token: 'test1', oauth: 'test1' }).expect(200);
    yield request(app).get('/registered?token=test1&oauth=test1').expect(200);
  }));

  it('Should unregister a user', co.wrap(function *() {
    yield registerUser('test2', 'test2');
    yield request(app).post('/unregister').send({ token: 'test2', oauth: 'test2' }).expect(200);
    yield request(app).get('/registered?token=test2&oauth=test2').expect(404);
  }));

  it('Should not register a user due to valdation', co.wrap(function *() {
    yield request(app).post('/register').send({}).expect(401);
    yield request(app).post('/register').send({ token: 'something' }).expect(401);
    yield request(app).post('/register').send({ oauth: 'something' }).expect(401);
  }));

  it('Should not find this user', co.wrap(function *() {
    yield request(app).post('/registered').send({ token: 'moo', oauth: 'moo' }).expect(404);
    yield request(app).get('/registered?token=moo&oauth=moo').expect(404);
  }));

  it('Should not find due to validation', co.wrap(function *() {
    yield request(app).post('/registered').send({ }).expect(401);
    yield request(app).post('/registered').send({ token: 'moo' }).expect(401);
    yield request(app).post('/registered').send({ oauth: 'moo' }).expect(401);
  }));
});
