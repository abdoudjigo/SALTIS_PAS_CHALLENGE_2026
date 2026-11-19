{{
    config(materialized='table')
}}

-- Une ligne par région administrative (14).
-- Source : profil agroclimatique (une ligne par département), agrégé par région.
--
-- Région et zone agroécologique sont deux regroupements parallèles des départements,
-- pas une hiérarchie : Louga, Matam et Tambacounda s'étendent chacune sur deux zones.
-- Aucun lien région -> zone n'est porté ici ; passer par dim_geographie.
--
-- code_region : déduit du code département selon la règle GADM
-- (SEN.10.1_1 -> SEN.10_1), à confirmer avec GID_1 à réception du fichier GADM.
-- Si deux codes différents apparaissaient pour une même région, la région serait
-- dupliquée et le test d'unicité échouerait.

with departements as (

    select
        trim(region) as region,
        {{ code_region_depuis_departement('code_departement') }} as code_region,
        superficie_km2
    from {{ ref('stg_profil_agroclimatique') }}
    where code_departement is not null
      and region is not null

)

select
    {{ cle_region('region') }} as id_region,
    code_region,
    region,
    count(*) as nb_departements,
    sum(superficie_km2) as superficie_km2

from departements

group by region, code_region
