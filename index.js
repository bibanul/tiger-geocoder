/**
 * TIGER Geocoder
 */

/**
 * Module Dependencies
 * pg
 */

var pg = require('pg');
var conString = process.env.HEROKU_POSTGRESQL_BLUE_URL || "tcp://username:password@localhost/geocoder";
var client = new pg.Client(conString); //creates a client pool
/**
 * Geocoder
 */

function Geocoder () {}

/**
 * Geocoder prototype
 */

Geocoder.prototype = {

    /**
     * Request geocoordinates of given `loc` from PostGIS
     *
     * @param {String} location, required. any US address,city, state, zipcode
     * @param {Function} callback, required
     * @param {Object} options, optional
     * @api public
     */

    geocode: function ( location, callback, options ) {

        if ( ! location ) {
            return callback( new Error( "Geocoder.geocode requires a location.") );
        }

        var GeocodeResponse;

        //check redis for a cached result (if redis client was provided)
        if(options && options.redisClient){
                options.redisClient.get(location, function (err, GeocodeResponse){
            });
        }


        client.query( {name:"tiger_geocode_location", text:"SELECT g.rating, ST_X(g.geomout) As lon, ST_Y(g.geomout) As lat,"+
            "(addy).address As stno, (addy).streetname As street,"+
            "(addy).streettypeabbrev As styp, (addy).location As city, (addy).stateabbrev As st,(addy).zip"+
            "FROM geocode($1) As g", values:[location]}, function(err, results){
            if (results.rows.length == 0)
            {
                //TODO: return not found error
            }
            var result = result.rows[0];
            //hydrate GeocodeResponse, a structure that follows Google Maps API v3 format
            GeocodeResponse.result = {
                'accuracy': result.rating,  //accuracy as provided by PostGIS rating result. lower more accurate. from 1 to 100.
                'type':'',
                'formatted_address':'',
                'geometry':{
                    'location': {
                        'lat': result.lat,
                        'lon': result.lon
                    }
                },
                'address_component':[]
            };
            //test for address parts and push them into the result
            if (row.zip){
                GeocodeResponse.result.address_component.push({
                    'type':[''],
                    'long_name':row.zip,
                    'short_name':row.zip,
                    'census_id':''          //the unique ID key present in TIGER Database.
                });
            }
            if (row.st){
                GeocodeResponse.result.address_component.push({
                    'type':[''],
                    //'long_name':,
                    'short_name':row.st,
                    'census_id':''          //the unique ID key present in TIGER Database.
                });
            }
            if (row.city){
                GeocodeResponse.result.address_component.push({
                    'type':[''],
                    'long_name':row.city,
                    'short_name':row.city,
                    'census_id':''          //the unique ID key present in TIGER Database.
                });
            }

            //TODO: push to redis, if available
            if(options && options.redisClient){
                options.redisClient.set(location, GeocodeResponse);
                options.redisClient.expire(location, options.cacheTTL || 3600);  //if ttl is not provided we expire it in 1 hr
            }
            return callback(GeocodeResponse);
        })
    },

    //TODO: implement it based on
    /*
    reverseGeocode: function ( lat, lng, callback, options ) {
        if ( !lat || !lng ) {
            return callback( new Error( "Geocoder.reverseGeocode requires a latitude and longitude." ) );
        }

        return ...

    }
    */

};

/**
 * Export
 */

module.exports = new Geocoder();