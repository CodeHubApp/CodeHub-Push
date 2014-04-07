var fs = require('fs');
var config = exports;

// The port to listen on for connections
config.port = process.env.PORT || 3000;

// Database things
config.db = {}

// The database user
config.db.user = process.env.DBUSER;

// The database password
config.db.pass = process.env.DBPASS;

// The amount of registrations to process at any given time
config.registrationBatch = 5;

// Github things
config.github = {};

// The user agent when connecting to GitHub
config.github.userAgent = 'codehub-push';

// The address to GitHub API server
config.github.portal = 'https://api.github.com';

// Push things
config.push = {};

// Production variables
if (process.env.NODE_ENV === 'production') {
    // The service gateway for APN
    config.push.serviceGateway = 'gateway.push.apple.com';

    // The feedback gateway for APN
    config.push.feedbackGateway = 'feedback.push.apple.com';

    // The cert.pem contents
    config.push.cert = fs.readFileSync(__dirname + '/certs/cert.production.pem');

    // The key.pem contents
    config.push.key = fs.readFileSync(__dirname + '/certs/key.production.pem');
}
else {
    // The service gateway for APN
    config.push.serviceGateway = 'gateway.sandbox.push.apple.com';

    // The feedback gateway for APN
    config.push.feedbackGateway = 'feedback.sandbox.push.apple.com';

    // The cert.pem contents
    config.push.cert = fs.readFileSync(__dirname + '/certs/cert.development.pem');

    // The key.pem contents
    config.push.key = fs.readFileSync(__dirname + '/certs/key.development.pem');
}
