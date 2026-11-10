{{
    config(materialized='table')
}}

-- Grain : une zone agroécologique, une culture. 6 zones x 12 cultures = 72 lignes.
-- Module C : écart entre rendement moyen et atteignable, facteur climatique qui pèse
-- le plus sur le rendement, et recommandations de sol.
--
-- Valeurs légitimes de facteur_limitant_principal :
--   eau, sequence_seche, chaleur, demarrage_tardif, 'aucun facteur climatique net',
--   'données insuffisantes' (33 lignes : corrélations nulles, nb_observations nul sauf
--   Casamance x Sésame, 11 observations).
--
-- Limites connues (non corrigées) :
--   - source_rendement = 'national (FAOSTAT)' sur 16 lignes : le rendement moyen et
--     atteignable y est la valeur NATIONALE, recopiée à l'identique dans plusieurs zones
--     (ex. oignon 30 555,71 kg/ha dans 6 zones). Ne pas l'interpréter comme une valeur
--     zonale ; utiliser est_rendement_national pour filtrer ;
--   - ecart_rendement_kg_ha = atteignable - moyen, négatif pour Vallée du fleuve x Sésame
--     (-26,12) ;
--   - correlation_chaleur nulle pour 5 cultures des Niayes où les autres corrélations existent.
--
-- Exclu : adequation_cycle (voir fact_adequation_culture), besoin_irrigation_normal_mm
-- (à reprendre avec les besoins).

with source as (

    select *
    from {{ ref('stg_facteurs_limitants') }}
    where zone_agroecologique is not null
      and culture is not null

)

select
    md5(upper(trim(zone_agroecologique)) || '|' || upper(trim(culture))) as id_facteur_limitant,

    -- Clés vers les dimensions
    {{ cle_zone('zone_agroecologique') }} as id_zone_agroecologique,
    {{ cle_culture('culture') }} as id_culture,

    -- Rendements
    nb_observations,
    rendement_moyen_kg_ha,
    rendement_atteignable_kg_ha,
    ecart_rendement_kg_ha,
    trim(source_rendement) as source_rendement,
    trim(source_rendement) ilike 'national%' as est_rendement_national,

    -- Facteur limitant et corrélations avec le rendement
    trim(facteur_limitant_principal) as facteur_limitant_principal,
    correlation_eau,
    correlation_sequence_seche,
    correlation_chaleur,
    correlation_demarrage_tardif,

    -- Recommandations de sol
    lower(trim(apport_organique_recommande)) = 'oui' as apport_organique_recommande,
    lower(trim(amendement_ph_recommande)) = 'oui' as amendement_ph_recommande,
    lower(trim(fractionnement_azote_recommande)) = 'oui' as fractionnement_azote_recommande

from source
