-- Probabilité de couverture du besoin en eau, calculée pour les 3 classes de cycle.
-- Grain : département x culture x classe_cycle (comme fact_adequation_culture).
--
-- Pourquoi : la source ne calcule proba_besoin_eau_couvert_pct que pour le cycle moyen et
-- reprend cette valeur dans le score des cycles court et long. On la recalcule ici pour les
-- 3 cycles, sans modifier les colonnes de la source (méthode 'FAO décadaire v1').
--
-- Méthode (approximation décadaire, validée sur le cycle moyen : test
-- int_couverture_eau_cycle_controle_moyen) :
--   - années 1991-2020 ;
--   - décade de début = décade de l'année (1 à 36) contenant debut_saison_jour
--     (decade_mois = least(ceil(jour du mois / 10), 3), comme dim_temps) ;
--   - le cycle couvre ceil(cycle_jours / 10) décades à partir de la décade de début
--     (peut dépasser la décade 30 ; au-delà de la décade 36, le cycle se poursuit sur
--     les décades de janvier de l'année suivante : cas du coton quand la saison démarre
--     tard, sinon ces années sortiraient du calcul) ;
--   - pluie efficace par décade (formule FAO / USDA ramenée à la décade) :
--       pluie > 25 mm : 0,8 x pluie - 25/3 ; sinon max(0,6 x pluie - 10/3, 0) ;
--   - année couverte si la somme des pluies efficaces >= 0,8 x besoin_eau_estime_mm ;
--   - proba = 100 x années couvertes / années avec un début de saison et toutes les
--     décades du cycle renseignées (nb_annees_calc).
-- NULL : aucune année disponible (Guédiawaye, absent des données décadaires), et lignes
-- 'irrigation requise' ou 'non évaluée (culture pluriannuelle)'.
--
-- Les sources sont lues en staging (mêmes valeurs que fact_saison_departement,
-- fact_pluviometrie_decadaire et fact_adequation_culture, qui les reprennent telles quelles)
-- pour que fact_adequation_culture puisse s'appuyer sur ce modèle.

with cycles as (

    select
        trim(code_departement) as code_departement,
        upper(trim(culture)) as culture,
        lower(trim(classe_cycle)) as classe_cycle,
        trim(niveau_adequation) as niveau_adequation,
        cycle_jours,
        besoin_eau_estime_mm,
        ceil(cycle_jours / 10)::integer as nb_decades_cycle
    from {{ ref('stg_adequation') }}
    where code_departement is not null
      and culture is not null
      and classe_cycle is not null

),

debuts as (

    select
        trim(code_departement) as code_departement,
        annee::integer as annee,
        dateadd(day, debut_saison_jour - 1, date_from_parts(annee, 1, 1)) as date_debut
    from {{ ref('stg_saisons') }}
    where annee between 1991 and 2020
      and debut_saison_jour is not null

),

debuts_decade as (

    select
        code_departement,
        annee,
        ((month(date_debut) - 1) * 3 + least(ceil(day(date_debut) / 10), 3))::integer as decade_debut
    from debuts

),

pluie as (

    select
        trim(code_departement) as code_departement,
        annee::integer as annee,
        decade::integer as decade,
        annee::integer * 36 + decade::integer as decade_absolue,
        iff(pluie_mm > 25, 0.8 * pluie_mm - 25 / 3, greatest(0.6 * pluie_mm - 10 / 3, 0)) as pluie_efficace_mm
    from {{ ref('stg_suivi_pluie') }}
    where annee between 1991 and 2021  -- 2021 : fin des cycles longs démarrés tard en 2020
      and pluie_mm is not null

),

annees as (

    -- une ligne par cycle évaluable x année avec un début de saison
    select
        c.code_departement,
        c.culture,
        c.classe_cycle,
        c.besoin_eau_estime_mm,
        c.nb_decades_cycle,
        d.annee,
        count(p.decade_absolue) as nb_decades_disponibles,
        sum(p.pluie_efficace_mm) as pluie_efficace_cycle_mm
    from cycles c
    join debuts_decade d
        on d.code_departement = c.code_departement
    left join pluie p
        on p.code_departement = d.code_departement
       and p.decade_absolue between d.annee * 36 + d.decade_debut
                                and d.annee * 36 + d.decade_debut + c.nb_decades_cycle - 1
    where c.niveau_adequation not in ('irrigation requise', 'non évaluée (culture pluriannuelle)')
      and c.besoin_eau_estime_mm is not null
      and c.nb_decades_cycle is not null
    group by 1, 2, 3, 4, 5, 6

),

par_cycle as (

    select
        code_departement,
        culture,
        classe_cycle,
        count_if(nb_decades_disponibles = nb_decades_cycle) as nb_annees_calc,
        count_if(nb_decades_disponibles = nb_decades_cycle
                 and pluie_efficace_cycle_mm >= 0.8 * besoin_eau_estime_mm) as nb_annees_couvertes
    from annees
    group by 1, 2, 3

)

select
    {{ cle_departement('c.code_departement') }} as id_departement,
    {{ cle_culture('c.culture') }} as id_culture,
    c.classe_cycle,
    c.nb_decades_cycle,
    iff(coalesce(p.nb_annees_calc, 0) = 0, null, p.nb_annees_calc) as nb_annees_calc,
    iff(coalesce(p.nb_annees_calc, 0) = 0, null, p.nb_annees_couvertes) as nb_annees_couvertes,
    iff(coalesce(p.nb_annees_calc, 0) = 0, null,
        round(100 * p.nb_annees_couvertes / p.nb_annees_calc, 1)) as proba_besoin_eau_couvert_calc_pct,
    'FAO décadaire v1' as methode_eau_calc

from cycles c
left join par_cycle p
    on p.code_departement = c.code_departement
   and p.culture = c.culture
   and p.classe_cycle = c.classe_cycle
