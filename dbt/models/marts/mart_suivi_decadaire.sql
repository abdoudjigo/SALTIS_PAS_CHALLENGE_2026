{{
    config(materialized='table')
}}

-- Écran de suivi décade par décade (module A). Grain : département x année x décade,
-- 71 280 lignes, 44 départements (Guédiawaye absent de la source décadaire).
-- Observé, normale et écart côte à côte ; fourchette climatologique 1991-2020 du département.
--
-- pluie_normale_mm = moyenne 1991-2020 de la décade (identique à pluie_moyenne_mm de
-- fact_climatologie_decadaire, vérifié sur les 1 584 couples département x décade).
-- Cumuls et part de saison : décades 16 à 30 seulement, NULL ailleurs.
-- Les mesures climatologiques (quantiles, probabilités) sont non additives.

with pluie as (

    select *
    from {{ ref('fact_pluviometrie_decadaire') }}

),

climatologie as (

    select
        id_departement,
        numero_decade_annee,
        pluie_mediane_mm,
        pluie_1_annee_sur_5_mm,
        pluie_4_annees_sur_5_mm,
        proba_decade_seche_pct
    from {{ ref('fact_climatologie_decadaire') }}
    where niveau_geographique = 'DEPARTEMENT'

),

-- Libellé de la décade selon l'année (la 3e décade de février dépend des années bissextiles)
decades as (

    select annee, numero_decade_annee, any_value(libelle_decade) as libelle_decade
    from {{ ref('dim_temps') }}
    group by 1, 2

)

select
    -- Territoire
    g.code_departement,
    g.departement,
    g.code_region,
    g.region,
    g.zone_agroecologique,

    -- Temps
    p.annee,
    p.campagne_agricole,
    p.numero_decade_annee,
    d.libelle_decade,
    p.est_decade_saison,

    -- Décade : observé, normale, écart
    p.pluie_mm,
    p.pluie_normale_mm,
    p.pluie_mm - p.pluie_normale_mm as ecart_pluie_mm,
    p.anomalie_pluie_pct,

    -- Cumul depuis le 1er juin : observé, normale, écart
    p.cumul_depuis_juin_mm,
    p.cumul_normale_depuis_juin_mm,
    p.ecart_cumul_normale_mm,
    p.part_saison_pct,

    -- Fourchette climatologique 1991-2020 de la décade
    c.pluie_1_annee_sur_5_mm,
    c.pluie_mediane_mm,
    c.pluie_4_annees_sur_5_mm,
    c.proba_decade_seche_pct,

    -- Détail
    p.nb_jours_pluie,
    p.plus_longue_sequence_seche_j,
    p.decade_seche

from pluie p
join {{ ref('dim_geographie') }} g
    on g.id_departement = p.id_departement
left join climatologie c
    on c.id_departement = p.id_departement
   and c.numero_decade_annee = p.numero_decade_annee
left join decades d
    on d.annee = p.annee
   and d.numero_decade_annee = p.numero_decade_annee
