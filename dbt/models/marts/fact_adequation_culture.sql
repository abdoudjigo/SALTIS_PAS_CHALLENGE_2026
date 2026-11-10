{{
    config(materialized='table')
}}

-- Grain : un département, une culture, une classe de cycle (courte / moyenne / longue).
-- 45 départements x 12 cultures x 3 cycles = 1 620 lignes.
--
-- Calcul du score par la source (vérifié sur les 1 080 lignes notées, sans correction) :
--   score_adequation = round(0,6 x proba_cycle_couvert_pct du cycle
--                          + 0,4 x proba_besoin_eau_couvert_pct du cycle MOYEN)
--   -> pour les cycles court et long, la part « eau » du score reprend la probabilité
--      calculée pour le cycle moyen, même si besoin_eau_estime_mm diffère par cycle.
--      C'est pourquoi proba_besoin_eau_couvert_pct n'est renseignée que pour le cycle moyen.
--   niveau_adequation, sur le score arrondi : adaptée si > 80, à risque si > 50 et <= 80,
--   déconseillée si <= 50 (seuils stricts : un score de 80 est « à risque »).
--
-- score_adequation est nul, volontairement, pour :
--   - 'irrigation requise' (riz irrigué, oignon, tomate : 405 lignes) ;
--   - 'non évaluée (culture pluriannuelle)' (manioc : 135 lignes, proba_cycle nulle).
--
-- Exclu (constant sur les 3 cycles d'un même département x culture, vérifié) :
-- rendement_moyen_kg_ha, variabilite_rendement_cv_pct (voir fact_rendement_departement),
-- classe_texture, ph_eau, reserve_utile_mm (profil de sol du département).

with source as (

    select *
    from {{ ref('stg_adequation') }}
    where code_departement is not null
      and culture is not null
      and classe_cycle is not null

)

select
    md5(trim(code_departement) || '|' || upper(trim(culture)) || '|' || lower(trim(classe_cycle))) as id_adequation_culture,

    -- Clés vers les dimensions
    {{ cle_departement('code_departement') }} as id_departement,
    {{ cle_culture('culture') }} as id_culture,
    lower(trim(classe_cycle)) as classe_cycle,

    -- Cycle et couverture climatique
    cycle_jours,
    proba_cycle_couvert_pct,
    besoin_eau_estime_mm,
    proba_besoin_eau_couvert_pct,

    -- Résultat
    score_adequation,
    trim(niveau_adequation) as niveau_adequation

from source
