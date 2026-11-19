select
    zone_agroecologique,
    culture,

    dose_n_recommandee_kg_ha,
    dose_p2o5_recommandee_kg_ha,
    dose_k2o_recommandee_kg_ha,
    formule_engrais_recommandee,
    statut_dose,

    besoin_irrigation_normal_mm,
    volume_irrigation_m3_ha,

    npk_15_15_15_kg_ha,
    uree_kg_ha,
    dap_kg_ha,
    fumier_t_ha,
    origine_dose,

    dose_semis_kg_ha,
    statut_dose_semis,
    origine_dose_semis,

    case
        when dose_n_recommandee_kg_ha is null
          or dose_n_recommandee_kg_ha <= 0
        then true else false
    end as dose_n_a_verifier,

    case
        when dose_p2o5_recommandee_kg_ha is null
          or dose_p2o5_recommandee_kg_ha <= 0
        then true else false
    end as dose_p2o5_a_verifier,

    case
        when dose_k2o_recommandee_kg_ha is null
          or dose_k2o_recommandee_kg_ha <= 0
        then true else false
    end as dose_k2o_a_verifier,

    case
        when dose_semis_kg_ha is null
          or dose_semis_kg_ha <= 0
        then true else false
    end as dose_semis_a_verifier

from {{ source('raw', 'c_besoins_par_hectare') }}
