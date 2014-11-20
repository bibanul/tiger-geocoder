DROP TYPE IF EXISTS norm_addy_ex CASCADE;
CREATE TYPE norm_addy_ex AS (
    address INTEGER,
    preDirAbbrev VARCHAR,
    streetName VARCHAR,
    streetTypeAbbrev VARCHAR,
    postDirAbbrev VARCHAR,
    internal VARCHAR,
    tract VARCHAR,
    tractId VARCHAR,
    neighborhood VARCHAR,
    neighborhoodId VARCHAR,
    location VARCHAR,
    locationId VARCHAR,
    metro VARCHAR,
    metroId VARCHAR,
    county VARCHAR,
    countyId VARCHAR,
    stateAbbrev VARCHAR,
    stateId VARCHAR,
    zip VARCHAR,
    parsed BOOLEAN);


