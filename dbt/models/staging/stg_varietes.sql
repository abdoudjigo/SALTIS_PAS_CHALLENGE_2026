select
    culture,
    variete,
    obtenteur,
    annee_homologation,
    cycle_jours,
    classe_cycle,
    tolerance_secheresse,
    besoin_eau_mm,
    rendement_potentiel_kg_ha,
    zones_recommandees,
    pluie_min_mm,
    pluie_max_mm,
    tolerance_salinite,
    disponibilite_semences,
    caracteristiques,
    source
from {{ source('raw', 'b_referentiel_varietes') }}
