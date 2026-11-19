
{{
    config(materialized='view')
}}

with besoins_departement as (

    select *
    from {{ ref('stg_besoins_culture') }}

),

references_zone as (

    select
        zone_agroecologique,
        culture,

        dose_n_recommandee_kg_ha as dose_n_zone_kg_ha,
        dose_p2o5_recommandee_kg_ha as dose_p2o5_zone_kg_ha,
        dose_k2o_recommandee_kg_ha as dose_k2o_zone_kg_ha,
        statut_dose as statut_dose_zone,

        dose_semis_kg_ha as dose_semis_zone_kg_ha,
        statut_dose_semis as statut_dose_semis_zone

    from {{ ref('stg_besoins_hectare') }}

)

select
    b.*,

    z.dose_n_zone_kg_ha,
    z.dose_p2o5_zone_kg_ha,
    z.dose_k2o_zone_kg_ha,
    z.statut_dose_zone,

    z.dose_semis_zone_kg_ha,
    z.statut_dose_semis_zone,

    case
        when b.dose_n_recommandee_kg_ha is null
          or z.dose_n_zone_kg_ha is null
            then 'A_VERIFIER'
        when b.dose_n_recommandee_kg_ha = z.dose_n_zone_kg_ha
            then 'COHERENT'
        else 'ECART'
    end as coherence_dose_n,

    case
        when b.dose_semis_kg_ha is null
          or z.dose_semis_zone_kg_ha is null
            then 'A_VERIFIER'
        when b.dose_semis_kg_ha = z.dose_semis_zone_kg_ha
            then 'COHERENT'
        else 'ECART'
    end as coherence_dose_semis

from besoins_departement b

left join references_zone z
    on b.zone_agroecologique = z.zone_agroecologique
   and b.culture = z.culture