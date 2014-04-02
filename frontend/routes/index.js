exports.registration = require('./registration');

exports.features = function(req, res) {
    res.json(200, [
        'com.dillonbuchanan.codehub.push'
    ]);
};