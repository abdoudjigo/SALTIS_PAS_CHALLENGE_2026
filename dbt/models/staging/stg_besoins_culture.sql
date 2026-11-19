
select
    code_departement,
    departement,
    region,
    zone_agroecologique,
    culture,
    superficie_reference_ha,
    annees_reference,
    type_superficie,

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

    besoin_azote_n_t,
    besoin_phosphate_p2o5_t,
    besoin_potasse_k2o_t,
    besoin_npk_15_15_15_t,
    besoin_uree_t,
    besoin_dap_t,
    besoin_semences_t,
    besoin_fumier_t,

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

from {{ source('raw', 'c_besoins_departement_culture') }}
