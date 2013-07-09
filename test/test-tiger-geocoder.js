geocoder = require('../index.js');

module.exports = {
    testExposeGeocodeFunction: function(test){
        test.equal(typeof geocoder.geocode, 'function');
        test.done();
    },

    testGeocode: function(test){
        test.expect(3);
        geocoder.geocode("15337 cherry ln, markham, il", function(err, result){
            test.ok(!err);
            test.equals('OK', result.status);
            test.ok(result.results[0].formatted_address.match(/Markham/));
            test.done();
        });
    }

}