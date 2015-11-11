'use strict';
const should = require('chai').should();
const nock = require('nock');
const github = require('../lib/github');
const co = require('co');

describe('GitHub Client', function() {

  it('Should have the right headers', function() {
    nock('https://api.github.com')
      .matchHeader('Authorization', 'token oauth')
      .matchHeader('User-Agent', 'codehub-push')
      .get('/tests').reply(200);

    const client = new github.Client('oauth');
    return client.get('https://api.github.com/tests');
  });

  it('Should get notifications', co.wrap(function *() {
    nock('https://api.github.com').get('/notifications').reply(200, [{name: 'test'}]);
    const client = new github.Client('oauth');
    const ret = yield client.notifications();
    ret.should.have.length(1);
    ret[0].should.have.property('name').and.equals('test');
  }));

  it('Should get current user', co.wrap(function *() {
    nock('https://api.github.com').get('/user').reply(200, {name: 'test'});
    const client = new github.Client('oauth');
    const ret = yield client.currentUser();
    ret.should.have.property('name').and.equals('test');
  }));
});
