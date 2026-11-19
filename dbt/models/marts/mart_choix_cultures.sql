{{
    config(materialized='table')
}}

-- Écran choix des cultures et des variétés (module B).
-- Grain : département x culture x type_option x option.
--   - type_option = 'CYCLE'   : option = classe de cycle (courte / moyenne / longue), 1 620 lignes ;
--   - type_option = 'VARIETE' : option = nom de la variété documentée, 90 lignes.
-- Les colonnes propres à un type sont NULL pour l'autre.
--
-- Règle validée : comparer les options sur proba_cycle_couvert_pct (rang_option), pas sur
-- le score.
--
-- Cycles : valeurs principales = valeurs finales de l'équipe (fact_adequation_culture,
-- colonnes _final : cycle moyen = source ; cycles court et long = cycle moyen de la source
-- + écart décadaire calculé entre le cycle et le cycle moyen). Les valeurs de la source
-- restent à côté (suffixe _source) ; la source reprend la part « eau » du cycle moyen pour
-- les cycles court et long. Sans données décadaires (cycles court et long de Guédiawaye),
-- le niveau principal reprend celui de la source
-- (methode_niveau = 'source, sans données décadaires').
-- Seuils : cultures adaptée > 80, à risque > 50 (source et calcul) ; variétés adaptée >= 80
-- (source).

with cycles as (

    select
        a.id_departement,
        a.id_culture,
        'CYCLE' as type_option,
        a.classe_cycle as option,
        a.cycle_jours,
        a.proba_cycle_couvert_pct,
        a.score_adequation_final as score_adequation,
        a.proba_besoin_eau_couvert_final_pct as proba_besoin_eau_couvert_pct,
        a.nb_annees_calc,
        coalesce(a.niveau_adequation_final, a.niveau_adequation) as niveau_adequation,
        case
            when a.niveau_adequation in ('irrigation requise', 'non évaluée (culture pluriannuelle)')
                then 'source'
            when a.niveau_adequation_final is null then 'source, sans données décadaires'
            else a.methode_eau
        end as methode_niveau,
        a.score_adequation as score_adequation_source,
        a.proba_besoin_eau_couvert_pct as proba_besoin_eau_couvert_pct_source,
        a.niveau_adequation as niveau_adequation_source,
        case
            when a.score_adequation_final is null then null
            when a.classe_cycle = 'moyenne' then 'probabilité eau de la source'
            else 'probabilité eau ancrée sur le cycle moyen de la source (écart décadaire entre cycles)'
        end as note_score,
        cast(null as varchar) as tolerance_secheresse,
        cast(null as varchar) as disponibilite_semences,
        cast(null as varchar) as zones_recommandees
    from {{ ref('fact_adequation_culture') }} a

),

varietes as (

    select
        a.id_departement,
        a.id_culture,
        'VARIETE' as type_option,
        v.variete as option,
        v.cycle_jours,
        a.proba_cycle_couvert_pct,
        cast(null as float) as score_adequation,
        cast(null as float) as proba_besoin_eau_couvert_pct,
        cast(null as integer) as nb_annees_calc,
        a.niveau_adequation,
        'source' as methode_niveau,
        cast(null as float) as score_adequation_source,
        cast(null as float) as proba_besoin_eau_couvert_pct_source,
        a.niveau_adequation as niveau_adequation_source,
        cast(null as varchar) as note_score,
        v.tolerance_secheresse::varchar as tolerance_secheresse,
        v.disponibilite_semences::varchar as disponibilite_semences,
        v.zones_recommandees::varchar as zones_recommandees
    from {{ ref('fact_adequation_variete') }} a
    join {{ ref('dim_variete') }} v
        on v.id_variete = a.id_variete

),

options as (

    select * from cycles
    union all
    select * from varietes

)

select
    -- Territoire
    g.code_departement,
    g.departement,
    g.code_region,
    g.region,
    g.zone_agroecologique,

    -- Option
    c.culture,
    o.type_option,
    o.option,
    o.cycle_jours,

    -- Comparaison : probabilité de cycle couvert (rang 1 = meilleure, au sein du
    -- département x culture x type d'option ; NULL si la probabilité est inconnue)
    o.proba_cycle_couvert_pct,
    iff(o.proba_cycle_couvert_pct is null, null,
        rank() over (
            partition by o.id_departement, o.id_culture, o.type_option, o.proba_cycle_couvert_pct is null
            order by o.proba_cycle_couvert_pct desc
        )
    ) as rang_option,

    -- Valeurs principales : score (cycles seulement) et niveau
    o.score_adequation,
    o.proba_besoin_eau_couvert_pct,
    o.nb_annees_calc,
    o.niveau_adequation,
    o.methode_niveau,
    o.note_score,

    -- Valeurs de la source, pour comparaison
    o.score_adequation_source,
    o.proba_besoin_eau_couvert_pct_source,
    o.niveau_adequation_source,

    -- Variété seulement
    o.tolerance_secheresse,
    o.disponibilite_semences,
    o.zones_recommandees

from options o
join {{ ref('dim_geographie') }} g
    on g.id_departement = o.id_departement
join {{ ref('dim_culture') }} c
    on c.id_culture = o.id_culture
