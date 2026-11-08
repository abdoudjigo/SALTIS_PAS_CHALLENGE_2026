-- Module A : une ligne par département et saison, avec le risque résumé
select
    *,
    case
        when alerte_secheresse then 'sécheresse'
        when alerte_exces_pluie then 'excès de pluie'
        else 'normal'
    end as risque_saison
from {{ ref('stg_saisons') }}
