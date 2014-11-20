CREATE OR REPLACE FUNCTION public.get_geoids(loc_geom geometry, city character varying, state character, zip character varying, OUT addy_ex norm_addy_ex)
 RETURNS norm_addy_ex
 LANGUAGE plpgsql
 IMMUTABLE COST 500
AS $function$
DECLARE
  var_loc_geom geometry;
  var_debug boolean = false;
BEGIN
addy_ex.location := city;
addy_ex.stateAbbrev := state;
addy_ex.zip := zip;

        --$Id: census_tracts_functions.sql 7996 2011-10-21 12:01:12Z robe $
        IF loc_geom IS NOT NULL THEN
                IF ST_SRID(loc_geom) = 4269 THEN
                        var_loc_geom := loc_geom;
                ELSIF ST_SRID(loc_geom) > 0 THEN
                        var_loc_geom := ST_Transform(loc_geom, 4269);
                ELSE --If srid is unknown, assume its 4269
                        var_loc_geom := ST_SetSRID(loc_geom, 4269);
                END IF;
                IF GeometryType(var_loc_geom) != 'POINT' THEN
                        var_loc_geom := ST_Centroid(var_loc_geom);
                END IF;
        END IF;
        -- Determine state tables to check
        -- this is needed to take advantage of constraint exclusion

        SELECT statefp INTO addy_ex.stateId FROM state WHERE stusps = addy_ex.stateAbbrev  LIMIT 1;

        -- locate county
        SELECT cntyidfp, name INTO addy_ex.countyID, addy_ex.county from county where statefp = addy_ex.stateId and ST_Intersects(var_loc_geom, the_geom) LIMIT 1;

        --locate city id by state + cityname
        SELECT plcidfp INTO addy_ex.locationId from place where name = addy_ex.location and statefp = addy_ex.stateId LIMIT 1;

        --locate neighborhood
        SELECT gid, name into addy_ex.neighborhoodId, addy_ex.neighborhood from neighborhoods where  ST_Intersects(var_loc_geom, the_geom) LIMIT 1;

        --locate tract
        SELECT tract_id, name INTO addy_ex.tractId, addy_ex.tract FROM tract WHERE statefp = addy_ex.stateId and ST_Intersects(var_loc_geom, the_geom) LIMIT 1;


END;
$function$