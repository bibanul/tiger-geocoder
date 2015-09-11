/**
 * TIGER Geocoder
 */

/**
 * Module Dependencies
 * pg
 */

var pg = require('pg')
  , async = require("async")
  ;
var conString = process.env.HEROKU_POSTGRESQL_BLUE_URL || process.env.POSTGRESQL_URL || "tcp://username:password@localhost/geocoder";
var redis;
if (process.env.REDISCLOUD_URL || process.env.REDISTOGO_URL || process.env.REDIS_URL) {
  var redisUrl   = require('url').parse(process.env.REDISCLOUD_URL || process.env.REDISTOGO_URL || process.env.REDIS_URL);
  redis = require('redis').createClient(redisUrl.port, redisUrl.hostname)
  redis.auth(redisUrl.auth.split(":")[1]);
} else {
  redis = require('redis').createClient();
}

/**
 * PG pool defaults
 */
pg.defaults.poolSize = process.env.PG_POOL_SIZE || 10;  //how many connections to keep in the pool (default 10)
pg.defaults.poolIdleTimeout = process.env.PG_POOL_TIMEOUT || 30 //how long to keep an idle conn into the pool (defaults to 30 sec)

/**
 * Geocoder
 */

function Geocoder () {}

/**
 * Geocoder prototype
 */

