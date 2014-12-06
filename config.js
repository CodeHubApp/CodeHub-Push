var fs = require('fs');
var config = module.exports = {};

// The raven key
config.raven = process.env['RAVEN'];

// Whether this application is in production mode
config.production = process.env.NODE_ENV === 'production';

// Certificate credentials
if (config.production) {
    config.apnServiceGateway = 'gateway.push.apple.com';
    config.apnFeedbackGateway = 'feedback.push.apple.com';
    config.apnCert = fs.readFileSync(__dirname + '/certs/cert.production.pem');
    config.apnKey = fs.readFileSync(__dirname + '/certs/key.production.pem');
}
else {
    config.apnServiceGateway = 'gateway.sandbox.push.apple.com';
    config.apnFeedbackGateway = 'feedback.sandbox.push.apple.com';
    config.apnCert = fs.readFileSync(__dirname + '/certs/cert.development.pem');
    config.apnKey = fs.readFileSync(__dirname + '/certs/key.development.pem');
}

// The listen port
config.port = process.env['PORT'] || 3000;

// Database username and passwords
config.dbUser = process.env['DBUSER'];
config.dbPass = process.env['DBPASS'];
if (!config.dbUser || !config.dbPass) {
  throw new Error('You must have a database username and password');
}

// The spawn command
config.workerSpawn = 'node ' + __dirname + '/worker.js';

// The pause (in ms) between the worker execution loop
config.workerPause = 1000 * 60 * 2