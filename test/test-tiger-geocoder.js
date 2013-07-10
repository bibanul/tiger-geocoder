geocoder = require('../index.js');

module.exports = {

    testExposeGeocodeFunction: function(test){
        test.equal(typeof geocoder.geocode, 'function');
        test.done();
    },

    testGeocodeStreet: function(test){
        test.expect(2);
        geocoder.geocode("cherry ln, markham, il", function(err, result){
            test.ok(!err);
            test.ok(result.result.formatted_address.match(/Markham/));
            console.log(result);
            test.done();
        });
    },

    testGeocodeFullAddress: function(test){
        test.expect(2);
        geocoder.geocode("15337 cherry ln, markham, il 60428", function(err, result){
            test.ok(!err);
            test.ok(result.result.formatted_address.match(/Markham/));
            console.log(result);
            test.done();
        });
    },

    testGeocodeCity: function(test){
        test.expect(2);
        geocoder.geocode("markham, il", function(err, result){
            test.ok(!err);
            test.ok(result.result.formatted_address.match(/Markham/));
            console.log(result);
            test.done();
        });
    },
    testGeocodeZipcode: function(test){
        test.expect(2);
        geocoder.geocode("60426", function(err, result){
            test.ok(!err);
            test.ok(result.result.formatted_address.match(/60426/));
            console.log(result);
            test.done();
        });
    },
    testGeocodeState: function(test){
        test.expect(1);
        geocoder.geocode("Illinois", function(err, result){
            test.ok(err);
            test.done();
        });
    }



}