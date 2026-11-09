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
from {{ source('raw', 'b_adequation_variete_departement') }}
