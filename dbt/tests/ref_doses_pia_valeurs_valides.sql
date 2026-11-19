-- Contrôles du seed ref_doses_pia. Le test échoue s'il renvoie au moins une ligne.

with pia as (
    select * from {{ ref('ref_doses_pia') }}
)

-- Clé (culture, zone, code_intrant) unique (zone vide = nationale)
select culture || '|' || coalesce(zone_agroecologique, 'NATIONAL') || '|' || code_intrant as cle,
       'clé dupliquée' as anomalie
from pia
group by culture, coalesce(zone_agroecologique, 'NATIONAL'), code_intrant
having count(*) > 1

union all

-- Dose positive ou nulle, dans la fourchette quand elle est donnée
select culture || '|' || code_intrant, 'dose négative ou hors fourchette'
from pia
where dose < 0
   or dose < dose_min
   or dose > dose_max

union all

-- Portée cohérente avec la zone
select culture || '|' || code_intrant, 'portée incohérente avec la zone'
from pia
where (portee_geographique = 'NATIONAL') <> (zone_agroecologique is null)
