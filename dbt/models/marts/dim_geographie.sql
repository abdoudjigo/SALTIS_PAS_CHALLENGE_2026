{{
    config(materialized='table')
}}

-- Une ligne par département (45).
-- Source : profil agroclimatique, qui contient déjà une ligne par département.
-- Zone agroécologique et région sont deux regroupements parallèles des départements,
-- pas une hiérarchie : un département appartient à une seule zone et à une seule région,
-- mais Louga, Matam et Tambacounda s'étendent chacune sur deux zones.
--
-- code_region : déduit du code département selon la règle GADM
-- (SEN.10.1_1 -> SEN.10_1), à confirmer avec GID_1 à réception du fichier GADM.
--
-- Latitude / longitude : branchées sur stg_geo_departements (GADM 4.1, gid_2 =
-- code_departement) uniquement si la variable geo_departements_charge vaut true.
-- Tant que le fichier n'est pas chargé, ces colonnes n'existent pas.

{% set geo_charge = var('geo_departements_charge', false) %}

with profil as (

    select *
    from {{ ref('stg_profil_agroclimatique') }}
    where code_departement is not null

)

{% if geo_charge %}
, geo as (

    select gid_2, latitude_centroide, longitude_centroide
    from {{ ref('stg_geo_departements') }}

)
{% endif %}

select
    {{ cle_departement('profil.code_departement') }} as id_departement,
    trim(profil.code_departement) as code_departement,
    trim(profil.departement) as departement,

    {{ cle_region('profil.region') }} as id_region,
    {{ code_region_depuis_departement('profil.code_departement') }} as code_region,
    trim(profil.region) as region,

    {{ cle_zone('profil.zone_agroecologique') }} as id_zone_agroecologique,
    upper(trim(profil.zone_agroecologique)) as zone_agroecologique,

    profil.superficie_km2

    {% if geo_charge %}
    , geo.latitude_centroide as latitude
    , geo.longitude_centroide as longitude
    {% endif %}

from profil

{% if geo_charge %}
left join geo
    on geo.gid_2 = trim(profil.code_departement)
{% endif %}
