"use strict";
const request = require('supertest-as-promised');
const nock = require('nock');
const should = require('chai').should();
const worker = require('../lib/worker');
const co = require('co');
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');

describe('Worker', function() {
  it('Should remove user on bad credentials', co.wrap(function *() {
    nock('https://api.github.com').get('/notifications').query(true).reply(401, { "message": "Bad credentials" });

    const getRegistrations = sinon.stub().returns(Promise.resolve([{
      tokens: ['1'],
      oauth: 'auth',
      username: 'moo',
      updated_at: new Date()
    }]));

    const updateUpdatedAt = sinon.stub().returns(Promise.resolve());
    const removeBadAuth = sinon.stub().returns(Promise.resolve());
    const db = { getRegistrations, updateUpdatedAt, removeBadAuth }

    const jobs = yield worker.processRecords(db, (tokens, msg, data) => {});

    getRegistrations.called.should.equal(true);
    removeBadAuth.called.should.equal(true);
    updateUpdatedAt.called.should.equal(true);
    jobs.should.equal(1);
  }));

  it('Should process registrations', co.wrap(function *() {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '/worker_data.json'), 'utf8'));
    for (let url in data) {
      if (url === '/notifications') {
        nock('https://api.github.com').get(url).query(true).reply(200, data[url]);
      } else {
        nock('https://api.github.com').get(url).reply(200, data[url]);
      }
    }

    const getRegistrations = sinon.stub().returns(Promise.resolve([{
      tokens: ['token1', 'token2'],
      oauth: 'auth',
      username: 'user1',
      updated_at: new Date()
    }]));

    const updateUpdatedAt = sinon.stub().returns(Promise.resolve());
    const db = { getRegistrations, updateUpdatedAt }

    let apnMessages = [];
    yield worker.processRecords(db, (tokens, msg, data) => {
      apnMessages.push([tokens, msg, data]);
      return Promise.resolve({});
    });

    apnMessages.should.have.length(6);
    apnMessages.forEach(x => x[0].should.have.length(2).and.contain('token1').and.contain('token2'));
    apnMessages.forEach(x => x[2].should.have.property('u').and.equal('user1'));

    apnMessages[0][1].should.equal('naveensrinivasan commented on pull request octokit/octokit.net#959');
    apnMessages[0][2].should.have.property('r').and.equal('octokit/octokit.net');
    apnMessages[0][2].should.have.property('p').and.equal('959');

    apnMessages[1][1].should.equal('shiftkey merged pull request octokit/octokit.net#807');
    apnMessages[1][2].should.have.property('r').and.equal('octokit/octokit.net');
    apnMessages[1][2].should.have.property('p').and.equal('807');

    apnMessages[2][1].should.equal('shiftkey closed issue octokit/octokit.net#423');
    apnMessages[2][2].should.have.property('r').and.equal('octokit/octokit.net');
    apnMessages[2][2].should.have.property('i').and.equal('423');

    apnMessages[3][1].should.equal('shiftkey closed pull request octokit/octokit.net#935');
    apnMessages[3][2].should.have.property('r').and.equal('octokit/octokit.net');
    apnMessages[3][2].should.have.property('p').and.equal('935');

    apnMessages[4][1].should.equal('dillonb123 commented on commit thedillonb/TestTestTest@fffb24');
    apnMessages[4][2].should.have.property('r').and.equal('thedillonb/TestTestTest');
    apnMessages[4][2].should.have.property('c').and.equal('fffb244af01b360d6c3a055ade39f44cf3e82cf7');

    apnMessages[5][1].should.equal('dillonb123 mentioned you on commit thedillonb/TestTestTest@cd9fdc');
    apnMessages[5][2].should.have.property('r').and.equal('thedillonb/TestTestTest');
    apnMessages[5][2].should.have.property('c').and.equal('cd9fdc3eb74bfea3900913e9cf39ca9eb0ed1d66');
  }));

  it('Should update time on error', co.wrap(function *() {
    const getRegistrations = sinon.stub().returns(Promise.resolve([{
      tokens: ['token1'],
      oauth: 'auth1',
      username: 'user1',
      updated_at: new Date()
    }, {
      tokens: ['token2'],
      oauth: 'auth2',
      username: 'user2',
      updated_at: new Date()
    }]));

    const updateUpdatedAt = sinon.stub().returns(Promise.resolve());
    const db = { getRegistrations, updateUpdatedAt }

    const records = yield db.getRegistrations();
    records.should.have.length(2);

    let apnMessages = [];
    yield worker.processRecords(db, (tokens, msg, data) => apnMessages.push([tokens, msg, data])).catch(_ => {});
    updateUpdatedAt.callCount.should.equal(2);
  }));

  it('Should remove user on expired device', co.wrap(function *() {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '/worker_data.json'), 'utf8'));
    for (let url in data) {
      if (url === '/notifications') {
        nock('https://api.github.com').get(url).query(true).reply(200, data[url]);
      } else {
        nock('https://api.github.com').get(url).reply(200, data[url]);
      }
    }

    const getRegistrations = sinon.stub().returns(Promise.resolve([{
      tokens: ['1'],
      oauth: 'auth',
      username: 'moo',
      updated_at: new Date()
    }]));

    const updateUpdatedAt = sinon.stub().returns(Promise.resolve());
    const removeExpiredRegistration = sinon.stub().returns(Promise.resolve());
    const db = { getRegistrations, updateUpdatedAt, removeExpiredRegistration }

    const jobs = yield worker.processRecords(db, (tokens, msg, data) => {
      return Promise.resolve({
        failed: [{
          device: '1',
          status: 410
        }]
      })
    });

    getRegistrations.called.should.equal(true);
    removeExpiredRegistration.called.should.equal(true);
    updateUpdatedAt.called.should.equal(true);
    jobs.should.equal(1);
  }));
});
