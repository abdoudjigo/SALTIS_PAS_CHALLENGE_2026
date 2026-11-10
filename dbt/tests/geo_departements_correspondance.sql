-- Actif seulement quand geo_departements_charge = true (GADM chargé).
-- Vérifie que les 45 code_departement trouvent leur gid_2, sans gid_2 en trop,
-- et que la règle code_region (déduite du code département) est confirmée par gid_1.
-- Le test échoue s'il renvoie au moins une ligne.
{{ config(enabled=var('geo_departements_charge', false)) }}

with geo as (

    select gid_2, gid_1
    from {{ ref('stg_geo_departements') }}

),

dim as (

    select code_departement, code_region
    from {{ ref('dim_geographie') }}

)

select dim.code_departement as code, 'département sans gid_2' as anomalie
from dim
left join geo on geo.gid_2 = dim.code_departement
where geo.gid_2 is null

union all

select geo.gid_2, 'gid_2 sans département'
from geo
left join dim on dim.code_departement = geo.gid_2
where dim.code_departement is null

union all

select dim.code_departement, 'code_region différent de gid_1'
from dim
join geo on geo.gid_2 = dim.code_departement
where geo.gid_1 <> dim.code_region

union all

select to_varchar(count(*)), 'nombre de départements GADM différent de 45'
from geo
having count(*) <> 45
