-- A1. Contours des départements (GADM 4.1, Sénégal, niveau 2).
-- À exécuter à la main dans Snowflake, avant le chargement du fichier GADM.
--
-- Licence GADM : usage non commercial uniquement, citation obligatoire
-- (« GADM, version 4.1, https://gadm.org »). Pas de redistribution commerciale.
--
-- Jointure prévue : gid_2 = code_departement (ex. SEN.10.1_1),
-- gid_1 = code_region déduit (ex. SEN.10_1), à confirmer à réception.

use database SALTIS;
use schema RAW;

create table if not exists SALTIS.RAW.GEO_DEPARTEMENTS (
    gid_2                varchar        not null comment 'Code GADM du département (= code_departement)',
    gid_1                varchar        not null comment 'Code GADM de la région',
    nom_departement      varchar                 comment 'NAME_2 dans GADM',
    latitude_centroide   float                   comment 'Degrés décimaux, WGS84',
    longitude_centroide  float                   comment 'Degrés décimaux, WGS84',
    superficie_km2       float                   comment 'Calculée sur la géométrie GADM',
    geometrie            geography               comment 'Contour du département (MultiPolygon, WGS84)',
    source               varchar default 'GADM 4.1',
    date_chargement      timestamp_ntz default current_timestamp(),
    constraint pk_geo_departements primary key (gid_2)
)
comment = 'Contours GADM 4.1 des départements du Sénégal (niveau 2). Licence non commerciale, citation obligatoire.';

-- ---------------------------------------------------------------------------
-- Exemple de chargement depuis un GeoJSON déposé sur un stage (à adapter) :
-- ---------------------------------------------------------------------------
-- create file format if not exists SALTIS.RAW.FF_GEOJSON type = json strip_outer_array = false;
-- create stage if not exists SALTIS.RAW.STG_GADM file_format = SALTIS.RAW.FF_GEOJSON;
-- put file://gadm41_SEN_2.json @SALTIS.RAW.STG_GADM;   -- depuis SnowSQL
--
-- insert into SALTIS.RAW.GEO_DEPARTEMENTS
--     (gid_2, gid_1, nom_departement, latitude_centroide, longitude_centroide, superficie_km2, geometrie)
-- select
--     f.value:properties:GID_2::varchar,
--     f.value:properties:GID_1::varchar,
--     f.value:properties:NAME_2::varchar,
--     st_y(st_centroid(to_geography(f.value:geometry))),
--     st_x(st_centroid(to_geography(f.value:geometry))),
--     st_area(to_geography(f.value:geometry)) / 1e6,
--     to_geography(f.value:geometry)
-- from @SALTIS.RAW.STG_GADM (file_format => 'SALTIS.RAW.FF_GEOJSON') t,
--      lateral flatten(input => t.$1:features) f;
--
-- Vérification : 45 lignes attendues.
-- select count(*), count(distinct gid_2), count(distinct gid_1) from SALTIS.RAW.GEO_DEPARTEMENTS;
