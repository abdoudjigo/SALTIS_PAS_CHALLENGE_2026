{{
    config(materialized='table')
}}

-- Grain : un département, une campagne agricole, une culture.
-- Grille complète 1981-2024 : les combinaisons sans observation sont conservées
-- avec des mesures nulles (jamais remplacées par zéro) et est_observe = false.
--
-- Exclus volontairement (grain différent) :
--   - variables climatiques département x année (pluie, SPI, démarrage, séquence sèche,
--     chaleur, NDVI) -> fact_saison_departement ;
--   - engrais_total_kg_ha et rendement_national_kg_ha (niveau national).
--
-- Pour agréger, ne jamais faire la moyenne de rendement_kg_ha :
-- calculer sum(production_t) * 1000 / sum(superficie_ha).

with source as (

    select *
    from {{ ref('stg_rendements') }}
    where code_departement is not null
      and annee is not null
      and culture is not null

)

select
    md5(
        trim(code_departement) || '|'
        || to_varchar(annee) || '|'
        || upper(trim(culture))
    ) as id_rendement,

    -- Clés vers les dimensions
    {{ cle_departement('code_departement') }} as id_departement,
    {{ cle_culture('culture') }} as id_culture,
    annee::integer as campagne_agricole,

    -- Mesures observées (DAPSA)
    superficie_recoltee_ha as superficie_ha,
    production_t,
    rendement_kg_ha,

    -- Mesures dérivées par culture
    tendance_rendement_kg_ha,
    anomalie_rendement_pct,
    indice_satisfaction_eau_pct,
    deficit_hydrique_mm,

    -- Attributs de traçabilité
    type_superficie,      -- 'récoltée' jusqu'en 2015, 'semée' ensuite
    source_rendement,

    (
        superficie_recoltee_ha is not null
        or production_t is not null
        or rendement_kg_ha is not null
    ) as est_observe

from source