'use strict';
const request = require('supertest-as-promised');
const should = require('chai').should();
const nock = require('nock');
const app = require('../lib/app');
const co = require('co');
const winston = require('winston');
const sinon = require('sinon');

describe('App', function() {
  winston.level = 'fatal';

  it('Should register a user', co.wrap(function *() {
    nock('https://api.github.com').get('/notifications').reply(200);
    nock('https://api.github.com').get('/user').reply(200, { login: 'moo' });
    const body = { token: 'moo', oauth: 'cow' };
    const isRegistered = sinon.stub().returns(Promise.resolve(false));
    const insertRegistration = sinon.stub().returns(Promise.resolve());
    const server = app({ isRegistered, insertRegistration });
    yield request(server).post('/register').send(body).expect(200);
    insertRegistration.called.should.equal(true);
  }));

  it('Should unregister a user', co.wrap(function *() {
    const removeRegistration = sinon.stub().returns(Promise.resolve());
    const server = app({ removeRegistration});
    yield request(server).post('/unregister').send({ token: 'token', oauth: 'oauth' }).expect(200);
    removeRegistration.called.should.equal(true);
    removeRegistration.getCall(0).args[0].should.equal('token');
    removeRegistration.getCall(0).args[1].should.equal('oauth');
  }));

  it('Should not register a user due to valdation', co.wrap(function *() {
    const server = app();
    yield request(server).post('/register').send({}).expect(401);
    yield request(server).post('/register').send({ token: 'something' }).expect(401);
    yield request(server).post('/register').send({ oauth: 'something' }).expect(401);
  }));
});
