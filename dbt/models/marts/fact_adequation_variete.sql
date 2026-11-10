{{
    config(materialized='table')
}}

-- Grain : un département, une variété documentée.
-- 45 départements x 2 variétés = 90 lignes.
--
-- Limites connues :
--   - « Mil souna (type hâtif) » est absent : cycle inconnu dans le référentiel,
--     adéquation non calculable (présent dans dim_variete, sans ligne ici) ;
--   - Sahel 177 (riz irrigué) : proba_cycle_couvert_pct nulle sur les 45 lignes,
--     niveau 'irrigation requise' (culture irriguée, pas d'évaluation pluviale) ;
--   - « Mil sanio » est rattaché à la culture « Mil (souna) », libellé générique du mil chez DAPSA.
--
-- Exclu : cycle_jours et zones_recommandees (attributs de la variété, portés par dim_variete).

with source as (

    select *
    from {{ ref('stg_adequation_varietes') }}
    where code_departement is not null
      and culture is not null
      and variete is not null

)

select
    md5(trim(code_departement) || '|' || upper(trim(culture)) || '|' || upper(trim(variete))) as id_adequation_variete,

    -- Clés vers les dimensions
    {{ cle_departement('code_departement') }} as id_departement,
    {{ cle_culture('culture') }} as id_culture,
    {{ cle_variete('culture', 'variete') }} as id_variete,

    -- Résultat
    proba_cycle_couvert_pct,
    trim(niveau_adequation) as niveau_adequation

from source
