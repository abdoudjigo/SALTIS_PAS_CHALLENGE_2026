-- Un département attendu une seule fois par culture ; Guédiawaye et Pikine n'y figurent jamais.

select culture, code_departement
from {{ ref('ref_departements_attendus') }}
group by culture, code_departement
having count(*) > 1

union all

select culture, code_departement
from {{ ref('ref_departements_attendus') }}
where departement in ('Guédiawaye', 'Pikine')
