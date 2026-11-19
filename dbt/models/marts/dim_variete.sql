{{
    config(materialized='table')
}}

with varietes as (

    select distinct
        upper(trim(culture)) as culture,
        trim(variete) as variete,
        obtenteur,
        annee_homologation,
        cycle_jours,
        tolerance_secheresse,
        rendement_potentiel_kg_ha,
        zones_recommandees,
        disponibilite_semences,
        caracteristiques,
        source

    from {{ ref('stg_varietes') }}

    where culture is not null
      and trim(culture) <> ''
      and variete is not null
      and trim(variete) <> ''

)

select
    md5(concat(culture, '|', upper(variete))) as id_variete,

    md5(culture) as id_culture,
    culture,
    variete,
    obtenteur,
    annee_homologation,
    cycle_jours,
    tolerance_secheresse,
    rendement_potentiel_kg_ha,
    zones_recommandees,
    disponibilite_semences,
    caracteristiques,
    source

from varietes