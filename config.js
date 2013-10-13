var config = exports;

// The port to listen on for connections
config.port = process.env.PORT || 3000;

// The time before the system begins the update loop to push out notifications
// This time is in milliseconds and should be enough to give GitHub some room to breath
config.updateTime = 1000 * 60 * 5;

// The mongo address where the database is kept
config.mongodb = process.env.MONGODB;

// The amount of registrations to process at any given time
config.registrationBatch = 5;

// Github things
config.github = {};

// The user agent when connecting to GitHub
config.github.userAgent = 'github-push';

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
