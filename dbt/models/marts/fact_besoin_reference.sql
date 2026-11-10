{{
    config(materialized='table')
}}

-- Besoins de référence HISTORIQUES, PAS PRÉVISIONNELS (règle 7).
-- Grain : un département, une culture. 367 lignes, 43 départements.
-- Besoin (t) = superficie_reference_ha x dose de référence de la zone / 1000
-- (fumier : t/ha, donc sans division). Calculé par la source, vérifié (écart <= 0,03 t).
--
-- superficie_reference_ha : moyenne des dernières campagnes connues (annees_reference),
-- superficie semée ou récoltée selon type_superficie. Les années de référence varient
-- fortement d'un département à l'autre (de 2003-2004 à 2019-2021).
--
-- Limites connues :
--   - Guédiawaye et Pikine (Dakar, Niayes) absents : aucune superficie de référence ;
--   - besoin nul (null) quand la dose est à compléter, jamais remplacé par 0 ;
--     besoin à 0 quand la superficie de référence est 0 (22 lignes) ou la dose vaut 0 ;
--   - « Riz (irrigué) » inclut le riz pluvial de Casamance : besoin_semences_t (repiquage
--     irrigué, 40 kg/ha) ne s'applique pas au riz pluvial ;
--   - statuts calculés avec la même correspondance que fact_reference_agronomique
--     (macros/statuts_doses.sql).
--
-- Exclu : doses par hectare, formule, irrigation par hectare (références de ZONE recopiées
-- sur chaque département : voir fact_reference_agronomique, jointure par zone et culture).

with source as (

    select *
    from {{ ref('int_reference_besoins_departement_culture') }}
    where code_departement is not null
      and culture is not null

)

select
    md5(trim(code_departement) || '|' || upper(trim(culture))) as id_besoin_reference,

    -- Clés vers les dimensions
    {{ cle_departement('code_departement') }} as id_departement,
    {{ cle_culture('culture') }} as id_culture,

    -- Superficie de référence
    superficie_reference_ha,
    trim(annees_reference) as annees_reference,
    trim(type_superficie) as type_superficie,

    -- Besoins en éléments fertilisants (t)
    besoin_azote_n_t,
    besoin_phosphate_p2o5_t,
    besoin_potasse_k2o_t,

    -- Besoins en produits (t)
    besoin_npk_15_15_15_t,
    besoin_uree_t,
    besoin_dap_t,
    besoin_fumier_t,
    besoin_semences_t,

    -- Statut des doses utilisées
    {{ statut_validation_engrais('statut_dose') }} as statut_validation_engrais,
    {{ source_reference_engrais('statut_dose', 'origine_dose') }} as source_reference_engrais,
    {{ statut_validation_semis('statut_dose_semis', 'zone_agroecologique') }} as statut_validation_semis,
    {{ source_reference_semis('origine_dose_semis', 'zone_agroecologique') }} as source_reference_semis,

    -- Cohérence entre la dose départementale et la référence de zone
    coherence_dose_n,
    coherence_dose_semis

from source
