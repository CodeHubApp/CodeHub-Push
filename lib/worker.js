const async = require('async');
const logger = require('winston');
const { Client, HttpError } = require('./github');

async function processNotification(client, username, notification, sendApn) {
  const subjectType = notification.subject.type.toLowerCase();
  const lastCommentUrl = notification.subject.latest_comment_url;
  const subjectUrl = notification.subject.url;
  const stateChange = subjectUrl === lastCommentUrl;
  const repositoryName = notification.repository.full_name;
  const data = { u: username, r: repositoryName };
  let comment = {};

  try {
    // If there is no comment then this user probably opened the item
    if (lastCommentUrl) {
      comment = await client.get(lastCommentUrl);
    } else if (subjectUrl) {
      comment = await client.get(notification.subject.url);
    } else {
      logger.error(`Unable to locate URL for notification: ${notification}`);
      return;
    }
  } catch (err) {
    if (err instanceof HttpError && err.statusCode === 404) {
      return;
    }
  }

  let msg = '';

  if (subjectType === 'release') {
    msg = `${repositoryName} ${notification.subject.title} released`;
  } else if (subjectType === 'commit') {
    if (stateChange) {
      msg = `${comment.author.login} mentioned you on commit ${repositoryName}@${comment.sha.substring(0, 6)}`;
      data.c = comment.sha;
    } else {
      msg = `${comment.user.login} commented on commit ${repositoryName}@${comment.commit_id.substring(0, 6)}`;
      data.c = comment.commit_id;
    }
  } else if (subjectType === 'issue' || subjectType === 'pullrequest') {
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
        } else if (comment.closed_at) {
          const issue = await client.get(comment.issue_url);
          msg = `${issue.closed_by.login} closed `;
        } else {
          msg = `${comment.user.login} opened `;
        }
      } else if (comment.closed_at) {
        msg = `${comment.closed_by.login} closed `;
      } else {
        msg = `${comment.user.login} opened `;
      }
    } else {
      msg = `${comment.user.login} commented on `;
    }

    data[subjectType.substring(0, 1)] = num;
    msg += `${isPullRequest ? 'pull request' : 'issue'} ${repositoryName}#${shortNum}`;
  } else {
    logger.error(`No support for subject type ${subjectType}`);
    return;
  }

  await sendApn(msg, data);
}

async function handleApn(db, result) {
  const failedResults = result.failed || [];
  for (const e of failedResults) {
    if (e.status) {
      if (e.status === '410' || e.status === '400') {
        await db
          .removeExpiredRegistration(e.device)
          .then(() => logger.info(`Successfully removed ${e.device}`))
          .catch(err => logger.error(`Error removing expired device ${e.device}`, err));
      } else {
        logger.info(`Unhandled status for device ${e.status}: ${e.response.reason}`);
      }
    } else {
      logger.error(e.error);
    }
  }
}

async function processRecord(db, record, sendApn) {
  const client = new Client(record.oauth);
  const { tokens } = record;

  try {
    const notifications = await client.notifications(record.updated_at);
    for (let i = 0; i < notifications.length; i += 1) {
      await processNotification(client, record.username, notifications[i], (msg, data) =>
        sendApn(tokens, msg, data).then(x => handleApn(db, x))
      );
    }
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.statusCode === 401 || err.statusCode === 403) {
        await db.removeBadAuth(record.oauth, record.domain);
        return;
      }
    }
    throw err;
  }
}

async function processRecords(db, sendApn) {
  const registrations = await db.getRegistrations();

  const tasks = registrations.map(x => callback => {
    processRecord(db, x, sendApn)
      .catch(err => logger.error(`Unable to process record ${x.username}`, err))
      .then(() => db.updateUpdatedAt(x.oauth))
      .catch(err => logger.error(`Failed to update UpdatedAt ${x.username}`, err))
      .then(() => callback(), err => callback(err));
  });

  const totalTasks = tasks.length;
  const parallelProcessing = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting to process records')), 1000 * 60 * 20);

    async.parallelLimit(tasks, 3, err => {
      clearTimeout(timeout);

      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  await parallelProcessing.catch(e => logger.error('Error during parallel record processing', e));
  return totalTasks;
}

module.exports = {
  processRecords
};
