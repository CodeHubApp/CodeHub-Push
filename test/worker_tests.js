const nock = require('nock');
const worker = require('../lib/worker');
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const { expect } = require('chai');

describe('Worker', () => {
  it('Should remove user on bad credentials', async () => {
    nock('https://api.github.com')
      .get('/notifications')
      .query(true)
      .reply(401, { message: 'Bad credentials' });

    const getRegistrations = sinon.stub().returns(
      Promise.resolve([
        {
          tokens: ['1'],
          oauth: 'auth',
          username: 'moo',
          updated_at: new Date()
        }
      ])
    );

    const updateUpdatedAt = sinon.stub().returns(Promise.resolve());
    const removeBadAuth = sinon.stub().returns(Promise.resolve());
    const db = { getRegistrations, updateUpdatedAt, removeBadAuth };

    const jobs = await worker.processRecords(db, () => {});

    expect(getRegistrations.called).to.equal(true);
    expect(removeBadAuth.called).to.equal(true);
    expect(updateUpdatedAt.called).to.equal(true);
    expect(jobs).to.equal(1);
  });

  it('Should process registrations', async () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '/worker_data.json'), 'utf8'));
    for (const url of Object.keys(data)) {
      if (url === '/notifications') {
        nock('https://api.github.com')
          .get(url)
          .query(true)
          .reply(200, data[url]);
      } else {
        nock('https://api.github.com')
          .get(url)
          .reply(200, data[url]);
      }
    }

    const getRegistrations = sinon.stub().returns(
      Promise.resolve([
        {
          tokens: ['token1', 'token2'],
          oauth: 'auth',
          username: 'user1',
          updated_at: new Date()
        }
      ])
    );

    const updateUpdatedAt = sinon.stub().returns(Promise.resolve());
    const db = { getRegistrations, updateUpdatedAt };

    const apnMessages = [];
    await worker.processRecords(db, (tokens, msg, dat) => {
      apnMessages.push([tokens, msg, dat]);
      return Promise.resolve({});
    });

    expect(apnMessages).to.have.length(6);
    apnMessages.forEach(x => {
      expect(x[0])
        .to.have.length(2)
        .and.contain('token1')
        .and.contain('token2');

      expect(x[2])
        .to.have.property('u')
        .and.equal('user1');
    });

    expect(apnMessages[0][1]).to.equal('naveensrinivasan commented on pull request octokit/octokit.net#959');
    expect(apnMessages[0][2])
      .to.have.property('r')
      .and.equal('octokit/octokit.net');
    expect(apnMessages[0][2])
      .to.have.property('p')
      .and.equal('959');

    expect(apnMessages[1][1]).to.equal('shiftkey merged pull request octokit/octokit.net#807');
    expect(apnMessages[1][2])
      .to.have.property('r')
      .and.equal('octokit/octokit.net');
    expect(apnMessages[1][2])
      .to.have.property('p')
      .and.equal('807');

    expect(apnMessages[2][1]).to.equal('shiftkey closed issue octokit/octokit.net#423');
    expect(apnMessages[2][2])
      .to.have.property('r')
      .and.equal('octokit/octokit.net');
    expect(apnMessages[2][2])
      .to.have.property('i')
      .and.equal('423');

    expect(apnMessages[3][1]).to.equal('shiftkey closed pull request octokit/octokit.net#935');
    expect(apnMessages[3][2])
      .to.have.property('r')
      .and.equal('octokit/octokit.net');
    expect(apnMessages[3][2])
      .to.have.property('p')
      .and.equal('935');

    expect(apnMessages[4][1]).to.equal('dillonb123 commented on commit thedillonb/TestTestTest@fffb24');
    expect(apnMessages[4][2])
      .to.have.property('r')
      .and.equal('thedillonb/TestTestTest');
    expect(apnMessages[4][2])
      .to.have.property('c')
      .and.equal('fffb244af01b360d6c3a055ade39f44cf3e82cf7');

    expect(apnMessages[5][1]).to.equal('dillonb123 mentioned you on commit thedillonb/TestTestTest@cd9fdc');
    expect(apnMessages[5][2])
      .to.have.property('r')
      .and.equal('thedillonb/TestTestTest');
    expect(apnMessages[5][2])
      .to.have.property('c')
      .and.equal('cd9fdc3eb74bfea3900913e9cf39ca9eb0ed1d66');
  });

  it('Should update time on error', async () => {
    const getRegistrations = sinon.stub().returns(
      Promise.resolve([
        {
          tokens: ['token1'],
          oauth: 'auth1',
          username: 'user1',
          updated_at: new Date()
        },
        {
          tokens: ['token2'],
          oauth: 'auth2',
          username: 'user2',
          updated_at: new Date()
        }
      ])
    );

    const updateUpdatedAt = sinon.stub().returns(Promise.resolve());
    const db = { getRegistrations, updateUpdatedAt };

    const records = await db.getRegistrations();
    expect(records).to.have.length(2);

    const apnMessages = [];
    await worker.processRecords(db, (tokens, msg, data) => apnMessages.push([tokens, msg, data])).catch(() => {});
    expect(updateUpdatedAt.callCount).to.equal(2);
  });

  it('Should remove user on expired device', async () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '/worker_data.json'), 'utf8'));
    for (const url in data) {
      if (url === '/notifications') {
        nock('https://api.github.com')
          .get(url)
          .query(true)
          .reply(200, data[url]);
      } else {
        nock('https://api.github.com')
          .get(url)
          .reply(200, data[url]);
      }
    }

    const getRegistrations = sinon.stub().returns(
      Promise.resolve([
        {
          tokens: ['1'],
          oauth: 'auth',
          username: 'moo',
          updated_at: new Date()
        }
      ])
    );

    const updateUpdatedAt = sinon.stub().returns(Promise.resolve());
    const removeExpiredRegistration = sinon.stub().returns(Promise.resolve());
    const db = { getRegistrations, updateUpdatedAt, removeExpiredRegistration };

    const jobs = await worker.processRecords(db, () =>
      Promise.resolve({
        failed: [
          {
            device: '1',
            status: '410'
          }
        ]
      })
    );

    expect(getRegistrations.called).to.equal(true);
    expect(removeExpiredRegistration.called).to.equal(true);
    expect(updateUpdatedAt.called).to.equal(true);
    expect(jobs).to.equal(1);
  });
});
