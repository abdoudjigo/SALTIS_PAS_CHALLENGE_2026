-- Seed ref_departements (coordonnées et zone secondaire) face à dim_geographie.
-- Le test échoue s'il renvoie au moins une ligne :
--   - les 45 départements de dim_geographie ont une latitude et une longitude ;
--   - chaque code du seed existe dans dim_geographie, avec la même zone ;
--   - les coordonnées restent dans l'emprise du Sénégal ;
--   - zone_secondaire, quand elle est renseignée, diffère de la zone principale.

with geo as (

    select * from {{ ref('dim_geographie') }}

),

seed as (

    select
        trim(code_departement) as code_departement,
        upper(trim(zone_agroecologique)) as zone_agroecologique,
        latitude,
        longitude
    from {{ ref('ref_departements') }}

)

select code_departement, 'département sans latitude ou longitude' as anomalie
from geo
where latitude is null or longitude is null

union all

select to_varchar(count(*)), 'dim_geographie doit compter 45 départements avec coordonnées'
from geo
where latitude is not null and longitude is not null
having count(*) <> 45

union all

select s.code_departement, 'code du seed absent de dim_geographie'
from seed s
left join geo g on g.code_departement = s.code_departement
where g.code_departement is null

union all

select s.code_departement, 'zone du seed différente de dim_geographie'
from seed s
join geo g on g.code_departement = s.code_departement
where s.zone_agroecologique <> g.zone_agroecologique

union all

select code_departement, 'coordonnées hors de l''emprise du Sénégal'
from geo
where latitude not between 12 and 17
   or longitude not between -18 and -11

union all

select code_departement, 'zone secondaire égale à la zone principale'
from geo
where zone_secondaire is not null
  and upper(zone_secondaire) = zone_agroecologique
