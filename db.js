// Bring Mongoose into the app
var mongoose = require( 'mongoose' );

// We want to set everything in UTC
var time = require('time');

// Grab the passwords
var passwords = require('./passwords.json');

// Build the connection string
var dbURI = 'mongodb://' + passwords.mongodb.user + ':' + passwords.mongodb.pass + '@ds049848.mongolab.com:49848/github-push';

// Create the database connection
mongoose.connect(dbURI);

// CONNECTION EVENTS
// When successfully connected
mongoose.connection.on('connected', function () {
  console.log('Mongoose default connection open to ' + dbURI);
});

// If the connection throws an error
mongoose.connection.on('error',function (err) {
  console.log('Mongoose default connection error: ' + err);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function () {
  console.log('Mongoose default connection disconnected');
});

// If the Node process ends, close the Mongoose connection
process.on('SIGINT', function() {
  mongoose.connection.close(function () {
    console.log('Mongoose default connection disconnected through app termination');
    process.exit(0);
  });
});

// Define a registration schema we'll use in the database
var registrationSchema = mongoose.Schema({
    // This will keep a list of all the devices attached to a specific GitHub account
    // This way, we can query once and send to multiple devices. It's a nice way be efficient about
    // how many times we query GitHub and attempt to reduce the amount of transactions.
    tokens: [String], 
    // Keep the oauth for the user so we can query in his/her identity
    oauth: { type: String, required: true, trim: true },
    // Keep the username too since we'll need to launch the app in that person's context
    username: { type: String, required: true, trim: true },
    // ETag for super efficiency
    etag: String,
    // Date's just for the sake of dates
    created_at: Date,
    updated_at: Date
});

// Update the created_at and updated_at during saves
registrationSchema.pre('save', function(next) {
    var d = new time.Date();
    d.setTimezone('UTC');
    this.updated_at = d;
    if (!this.created_at) {
        this.created_at = d;
    }
    next();
});

// Export the object
exports.Registration = mongoose.model('Registration', registrationSchema);
