-- code_region (déduit du code département, règle GADM) et nom de région
-- doivent se correspondre un pour un : 14 codes, 14 noms.
-- Le test échoue s'il renvoie au moins une ligne.

with geo as (

    select code_region, region
    from {{ ref('dim_geographie') }}

)

select code_region as valeur, 'code_region associé à plusieurs régions' as anomalie
from geo
group by code_region
having count(distinct region) > 1

union all

select region, 'région associée à plusieurs code_region'
from geo
group by region
having count(distinct code_region) > 1

union all

select to_varchar(count(distinct code_region)) || ' codes / ' || to_varchar(count(distinct region)) || ' régions',
       'nombre de régions différent de 14'
from geo
having count(distinct code_region) <> 14
    or count(distinct region) <> 14