Geocoder.prototype = {

  /**
   * Request geocoordinates of given `location` from PostGIS
   *
   * @param {String} location, required. any US address,city, state, zipcode
   * @param {Function} callback, required
   * @param {Object} options, optional
   *  -> cacheTTL, a time to live in seconds for the redis entry, defaults to 30 days
   *  -> responseFormat, format the response to match popular providers: google, bing, etc. Defaults to internal JSON format
   *  -> includegeoid, to include the TIGER unique geoids for cross-referencing with Demographic tables or other external ACS data
   *  -> limitResults, number to limit the matches returned. defaults to 1
   * @api public
   */

  geocode: function ( location, options, callback ) {

    if ( ! location ) {
      return callback( new Error( "Geocoder.geocode requires a location."), null );
    }
    if (!options) options = {}
    options.limitResults = options.limitResults || 1;
    options.cacheTTL = options.cacheTTL || 2592000;

    var GeocodeResponse = {};

    redis.get('geo:' + location, function (err, result) {
      if (result) {
        result = JSON.parse(result);
        if (process.env.development) console.log("Cache hit on: " + location);
        return callback(null, result);
      }
      else {
        //geocode it
        //use async to handle some magic scenarios here
        async.waterfall([
            //try to identify if we do an intersection geocoding or go for full address
            function(cb) {
              //identify cross street requests and try to normalize the components. Generally you see "Main st at Central Ave, New York, NY 02119".
              var parsedLoc = location.toLowerCase();
              parsedLoc =
                location.indexOf(" at ") >= 0 ? location.replace(" at ", " @ ") :
                  location.indexOf(" &amp; ") >= 0 ? location.replace(" &amp; ", " @ ") :
                    location.indexOf(" & ") >= 0 ? location.replace(" & ", " @ ") :
                      location.indexOf(" and ") >= 0 ? location.replace(" and ", " @ "): location
              ;
              if (parsedLoc.indexOf(" @ ") >= 0) {
                pg.connect(conString, function (err, client, done) {
                  if (err) {
                    return cb(err, null)
                  }
                  //use normalize_address to parse out what we can. generally it will come back as street1 and street2, based on this we decide
                  async.waterfall([
                    function(cbb){
                      client.query({
                        name: 'tiger_parse_address',
                        text: "SELECT addy.street As street1, addy.street2 As street2, addy.city As city, addy.state As state, addy.zip As zip, addy.country as country " +
                        "FROM parse_Address($1) As addy",
                        values: [parsedLoc]
                      }, function (err, parsedAddress) {
                        return cbb(err, parsedAddress);
                      });
                    },
                    function(parsedAddress, cbb) {
                      //if we have enough data, we go for it.
                      if (!parsedAddress || parsedAddress.rows.length === 0) return cbb(err,null); //no results

                      var loc = parsedAddress.rows[0];
                      if (loc.street1 && loc.street2 && loc.state) { //state is mandatory, won't return anything w/o state
                        //check if street2 has an & in it. badly formatted but we need to clean up such cases and keep the first part before &
                        if (loc.street2.indexOf(" & ")>= 0){
                          loc.street2 = loc.street2.substring(0,loc.street2.indexOf(" & "));
                        }
                        //check to see if first street has in fact a street number and it's a badly merged address (streetnumber + streetname at street 1 & street2)
                        var streetParts = loc.street1.split(" ");
                        if (streetParts.length > 0 && isNumber(streetParts[0])){
                          //reformat location before passing down to next function
                          location = loc.street1 + ", " + loc.city + ", " + loc.state + (loc.zip ? " " + loc.zip : '');
                          cbb(null, null);  //allow normal address geocoding
                        } else {
                          //go for intersection geocode
                          client.query({
                            name: 'tiger_geocode_intersection',
                            text: "SELECT g.rating, ST_X(g.geomout) As lon, ST_Y(g.geomout) As lat," +
                            "(addy).streetname As street, " +
                            "(addy).streettypeabbrev As streettype, (addy).location As city, (addy).stateabbrev As state, (addy).zip As zip, " +
                            "(pprint_addy(addy)) As normalized_address " +
                            "FROM geocode_intersection($1, $2, $3, $4, $5, $6) As g ORDER BY (addy).zip ASC",
                            values: [loc.street1, loc.street2, loc.state || '', loc.city || '', loc.zip || '', (options.limitResults > 2 ? options.limitResults : 2)]  //must pass empty string param or else we get no tesults
                          }, function (err, geocoderResult) {
                            //massage the normalized display address to reflect the fact its an intersection
                            if (geocoderResult && geocoderResult.rows.length > 0) {
                              geocoderResult.rows[0].normalized_address = geocoderResult.rows[0].street + " " + geocoderResult.rows[0].streettype + " @ " + loc.street2.capitalize() + ', ' + geocoderResult.rows[0].city + ", " + geocoderResult.rows[0].state + (geocoderResult.rows[0].zip ? " " + geocoderResult.rows[0].zip : '');
                            }
                            return cbb(err, geocoderResult);
                          });
                        }
                      } else {
                        //malformed intersection w/o state or missing one street. return err to prevent further geocoding
                        return cbb(new Error("Malformed Address", 400));
                      }
                    }
                  ], function(err, geocoderResult){
                    done();   //disconnect from pg and return the client to the pool to avoid leaking it
                    //evaluate the result and decide how to continue main flow
                    return cb(err, geocoderResult);
                  });
                })
              } else {
                return cb(null, null);  //nada, allow normal address geocoding to give it a shot
              }
            },
            function(geocoderResult, cb) {
              //if no redis result proceed with geocoding using tiger-geocoder. Here's the trick:
              //address normalizers are not perfect, we use both pagc_normalize_address and the PostGIS normalize_address
              //PAGC fails some simple parsing when street direction is provided such as 122 S. Main St while PostGIS one succeeds
              //hence, we observed that PostGIS one succeeds more often hence we use it first, and in case we don't get a result under rank 20, we will make a second call using PAGC one
              if (!geocoderResult || (geocoderResult && (geocoderResult.rows.length == 0 || (geocoderResult.rows.length > 0 && geocoderResult.rows[0].rating >= 20)))) {
                pg.connect(conString, function (err, client, done) {
                  if (err) {
                    return cb(err, null)
                  }
                  client.query({
                    name: 'tiger_geocode_postgis',
                    text: "SELECT g.rating, ST_X(g.geomout) As lon, ST_Y(g.geomout) As lat," +
                    "(addy).address As streetnumber, (addy).streetname As street, " +
                    "(addy).streettypeabbrev As streettype, (addy).location As city, (addy).stateabbrev As state, (addy).zip As zip, (pprint_addy(addy)) As normalized_address " +
                    "FROM geocode(normalize_address($1), $2) As g",
                    values: [location, options.limitResults]
                  }, function (err, results) {
                    done();   //disconnect from pg and return the client to the pool
                    return cb(err, results);
                  });
                })
              } else {
                return cb(null, geocoderResult);
              }
            },
            function(geocoderResult, cb) {
              //PAGC call if needed
              if (process.env.PAGC && (!geocoderResult || (geocoderResult && (geocoderResult.rows.length == 0 || (geocoderResult.rows.length > 0 && geocoderResult.rows[0].rating >= 20))))) {
                //try PAGC parser
                if (process.env.development) console.log("Trying PAGC for address: " + location);
                pg.connect(conString, function (err, client, done) {
                  if (err) {
                    return cb(err, null)
                  }
                  client.query({name: 'tiger_geocode_pagc', text: "SELECT g.rating, ST_X(g.geomout) As lon, ST_Y(g.geomout) As lat," +
                    "(addy).address As streetnumber, (addy).streetname As street, " +
                    "(addy).streettypeabbrev As streettype, (addy).location As city, (addy).stateabbrev As state, (addy).zip As zip, (pprint_addy(addy)) As normalized_address " +
                    "FROM geocode(pagc_normalize_address($1), $2) As g",
                      values: [location, options.limitResults]},
                    function (err, results) {
                      done();   //disconnect from pg and return the client to the pool
                      //if we had a previous result compare the rating with this one and return the better one (lower)
                      if (!err &&
                        (geocoderResult && results.rows.length == 0) ||
                        (geocoderResult.rows.count > 0 && results.rows.length > 0 && geocoderResult.rows[0].rating > results.rows[0].rating)
                      ) results = geocoderResult;

                      return cb(err, results)
                    }
                  );
                })
              } else {
                return cb(null, geocoderResult);
              }
            }],
          //handle final processing here
          function(err, results){
            if (err) return callback(err);

            //see if we have any result here and parse it
            var result = results.rows[0];
            if (!result) return callback(null, null); //nada

            //hydrate GeocodeResponse
            Geocoder.prototype.parseResult(options, result, function(err, GeocodeResponse){
              if (err) return callback(err);

              redis.set('geo:' + location, JSON.stringify(GeocodeResponse), function(err, msg){
                redis.expire('geo:' + location, options.cacheTTL);  //if ttl is not provided we expire it in 30 days
                callback(null, GeocodeResponse);  //no need to wait for redis (maybe it's down?)
              });
            });
          });
      } //end redis check callback
    })
  },

  //TODO: implement it based on reverse_geocode function in PostGIS
  reverseGeocode: function ( lat, lng, options, callback ) {
    if ( !lat || !lng ) {
      return callback( new Error( "Geocoder.reverseGeocode requires a latitude and longitude." ), null );
    }

    if (!options) options = {}
    options.limitResults = options.limitResults || 1;
    options.cacheTTL = options.cacheTTL || 2592000;

    redis.get('geo:' + lat + '-' + lng, function (err, result){
      if(result){
        Geocoder.prototype.parseResult(options, JSON.parse(result), function(err, GeocodeResponse) {
          return callback(err, GeocodeResponse);
        });
      }
      else {
        pg.connect(conString, function(err, client, done){
          if(err) {return callback( err, null )}

          client.query({name:"tiger_reverse_geocode", text: "SELECT (pprint_addy(rg.addy[1])) as normalized_address, $1 as lat, $2 as lon, "+
          "rg.addy[1].address As streetnumber, rg.addy[1].streetname As street, "+
          "rg.addy[1].streettypeabbrev As styp, rg.addy[1].location As city, rg.addy[1].stateabbrev As state, rg.addy[1].zip "+
          "FROM reverse_geocode(ST_SetSRID(ST_Point($2, $1),4326)) rg LIMIT $3",
            values:[lat, lng, options.limitResults]}, function(err, results){
            done();
            if (err) {
              return callback(err, results)
            }
            if (!results || !results.rows) {
              return callback(new Error('no rows found'), results)
            }
            if (results.rows.length == 0) {
              return callback(new Error('no rows found'), results)
            }

            var result = results.rows[0];
            //hydrate GeocodeResponse, a structure that follows Google Maps API v3 format
            //Geocoder.prototype.parseResult(options, result, GeocodeResponse);
            Geocoder.prototype.parseResult(options, result, function(err, GeocodeResponse) {
              if (err) return callback(err);

              //push to redis, if available
              redis.set('geo:' + lat + '-' + lng, JSON.stringify(result), function (err, res) {
                redis.expire('geo:' + lat + '-' + lng, options.cacheTTL);  //if ttl is not provided we expire it in 30 days

                return callback(null, GeocodeResponse);
              });
            })
          })
        })
      }
    });
  },

  parseResult: function (options, result, cb){
    var callback = {};
    var format = options.responseFormat || '';
    switch (format.toLowerCase()){
      case 'google':
        callback.result = {
          'accuracy': result.rating,  //accuracy as provided by PostGIS rating result. lower more accurate. from 1 to 100.
          'formatted_address':result.normalized_address,
          'geometry':{
            'location': {
              'lat': result.lat,
              'lon': result.lon
            }
          },
          'address_component':[]
        };
        //test for address parts and push them into the result
        if (result.streetnumber){
          if (!callback.result.types) callback.result.types = ['street_address'],
            callback.result.address_component.push({
              'type':['street_number'],
              'long_name':result.streetnumber,
              'short_name':result.streetnumber
            })
        }
        if (result.street){
          if (!callback.result.types) callback.result.types = ['route'],
            callback.result.address_component.push({
              'type':['route'],
              'long_name':result.street,
              'short_name':result.street
            })
        }
        if (result.city){
          if (!callback.result.types) callback.result.types = ['locality'],
            callback.result.address_component.push({
              'type':['locality'],
              'long_name':result.city,
              'short_name':result.city
            });
        }
        if (result.zip){
          if (!callback.result.types) callback.result.types = ['postal_code'],
            callback.result.address_component.push({
              'type':['postal_code'],
              'long_name':result.zip,
              'short_name':result.zip
            });
        }
        if (result.state){
          if (!callback.result.types) callback.result.types = ['administrative_area_level_1'],
            callback.result.address_component.push({
              'type':['administrative_area_level_1'],
              //'long_name':,
              'short_name':result.state
            });
        }
        break;

      default:
        callback.result = {
          'accuracy': result.rating,  //accuracy as provided by PostGIS rating result. lower more accurate. from 1 to 100.
          'formatted_address': result.normalized_address,
          'location': {
            'lat': result.lat,
            'lon': result.lon
          }};
        if (result.streetnumber){
          callback.result.streetNumber = result.streetnumber;
        }
        if (result.street){
          callback.result.street = result.street;
        }
        if (result.streettype){
          callback.result.streetType = result.streettype;
        }
        if (result.city){
          callback.result.city = result.city;
        }
        if (result.state){
          callback.result.state = result.state;
        }
        if (result.zip){
          callback.result.zipcode = result.zip;
        }
    }

    //attach GeoIds if user user requested it options.includegeoid
    if (options.includegeoid){
      Geocoder.prototype.attachGeoIds (callback, function(err, result){
        cb(null, result);  //assign to original one to override and return it
      });
    }
    else
      cb(null, callback);
  },

  //attaches TIGER specific unique IDs to help cross-referencing external data in Demographic / Economic tables. Also includes Zillow neighborhoods (if loaded).
  attachGeoIds: function (GeocodeResponse, callback){
    pg.connect(conString, function(err, client, done){
      if(err) {return callback( err, null )}

      //select get_geoids(ST_GeomFromText('POINT(-121.93830710000000295 37.272289700000001744 )', 4269), normalize_address('2731 montavo pl, Campbell, ca, 95008'))

      client.query({name:"tiger_get_geoids", text: "SELECT * FROM get_geoids(ST_SetSRID(ST_Point($2, $1),4326), $3, $4, $5 ) addy_ex",
        values:[GeocodeResponse.result.location.lat, GeocodeResponse.result.location.lon, GeocodeResponse.result.city, GeocodeResponse.result.state, GeocodeResponse.result.zipcode]}, function(err, results) {
        done();   //disconnect from pg and return the client to the pool
        if (err) {
          return callback(err)
        }
        if (!results || !results.rows) {
          return callback(null, null)
        }
        if (results && results.rows && results.rows.length > 0) {
          var result = results.rows[0];
          if (result.locationid) GeocodeResponse.result.cityId = result.locationid;
          if (result.stateid) GeocodeResponse.result.stateId = result.stateid;
          if (result.neighborhoodid) {
            GeocodeResponse.result.neighborhoodId = result.neighborhoodid;
            GeocodeResponse.result.neighborhood = result.neighborhood;
          }
          if (result.tractid) {
            GeocodeResponse.result.tractId = result.tractid;
            GeocodeResponse.result.tract = result.tract;
          }
          if (result.countyid) {
            GeocodeResponse.result.countyId = result.countyid;
            GeocodeResponse.result.county = result.county;
          }
          if (result.metroid) {
            GeocodeResponse.result.metroId = result.metroid;
            GeocodeResponse.result.metro = result.metro;
          }
        }

        callback(null, GeocodeResponse);
      })
    });
  }
}


/**
 * Export
 */

module.exports = new Geocoder();

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
};
