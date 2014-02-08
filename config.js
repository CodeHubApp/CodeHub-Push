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

// The service gateway for APN
config.push.serviceGateway = 'gateway.sandbox.push.apple.com';

// The feedback gateway for APN
config.push.feedbackGateway = 'feedback.sandbox.push.apple.com';

// Time before we inquire about feedback, in seconds
config.push.feedbackInterval = 300;

// The cert.pem contents
config.push.cert = process.env.CERT;

// The key.pem contents
config.push.key = process.env.KEY;

// The number of active jobs when taking tasks off redis for APN processing
config.push.activeJobs = 100;
