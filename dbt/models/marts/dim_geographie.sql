{{
    config(materialized='table')
}}

-- Une ligne par département (45).
-- Source : profil agroclimatique, qui contient déjà une ligne par département.
-- Zone agroécologique et région sont deux regroupements parallèles des départements,
-- pas une hiérarchie : un département appartient à une seule zone et à une seule région,
-- mais Louga, Matam et Tambacounda s'étendent chacune sur deux zones.

select
    md5(trim(code_departement)) as id_departement,
    trim(code_departement) as code_departement,
    trim(departement) as departement,
    trim(region) as region,

    md5(upper(trim(zone_agroecologique))) as id_zone_agroecologique,
    upper(trim(zone_agroecologique)) as zone_agroecologique,

    superficie_km2

from {{ ref('stg_profil_agroclimatique') }}

where code_departement is not null