/**
 * TIGER Geocoder
 */

/**
 * Module Dependencies
 * pg
 */

var pg = require('pg');
var conString = process.env.HEROKU_POSTGRESQL_BLUE_URL || process.env.POSTGRESQL_URL || "tcp://username:password@localhost/geocoder";
var redis;
if (process.env.REDISCLOUD_URL || process.env.REDISTOGO_URL || process.env.REDIS_URL) {
    var redisUrl   = require('url').parse(process.env.REDISCLOUD_URL || process.env.REDISTOGO_URL || process.env.REDIS_URL);
    redis = require('redis').createClient(redisUrl.port, redisUrl.hostname)
    redis.auth(redisUrl.auth.split(":")[1]);
}
else
    redis = require('redis').createClient();

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
     *  -> cacheTTL, a time to live in seconds for the redis entry, defaults to 1 hr
     *  -> responseFormat, format the response to match popular providers: google, bing, etc. Defaults to internal JSON format
     * @api public
     */

    geocode: function ( location, options, callback ) {

        if ( ! location ) {
            return callback( new Error( "Geocoder.geocode requires a location."), null );
        }
        if (!options) {options = {};}
        var GeocodeResponse = {};

        //check redis for a cached result
        redis.get('geo:' + location, function (err, result){
            if(result){
                parseResult({format:options.responseFormat || ''}, JSON.parse(result), GeocodeResponse);
                return callback(null, GeocodeResponse);
            }
            else {
                pg.connect(conString, function(err, client, done){
                    if(err) {return callback( err, null )}
                    client.query( {name: 'tiger_geocode' , text:"SELECT g.rating, ST_X(g.geomout) As lon, ST_Y(g.geomout) As lat,"+
                        "(addy).address As streetnumber, (addy).streetname As street, "+
                        "(addy).streettypeabbrev As streettype, (addy).location As city, (addy).stateabbrev As state, (addy).zip As zip, (pprint_addy(addy)) As normalized_address "+
                        "FROM geocode($1, 1) As g LIMIT 1", values:[location]}, function(err, results){
                        done();   //disconnect from pg and return the client to the pool
                        if(err) {return callback( err, null )}
                        if (results.rows.length == 0){return callback(new Error( "Address not found."), null)}

                        var result = results.rows[0];

                        //hydrate GeocodeResponse
                        parseResult({format:options.responseFormat || ''}, result, GeocodeResponse);

                        redis.set('geo:' + location, JSON.stringify(result), function(err, msg){
                            redis.expire('geo:' + location, options.cacheTTL || 2592000);  //if ttl is not provided we expire it in 30 days
                            return callback(null, GeocodeResponse);
                        });
                    });
                })
            }
        })
    },

    //TODO: implement it based on reverse_geocode function in PostGIS
    reverseGeocode: function ( lat, lng, options, callback ) {
        if ( !lat || !lng ) {
            return callback( new Error( "Geocoder.reverseGeocode requires a latitude and longitude." ), null );
        }

        if (!options) {options = {};}
        var GeocodeResponse = {};

            redis.get('geo:' + lat + '-' + lng, function (err, result){
                if(result){
                    parseResult({format:options.responseFormat || ''}, JSON.parse(result), GeocodeResponse);
                    return callback(null, GeocodeResponse);
                }
            else {
                pg.connect(conString, function(err, client, done){
                    if(err) {return callback( err, null )}

                    client.query({name:"tiger_reverse_geocode", text: "SELECT (pprint_addy(rg.addy[1])) as normalized_address, $1 as lat, $2 as lon, "+
                    "rg.addy[1].address As streetnumber, rg.addy[1].streetname As street, "+
                    "rg.addy[1].streettypeabbrev As styp, rg.addy[1].location As city, rg.addy[1].stateabbrev As st, rg.addy[1].zip "+
                    "FROM reverse_geocode(ST_SetSRID(ST_Point($2, $1),4326)) rg",
                    values:[lat, lng]}, function(err, results){
                        if (results.rows.length == 0)
                        {
                            //TODO: return not found error
                        }

                        var result = results.rows[0];
                        //hydrate GeocodeResponse, a structure that follows Google Maps API v3 format
                        parseResult({format:options.responseFormat || ''}, result, GeocodeResponse);

                        //push to redis, if available
                        redis.set('geo:' + lat + '-' + lng, JSON.stringify(result), function(err, res){
                            redis.expire('geo:' + lat + '-' + lng, options.cacheTTL || 2592000);  //if ttl is not provided we expire it in 30 days

                            return callback(null, GeocodeResponse);
                        });
                    })
                })
            }
        });
    }
};

function parseResult(options, result, callback){
    switch (options.format.toLowerCase()){
        case 'google':
            callback.result = {
                'accuracy': result.rating,  //accuracy as provided by PostGIS rating result. lower more accurate. from 1 to 100.
                'formatted_address':row.normalized_address,
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
}


/**
 * Export
 */

module.exports = new Geocoder();