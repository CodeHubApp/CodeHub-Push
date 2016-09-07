"use strict";
const request = require('supertest-as-promised');
const nock = require('nock');
const should = require('chai').should();
const db = require('../lib/db');
const worker = require('../lib/worker');
const co = require('co');
const fs = require('fs');
const path = require('path');

describe('Worker', function() {
  beforeEach(() => db.load(':memory:').then(() => db.sync()));

  it('Should remove user on bad credentials', co.wrap(function *() {
    nock('https://api.github.com').get('/notifications').query(true).reply(401, { "message": "Bad credentials" });

    yield db.insertRegistration('token1', 'auth1', 'user1');
    const records = yield db.getRegistrations();
    records.should.have.length(1);

    let err;
    yield worker.processRecord(records[0], (tokens, msg, data) => {}).catch(e => err = e);

    err.should.be.an.instanceof(Error);
    err.message.should.equal('Bad credentials');
    const afterRecords = yield db.getRegistrations();
    afterRecords.should.have.length(0);
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

    yield db.insertRegistration('token1', 'auth1', 'user1');
    yield db.insertRegistration('token2', 'auth1', 'user1');

    const records = yield db.getRegistrations();
    records.should.have.length(1);

    let apnMessages = [];
    yield worker.processRecord(records[0], (tokens, msg, data) => apnMessages.push([tokens, msg, data]));

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
    yield db.insertRegistration('token1', 'auth1', 'user1');
    yield db.insertRegistration('token2', 'auth2', 'user2');

    const records = yield db.getRegistrations();
    records.should.have.length(2);

    let apnMessages = [];
    for (let i = 0; i < records.length; i++) {
      yield worker.processRecord(records[i], (tokens, msg, data) => apnMessages.push([tokens, msg, data])).catch(_ => {});
    }

    const afterRecords = yield db.getRegistrations();
    afterRecords.should.have.length(2);
    records[0].updated_at.should.not.equal(afterRecords[0].updated_at);
    records[1].updated_at.should.not.equal(afterRecords[1].updated_at);
  }));
});
