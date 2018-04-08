const request = require('supertest');
const nock = require('nock');
const app = require('../lib/app');
const winston = require('winston');
const sinon = require('sinon');
const { expect } = require('chai');

describe('App', () => {
  winston.level = 'fatal';

  it('Should register a user', async () => {
    nock('https://api.github.com')
      .get('/notifications')
      .reply(200);
    nock('https://api.github.com')
      .get('/user')
      .reply(200, { login: 'moo' });
    const body = { token: 'moo', oauth: 'cow' };
    const insertRegistration = sinon.stub().returns(Promise.resolve());
    const server = app({ insertRegistration });
    await request(server)
      .post('/register')
      .send(body)
      .expect(200);
    expect(insertRegistration.called).to.equal(true);
  });

  it('Should unregister a user', async () => {
    const removeRegistration = sinon.stub().returns(Promise.resolve());
    const server = app({ removeRegistration });
    await request(server)
      .post('/unregister')
      .send({ token: 'token', oauth: 'oauth' })
      .expect(200);
    expect(removeRegistration.called).to.equal(true);
    expect(removeRegistration.getCall(0).args[0]).to.equal('token');
    expect(removeRegistration.getCall(0).args[1]).to.equal('oauth');
  });

  it('Should not register a user due to valdation', async () => {
    const server = app();
    await request(server)
      .post('/register')
      .send({})
      .expect(401);
    await request(server)
      .post('/register')
      .send({ token: 'something' })
      .expect(401);
    await request(server)
      .post('/register')
      .send({ oauth: 'something' })
      .expect(401);
  });
});
