# Geocoder
    US Geocoder module that works on top of TIGER Line data file from US Census bureau.
    Uses PostGIS min 2.x. Assumes you have a readily available PostGIS 2 + PostgreSQL 9.1+
    installed that also has TIGER 2010 database loaded (about 95 GiB).
    If you need help getting it setup, drop me a mail. Loading the TIGER database in postgres
    usually takes 1 week. This can also be hosted on Heroku.

###Installation:

    npm install tiger-geocoder

### Usage

You can pass a string representation of a location and a callback function to `geocoder.geocode`. It will accept: full street address, street and zip/city+state, zipcode, city + state.

###Example:

```javascript
var geocoder = require('tiger-geocoder');

// Geocoding
geocoder.geocode("15337 Cherry ln, Markham, IL", function ( err, data ) {
  // do something with data
});

geocoder.geocode("Cherry ln, Markham, IL", function ( err, data ) {
  // do something with data
});

geocoder.geocode("Markham, IL", function ( err, data ) {
  // do something with data
});

geocoder.geocode("60428", function ( err, data ) {
  // do something with data
});


// Reverse Geocoding
geocoder.reverseGeocode( 33.7489, -84.3789, function ( err, data ) {
  // do something with data
});



```
You have an option to use the native JSON result or request it to be formatted to match a popular provider such as Google, Bing etc.
Google response style will look like standard [Google JSON Output](http://code.google.com/apis/maps/documentation/geocoding/#JSON)

You can pass in an optional options hash as a last argument, useful for setting the following:

```javascript
conString: a connection string to your postgres TIGER database. If not provided it will attempt to read it from heroku HEROKU_POSTGRESQL_BLUE_URL or default to tcp://username:password@localhost/geocoder
redisClient: an instance of a redis connection where to store the geocoded results. If not provided, no caching will take place.
cacheTTL: the Time-To-Live for the redis cache entry, defaults to 1 month
responseFormat: empty string will use internal JSOn format, 'google' will return it in google maps V3 JSON format
```
###Testing:
`nodeunit test-tiger-geocoder`

## Roadmap
- Add support for response mapping for BING, Mapquest, Yahoo etc
