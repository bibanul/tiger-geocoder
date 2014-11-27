# Geocoder
    US Geocoder module that works on top of free TIGER Line data file from US Census bureau.
    Uses PostGIS min 2.x. Do your own geocoding for high volume and avoid paying to 3rd party providers.

    Assumes you have a readily available PostGIS 2 + PostgreSQL 9.1+
    installed that also has TIGER 2010 database loaded (about 95 GiB). Instructions on
    installing Tiger are found here: http://postgis.net for postgis module and
    http://postgis.net/docs/manual-2.0/postgis_installation.html#loading_extras_tiger_geocoder
    
    If you need to run a ready installed server see instructions here:
    https://github.com/bibanul/tiger-geocoder/wiki/Running-your-own-Geocoder-in-Amazon-EC2

    If you need help getting it setup, drop me a mail. Loading the TIGER database in postgres
    usually takes 1 week. This can also be hosted on Heroku. I ended up buying an SSD drive
    and creating an Ubuntu Xen VM on it that simply runs Postgres 9.1 + PostGis 2.0 + 95GB Tiger DB and Redis store.

###Installation:

    npm install tiger-geocoder

    or to run in Amazon EC2 see here:

    https://github.com/bibanul/tiger-geocoder/wiki/Running-your-own-Geocoder-in-Amazon-EC2

### Usage

You can pass a string representation of a location and a callback function to `geocoder.geocode`. It will accept: full street address, street and zip/city+state, zipcode, city + state.

###Example:

```javascript
var geocoder = require('tiger-geocoder');

// Geocoding
geocoder.geocode("15337 Cherry ln, Markham, IL", options, function ( err, data ) {
  // do something with data
});

geocoder.geocode("Cherry ln, Markham, IL", options, function ( err, data ) {
  // do something with data
});

geocoder.geocode("Markham, IL", options, function ( err, data ) {
  // do something with data
});

geocoder.geocode("60428", options, function ( err, data ) {
  // do something with data
});


// Reverse Geocoding
geocoder.reverseGeocode( 33.7489, -84.3789, options, function ( err, data ) {
  // do something with data
});



```
You have an option to use the native JSON result or request it to be formatted to match a popular provider such as Google, Bing etc.
Google response style will look like standard [Google JSON Output](http://code.google.com/apis/maps/documentation/geocoding/#JSON)

You can pass in an optional options hash as a last argument, useful for setting the following:

```javascript
conString: a connection string to your postgres TIGER database. If not provided it will attempt to read it from heroku HEROKU_POSTGRESQL_BLUE_URL or default to tcp://username:password@localhost/geocoder
redisString: a connection string to an instance of a redis to use. local redis will be used otherwise.
cacheTTL: the Time-To-Live for the redis cache entry, defaults to 1 month
responseFormat: empty string will use internal JSOn format, 'google' will return it in google maps V3 JSON format
```
###Testing:
`nodeunit test-tiger-geocoder`

## Roadmap
- Add support for response mapping for BING, Mapquest, Yahoo etc
