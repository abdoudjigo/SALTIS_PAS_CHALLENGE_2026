-- Module B : adéquation des variétés connues par département.
select
    code_departement,
    departement,
    region,
    zone_agroecologique,
    culture,
    variete,
    cycle_jours,
    zones_recommandees,
    proba_cycle_couvert_pct,
    niveau_adequation
from {{ ref('stg_adequation_varietes') }}
where niveau_adequation is not null
