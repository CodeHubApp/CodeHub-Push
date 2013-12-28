var processor = require('../github/notification_processor');
var client = require('../github/client');
var fs = require('fs');
var testing_oauth = 'e3fe0db9998a2717551d21fdeaa27e9b6d6ca79d';

var notification = JSON.parse(fs.readFileSync(__dirname + '/notification.json').toString());

exports.process = function(test) {
	processor.process(testing_oauth, 0, notification, function(err, data) {
		test.ifError(err);
		test.ok(data);
		test.done();
	});
}
