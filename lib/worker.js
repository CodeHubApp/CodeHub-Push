'use strict';
const { Client, HttpError } = require('./github');
const db = require('./db');
const co = require('co');
const async = require('async');
const logger = require('winston');

function* processNotification(client, username, notification, sendApn) {
  const subjectType = notification.subject.type.toLowerCase();
  const lastCommentUrl = notification.subject.latest_comment_url;
  const subjectUrl = notification.subject.url;
  const stateChange = subjectUrl === lastCommentUrl;
  const repositoryName = notification.repository.full_name;
  const data = { 'u': username, 'r': repositoryName };
  let comment = {};

  // If there is no comment then this user probably opened the item
  if (lastCommentUrl) {
    comment = yield client.get(lastCommentUrl);
  } else if (subjectUrl) {
    comment = yield client.get(notification.subject.url);
  } else {
    console.error(`Unable to locate URL for notification: ${notification}`);
    return;
  }    

  let msg = '';

  if (subjectType === 'release') {
    msg = `${comment.author.login} released ${notification.subject.title}`;
  }
  else if (subjectType === 'commit') {
    if (stateChange) {
      msg = `${comment.author.login} mentioned you on commit ${repositoryName}@${comment.sha.substring(0, 6)}`;
      data['c'] = comment.sha;
    }
    else {
      msg = `${comment.user.login} commented on commit ${repositoryName}@${comment.commit_id.substring(0, 6)}`;
      data['c'] = comment.commit_id;
    }
  }
  else if (subjectType === 'issue' || subjectType === 'pullrequest') {
    // If the two urls are the same then it's most likely that someone
    // just created the notification. If they're different it's most likely a comment
    const isPullRequest = subjectType === 'pullrequest';
    const num = notification.subject.url.substring(notification.subject.url.lastIndexOf('/') + 1);
    const shortNum = num.substring(0, 6);

    if (stateChange) {
      if (isPullRequest) {
        // Three things could have happened: open, close, merged
        if (comment.merged_at) {
          msg = `${comment.merged_by.login} merged `;
        }
        else if (comment.closed_at) {
          const issue = yield client.get(comment.issue_url);
          msg = `${issue.closed_by.login} closed `;
        }
        else {
          msg = `${comment.user.login} opened `;
        }
      }
      else {
        if (comment.closed_at) {
          msg = `${comment.closed_by.login} closed `;
        }
        else {
          msg = `${comment.user.login} opened `;
        }
      }
    }
    else {
      msg = `${comment.user.login} commented on `;
    }

    data[subjectType.substring(0, 1)] = num;
    msg += `${(isPullRequest ? 'pull request' : 'issue')} ${repositoryName}#${shortNum}`;
  }
  else {
    return logger.error(`No support for subject type ${subjectType}`)
  }

  sendApn(msg, data);
};

function * processRecord(record, sendApn) {
  const client = new Client(record.oauth);
  const tokens = record.tokens.split(',');

  try {
    const notifications = yield client.notifications(record.updated_at);
    for (let i = 0; i < notifications.length; i++) {
      yield processNotification(client, record.username, notifications[i], (msg, data) => sendApn(tokens, msg, data));
    }
  }
  catch (err) {
    if (err instanceof HttpError) {
      if (err.statusCode === 401 || err.statusCode === 403) {
        yield db.removeBadAuth(record.oauth, record.domain);
        return;
      }
    }
    throw err;
  }
  finally {
    yield db.updateUpdatedAt(record.oauth);
  }
};

function * processAllRecords(sendApn) {
  const registrations = yield db.getRegistrations();
  const tasks = registrations.map(x => function(callback) {
    return co(processRecord(x, sendApn))
      .catch(err => logger.error(`Unable to process record ${x.username}`, err))
      .then(() => callback());
  });

  const totalTasks = tasks.length;
  const parallelProcessing = new Promise(function(resolve, reject) {
    async.parallelLimit(tasks, 3, err => err ? reject(err) : resolve());
  });

  yield parallelProcessing.catch(e => logger.error('Error during parallel record processing', e));
  return totalTasks;
};

exports.processRecord = co.wrap(processRecord);
exports.processAllRecords = co.wrap(processAllRecords);
