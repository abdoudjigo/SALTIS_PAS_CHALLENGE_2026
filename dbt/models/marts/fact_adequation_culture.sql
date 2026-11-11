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
-- Colonnes de l'équipe, à côté des colonnes de la source qui restent inchangées
-- (methode_eau = 'FAO décadaire v1, ancrage sur le cycle moyen de la source') :
--   proba_besoin_eau_couvert_calc_pct, nb_annees_calc : calcul brut par cycle
--     (int_couverture_eau_cycle), gardé pour la traçabilité et le contrôle B2 ;
--   proba_besoin_eau_couvert_final_pct :
--     - cycle moyen : valeur de la source ;
--     - cycles court et long : proba moyen (source) + (proba calculée du cycle
--       - proba calculée du cycle moyen), bornée entre 0 et 100.
--     L'ancrage supprime l'écart de méthode (biais de -3,5 points sur le cycle moyen) :
--     seul l'écart entre cycles vient du calcul décadaire ;
--   score_adequation_final = round(0,6 x proba_cycle_couvert_pct + 0,4 x proba finale) ;
--   niveau_adequation_final : mêmes seuils que la source (> 80 adaptée, > 50 à risque,
--   sinon déconseillée) ; valeur de la source pour 'irrigation requise' et
--   'non évaluée (culture pluriannuelle)' ; NULL quand la probabilité finale manque
--   (cycles court et long de Guédiawaye, absent des données décadaires).
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

),

base as (

    select
        md5(trim(s.code_departement) || '|' || upper(trim(s.culture)) || '|' || lower(trim(s.classe_cycle))) as id_adequation_culture,
        {{ cle_departement('s.code_departement') }} as id_departement,
        {{ cle_culture('s.culture') }} as id_culture,
        lower(trim(s.classe_cycle)) as classe_cycle,
        s.cycle_jours,
        s.proba_cycle_couvert_pct,
        s.besoin_eau_estime_mm,
        s.proba_besoin_eau_couvert_pct,
        s.score_adequation,
        trim(s.niveau_adequation) as niveau_adequation
    from source s

),

calcule as (

    select
        b.*,
        e.proba_besoin_eau_couvert_calc_pct,
        e.nb_annees_calc,
        -- cycle moyen du même département x culture : source et calcul brut
        max(iff(b.classe_cycle = 'moyenne', b.proba_besoin_eau_couvert_pct, null))
            over (partition by b.id_departement, b.id_culture) as proba_eau_moyen_source,
        max(iff(b.classe_cycle = 'moyenne', e.proba_besoin_eau_couvert_calc_pct, null))
            over (partition by b.id_departement, b.id_culture) as proba_eau_moyen_calc
    from base b
    left join {{ ref('int_couverture_eau_cycle') }} e
        on e.id_departement = b.id_departement
       and e.id_culture = b.id_culture
       and e.classe_cycle = b.classe_cycle

),

final as (

    select
        c.*,
        case
            when c.niveau_adequation in ('irrigation requise', 'non évaluée (culture pluriannuelle)') then null
            when c.classe_cycle = 'moyenne' then c.proba_besoin_eau_couvert_pct
            else round(least(greatest(
                     c.proba_eau_moyen_source + (c.proba_besoin_eau_couvert_calc_pct - c.proba_eau_moyen_calc),
                 0), 100), 2)
        end as proba_besoin_eau_couvert_final_pct
    from calcule c

),

score as (

    select
        f.*,
        round(0.6 * f.proba_cycle_couvert_pct + 0.4 * f.proba_besoin_eau_couvert_final_pct) as score_adequation_final
    from final f

)

select
    id_adequation_culture,

    -- Clés vers les dimensions
    id_departement,
    id_culture,
    classe_cycle,

    -- Cycle et couverture climatique (source)
    cycle_jours,
    proba_cycle_couvert_pct,
    besoin_eau_estime_mm,
    proba_besoin_eau_couvert_pct,

    -- Résultat (source)
    score_adequation,
    niveau_adequation,

    -- Calcul brut de l'équipe (traçabilité, contrôle B2)
    proba_besoin_eau_couvert_calc_pct,
    nb_annees_calc,

    -- Valeurs finales : couverture en eau propre à chaque cycle, ancrée sur le cycle moyen
    proba_besoin_eau_couvert_final_pct,
    score_adequation_final,
    case
        when niveau_adequation in ('irrigation requise', 'non évaluée (culture pluriannuelle)')
            then niveau_adequation
        when score_adequation_final is null then null
        when score_adequation_final > 80 then 'adaptée'
        when score_adequation_final > 50 then 'à risque'
        else 'déconseillée'
    end as niveau_adequation_final,
    'FAO décadaire v1, ancrage sur le cycle moyen de la source' as methode_eau

from score
