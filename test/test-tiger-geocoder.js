geocoder = require('../index.js');


module.exports = {

    testExposeGeocodeFunction: function(test){
        test.equal(typeof geocoder.geocode, 'function');
        test.done();
    },

    testGeocodeIntersectionMalformed: function(test){
        test.expect(3);
        geocoder.geocode("10712 E. 41st Street at 41st Street & HWY 169, Tulsa, OK", null, function(err, result){
            test.ok(!err && result);
            test.ok(result.result.formatted_address.match(/Tulsa/i));
            test.ok(result.result.accuracy <20);
            console.log(result);
            test.done();
        });
    },
    testGeocodeIntersectionMalformed2: function(test){
        test.expect(3);
        geocoder.geocode("83rd Street at Hayden & Mountain View, Scottsdale, AZ", null, function(err, result){
            test.ok(!err && result);
            test.ok(result.result.formatted_address.match(/Scottsdale/i));
            test.ok(result.result.accuracy <20);
            console.log(result);
            test.done();
        });
    },

    testGeocodeIntersectionNoZip: function(test){
        test.expect(3);
        geocoder.geocode("harlem ave @ archer, summit, il", null, function(err, result){
            test.ok(!err && result);
            test.ok(result.result.formatted_address.match(/summit/i));
            test.ok(result.result.accuracy <20);
            console.log(result);
            test.done();
        });
    },

    testGeocodeIntersectionZipOnly: function(test){
        test.expect(3);
        geocoder.geocode("harlem ave @ archer, il 60501", null, function(err, result){
            test.ok(!err && result);
            test.ok(result.result.formatted_address.match(/summit/i));
            test.ok(result.result.accuracy <20);
            console.log(result);
            test.done();
        });
    },



    testGeocodePAGCException: function(test){
      test.expect(3);
      geocoder.geocode("1821 s bascom ave 95008", {includegeoid: true}, function(err, result){
        test.ok(!err && result);
        test.ok(result.result.formatted_address.match(/bascom/i));
        test.ok(result.result.accuracy <20);
        console.log(result);
        test.done();
      });
    },

    testGeocodeStreet: function(test){
        test.expect(2);
        geocoder.geocode("cherry ln, markham, il", null, function(err, result){
            test.ok(!err && result);
            test.ok(result.result.formatted_address.match(/Markham/i));
            console.log(result);
            test.done();
        });
    },

    testGeocodeFullAddress: function(test){
        test.expect(2);
        geocoder.geocode("15337 cherry ln, markham, il 60428", null, function(err, result){
            test.ok(!err && result);
            test.ok(result.result.formatted_address.match(/Cherry/i));
            console.log(result);
            test.done();
        });
    },

    testGeocodeCity: function(test){
        test.expect(2);
        geocoder.geocode("markham, il", null, function(err, result){
            test.ok(!err && result);
            test.ok(result.result.formatted_address.match(/Markham/i));
            console.log(result);
            test.done();
        });
    },
    testGeocodeZipcode: function(test){
        test.expect(2);
        geocoder.geocode("60426", null, function(err, result){
            test.ok(!err && result);
            test.ok(result.result.formatted_address.match(/60426/i));
            console.log(result);
            test.done();
        });
    },

    testReverseGeocode: function(test){
        test.expect(2);
        geocoder.reverseGeocode(41.6136241828052, -87.7042010885112, null, function(err, result){
            test.ok(!err && result);
            test.ok(result.result.formatted_address.match(/Cherry/i));
            console.log(result);
            test.done();
        });
    }

}