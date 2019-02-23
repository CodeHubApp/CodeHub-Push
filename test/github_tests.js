const nock = require('nock');
const { expect } = require('chai');
const github = require('../lib/github');

describe('GitHub Client', () => {
  it('Should have the right headers', () => {
    nock('https://api.github.com')
      .matchHeader('Authorization', 'token oauth')
      .matchHeader('User-Agent', 'codehub-push')
      .get('/tests')
      .reply(200);

    const client = new github.Client('oauth');
    return client.get('https://api.github.com/tests');
  });

  it('Should get notifications', async () => {
    nock('https://api.github.com')
      .get('/notifications')
      .reply(200, [{ name: 'test' }]);
    const client = new github.Client('oauth');
    const ret = await client.notifications();
    expect(ret).to.have.length(1);
    expect(ret[0])
      .to.have.property('name')
      .and.equals('test');
  });

  it('Should get current user', async () => {
    nock('https://api.github.com')
      .get('/user')
      .reply(200, { name: 'test' });
    const client = new github.Client('oauth');
    const ret = await client.currentUser();
    expect(ret)
      .to.have.property('name')
      .and.equals('test');
  });
});
