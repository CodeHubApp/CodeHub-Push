var client = require('../github/client');
var testing_oauth = 'e3fe0db9998a2717551d21fdeaa27e9b6d6ca79d';

exports.get = function (test) {
	client.get('https://api.github.com/users/thedillonb', testing_oauth, '', function(err, data) {
		test.ifError(err);
		test.ok(data);
		test.done();
	});
}

exports.get_failure = function (test) {
	client.get('https://api.github.com/user/thedillonb', testing_oauth, '', function(err, data) {
		test.ok(err);
		test.done();
	});
}

exports.notifications = function (test) {
	client.notifications(testing_oauth, '', function(err, data, etag) {
		test.ifError(err);
		test.ok(data);
		test.ok(etag);
		test.done();
	});
}