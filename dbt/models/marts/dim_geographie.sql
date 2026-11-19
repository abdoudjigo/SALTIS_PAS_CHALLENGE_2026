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
-- latitude / longitude / zone_secondaire : seed ref_departements (fourni par Ibrahima,
-- code = code_departement). zone_secondaire signale un département de transition entre
-- deux zones : information seulement, jamais une clé d'agrégation (la zone de
-- rattachement reste zone_agroecologique).
--
-- GADM 4.1 (stg_geo_departements, gid_2 = code_departement) : branché seulement si la
-- variable geo_departements_charge vaut true, pour les contours des départements ; il
-- apporte alors latitude_centroide_gadm et longitude_centroide_gadm, sans remplacer les
-- coordonnées du seed.

{% set geo_charge = var('geo_departements_charge', false) %}

with profil as (

    select *
    from {{ ref('stg_profil_agroclimatique') }}
    where code_departement is not null

)

, ref_dep as (

    select
        trim(code_departement) as code_departement,
        nullif(trim(zone_secondaire), '') as zone_secondaire,
        latitude,
        longitude
    from {{ ref('ref_departements') }}

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

    ref_dep.zone_secondaire,

    profil.superficie_km2,
    ref_dep.latitude,
    ref_dep.longitude

    {% if geo_charge %}
    , geo.latitude_centroide as latitude_centroide_gadm
    , geo.longitude_centroide as longitude_centroide_gadm
    {% endif %}

from profil
left join ref_dep
    on ref_dep.code_departement = trim(profil.code_departement)

{% if geo_charge %}
left join geo
    on geo.gid_2 = trim(profil.code_departement)
{% endif %}
