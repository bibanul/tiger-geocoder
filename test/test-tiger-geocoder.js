geocoder = require('../index.js');


module.exports = {

    testExposeGeocodeFunction: function(test){
        test.equal(typeof geocoder.geocode, 'function');
        test.done();
    },

    testGeocodePAGCException: function(test){
      test.expect(3);
      geocoder.geocode("2732 montavo pl 95008", {includegeoid: true}, function(err, result){
        test.ok(!err);
        test.ok(result.result.formatted_address.match(/montavo/i));
        test.ok(result.result.accuracy <20);
        console.log(result);
        test.done();
      });
    },

    testGeocodeStreet: function(test){
        test.expect(2);
        geocoder.geocode("cherry ln, markham, il", null, function(err, result){
            test.ok(!err);
            test.ok(result.result.formatted_address.match(/Markham/));
            console.log(result);
            test.done();
        });
    },

    testGeocodeFullAddress: function(test){
        test.expect(2);
        geocoder.geocode("15337 cherry ln, markham, il 60428", null, function(err, result){
            test.ok(!err);
            test.ok(result.result.formatted_address.match(/Cherry/));
            console.log(result);
            test.done();
        });
    },

    testGeocodeCity: function(test){
        test.expect(2);
        geocoder.geocode("markham, il", null, function(err, result){
            test.ok(!err);
            test.ok(result.result.formatted_address.match(/Markham/));
            console.log(result);
            test.done();
        });
    },
    testGeocodeZipcode: function(test){
        test.expect(2);
        geocoder.geocode("60426", null, function(err, result){
            test.ok(!err);
            test.ok(result.result.formatted_address.match(/60426/));
            console.log(result);
            test.done();
        });
    },

    testReverseGeocode: function(test){
        test.expect(2);
        geocoder.reverseGeocode(41.6136241828052, -87.7042010885112, null, function(err, result){
            test.ok(!err);
            test.ok(result.result.formatted_address.match(/Cherry/));
            console.log(result);
            test.done();
        });
    }

}