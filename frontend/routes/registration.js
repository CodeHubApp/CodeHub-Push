var db     = require('../../lib/db'),
    github = require('../../lib/github');

exports.unregister = function(req, res) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var domain = req.body.domain;

    db.removeRegistration(token, oauth, domain, function(err, found) {
        if (err) {
            console.error(err);
            return res.send(500)
        }

        res.send(found ? 200 : 404);
    });
};

exports.register = function(req, res) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var user   = req.body.user;
    var domain = req.body.domain;

    var client = new github.Client(domain, oauth, user);
    client.notifications(null, function(err) {
        if (err) {
            console.error(err);
            return res.json(400, { error: err.message });
        }

        db.insertRegistration(token, oauth, user, domain, function(err, inserted) {
            if (err) {
                console.error(err);
                return res.send(500);
            }

            res.send(inserted ? 200 : 409);
        });
    });
};

exports.registered = function(req, res) {
    var token  = req.body.token;
    var oauth  = req.body.oauth;
    var domain = req.body.domain;

    db.isRegistered(token, oauth, domain, function(err, isRegistered) {
        if (err) return res.send(500);
        res.send(isRegistered ? 200 : 404);
    });
};
