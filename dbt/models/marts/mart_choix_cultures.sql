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
-- le score. Le score des cycles court et long reprend la part « eau » du cycle moyen
-- (note_score). Seuils du niveau (source) : cultures adaptée > 80, à risque > 50 ;
-- variétés adaptée >= 80.

with cycles as (

    select
        a.id_departement,
        a.id_culture,
        'CYCLE' as type_option,
        a.classe_cycle as option,
        a.cycle_jours,
        a.proba_cycle_couvert_pct,
        a.score_adequation,
        a.proba_besoin_eau_couvert_pct,
        a.niveau_adequation,
        case
            when a.classe_cycle in ('courte', 'longue') and a.score_adequation is not null
                then 'score calculé avec la part eau du cycle moyen'
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
        a.niveau_adequation,
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

    -- Score (cycles seulement) et niveau
    o.score_adequation,
    o.proba_besoin_eau_couvert_pct,
    o.niveau_adequation,
    o.note_score,

    -- Variété seulement
    o.tolerance_secheresse,
    o.disponibilite_semences,
    o.zones_recommandees

from options o
join {{ ref('dim_geographie') }} g
    on g.id_departement = o.id_departement
join {{ ref('dim_culture') }} c
    on c.id_culture = o.id_culture
