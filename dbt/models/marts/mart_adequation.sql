-- Module B : adéquation de chaque culture et durée de cycle par département.
select
    code_departement,
    departement,
    region,
    zone_agroecologique,
    culture,
    classe_cycle,
    cycle_jours,
    proba_cycle_couvert_pct,
    besoin_eau_estime_mm,
    proba_besoin_eau_couvert_pct,
    rendement_moyen_kg_ha,
    variabilite_rendement_cv_pct,
    score_adequation,
    niveau_adequation,
    classe_texture,
    ph_eau,
    reserve_utile_mm
from {{ ref('stg_adequation') }}
where niveau_adequation is not null
