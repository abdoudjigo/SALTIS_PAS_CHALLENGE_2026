-- Désactivé tant que SALTIS.RAW.GEO_DEPARTEMENTS n'est pas chargée (GADM 4.1).
-- Activation : variable geo_departements_charge = true dans dbt_project.yml.
-- Licence GADM : usage non commercial, citation obligatoire.
{{
    config(
        materialized='view',
        enabled=var('geo_departements_charge', false)
    )
}}

select
    trim(gid_2) as gid_2,
    trim(gid_1) as gid_1,
    trim(nom_departement) as nom_departement,
    latitude_centroide,
    longitude_centroide,
    superficie_km2,
    geometrie,
    source,
    date_chargement
from {{ source('raw', 'geo_departements') }}
