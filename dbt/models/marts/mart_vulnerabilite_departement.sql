{{
    config(materialized='table')
}}

-- Grain : un département (45).
-- Score de vulnérabilité agricole RELATIF et INDICATIF (méthode v1, validée en A6) :
-- il classe les départements entre eux, il ne mesure pas un risque absolu.
-- À valider avec les techniciens avant tout usage comme règle de priorité (AgroDistrib).
--
-- Méthode :
--   - normalisation : rang centile 0-100 parmi les départements renseignés (ex aequo :
--     rang moyen) ; 100 = le plus vulnérable ;
--   - aléa sécheresse (60 %) = moyenne des rangs de :
--       freq_alerte_secheresse_pct (1991-2020, sens direct),
--       variabilite_pluie_cv_pct (sens direct),
--       pluie_saison_annee_seche_mm (sens INVERSE : moins de pluie = plus vulnérable) ;
--   - sensibilité des rendements (40 %) = 0,7 x rang de variabilite_rendement_pct
--       + 0,3 x rang inversé de tendance_rendement_pct_an (baisse = plus vulnérable),
--       calculés sur 1991-2015 seulement (rupture superficie récoltée / semée en 2016) ;
--   - score_vulnerabilite NULL si une dimension manque (jamais remplacée par 0, pas de
--     repondération) : Guédiawaye et Pikine (aucun rendement), Dakar (confiance faible :
--     sensibilité mise à NULL, aléa affiché) ;
--   - classes : quintiles calculés sur les seuls départements qui ont un score (relatifs) ;
--     rang 1 = le plus vulnérable.
--
-- Affichés à côté, HORS score : freq_alerte_exces_pct (seuil absolu, mesure surtout un climat
-- humide), proba_saison_seche_pct (SPI relatif à chaque département, peu discriminant),
-- proba_sequence_seche_15j_pct (redondant avec les alertes sécheresse), part_cultures_pct
-- (déjà pris en compte par le besoin dans AgroDistrib).
--
-- Rendements : par culture, campagnes 1991-2015 avec rendement renseigné
-- (rendement_kg_ha is not null), au moins 10 campagnes ;
-- variabilité = écart-type de anomalie_rendement_pct (anomalie calculée par la source) ;
-- tendance = pente du rendement / rendement moyen, en % par an ; moyenne des cultures
-- pondérée par la superficie moyenne. confiance_rendement = 'faible' si moins de 3 cultures
-- ou moins de 15 campagnes observées au total (somme sur les cultures retenues).

with geo as (

    select id_departement, code_departement, departement, region, code_region, zone_agroecologique
    from {{ ref('dim_geographie') }}

),

profil as (

    select
        {{ cle_departement('code_departement') }} as id_departement,
        pluie_saison_annee_seche_mm,
        variabilite_pluie_cv_pct,
        proba_saison_seche_pct,
        proba_sequence_seche_15j_pct,
        part_cultures_pct
    from {{ ref('stg_profil_agroclimatique') }}
    where code_departement is not null

),

alertes as (

    select
        id_departement,
        count(*) as nb_saisons_1991_2020,
        100 * avg(iff(alerte_secheresse, 1, 0)) as freq_alerte_secheresse_pct,
        100 * avg(iff(alerte_exces_pluie, 1, 0)) as freq_alerte_exces_pct
    from {{ ref('fact_saison_departement') }}
    where campagne_agricole between 1991 and 2020
    group by 1

),

rendement_culture as (

    select
        id_departement,
        id_culture,
        count(*) as nb_campagnes,
        stddev(anomalie_rendement_pct) as variabilite_pct,
        regr_slope(rendement_kg_ha, campagne_agricole) / nullif(avg(rendement_kg_ha), 0) * 100 as tendance_pct_an,
        avg(superficie_ha) as superficie_moyenne_ha
    from {{ ref('fact_rendement_departement') }}
    -- Rendement renseigné, et non est_observe (qui inclut des lignes avec seulement
    -- une superficie ou une production) : compteurs, variabilité, tendance et
    -- pondération par superficie portent sur les mêmes lignes.
    where rendement_kg_ha is not null
      and campagne_agricole between 1991 and 2015
    group by 1, 2
    having count(*) >= 10

),

rendement as (

    select
        id_departement,
        count(*) as nb_cultures_rendement,
        sum(nb_campagnes) as nb_campagnes_rendement,
        sum(variabilite_pct * superficie_moyenne_ha) / nullif(sum(superficie_moyenne_ha), 0) as variabilite_rendement_pct,
        sum(tendance_pct_an * superficie_moyenne_ha) / nullif(sum(superficie_moyenne_ha), 0) as tendance_rendement_pct_an
    from rendement_culture
    group by 1

),

indicateurs as (

    select
        geo.*,

        -- Confiance faible : moins de 3 cultures ou moins de 15 campagnes observées
        -- (couples culture x campagne). La sensibilité est alors NULL, donc le score aussi,
        -- et ses indicateurs de rendement sont exclus du calcul des rangs des autres.
        case
            when rendement.nb_cultures_rendement is null then null
            when rendement.nb_cultures_rendement < 3 or rendement.nb_campagnes_rendement < 15 then 'faible'
            else 'normale'
        end as confiance_rendement,
        iff(rendement.nb_cultures_rendement >= 3 and rendement.nb_campagnes_rendement >= 15,
            rendement.variabilite_rendement_pct, null) as variabilite_rendement_retenue,
        iff(rendement.nb_cultures_rendement >= 3 and rendement.nb_campagnes_rendement >= 15,
            rendement.tendance_rendement_pct_an, null) as tendance_rendement_retenue,

        profil.pluie_saison_annee_seche_mm,
        profil.variabilite_pluie_cv_pct,
        alertes.freq_alerte_secheresse_pct,
        rendement.variabilite_rendement_pct,
        rendement.tendance_rendement_pct_an,
        rendement.nb_cultures_rendement,
        rendement.nb_campagnes_rendement,
        alertes.nb_saisons_1991_2020,
        alertes.freq_alerte_exces_pct,
        profil.proba_saison_seche_pct,
        profil.proba_sequence_seche_15j_pct,
        profil.part_cultures_pct
    from geo
    left join profil using (id_departement)
    left join alertes using (id_departement)
    left join rendement using (id_departement)

),

-- Rang centile 0-100, ex aequo au rang moyen, NULL conservé (macros/scores.sql)
rangs as (

    select
        *,
        {{ rang_centile('freq_alerte_secheresse_pct') }} as rang_alerte_secheresse,
        {{ rang_centile('variabilite_pluie_cv_pct') }} as rang_variabilite_pluie,
        {{ rang_centile('pluie_saison_annee_seche_mm', inverse=true) }} as rang_pluie_annee_seche,
        {{ rang_centile('variabilite_rendement_retenue') }} as rang_variabilite_rendement,
        {{ rang_centile('tendance_rendement_retenue', inverse=true) }} as rang_tendance_rendement
    from indicateurs

),

scores as (

    select
        *,
        (rang_alerte_secheresse + rang_variabilite_pluie + rang_pluie_annee_seche) / 3 as score_alea_secheresse,
        0.7 * rang_variabilite_rendement + 0.3 * rang_tendance_rendement as score_sensibilite_rendement
    from rangs

),

final as (

    select
        *,
        0.6 * score_alea_secheresse + 0.4 * score_sensibilite_rendement as score_vulnerabilite
    from scores

)

select
    -- Territoire (codes lisibles, pas de clé md5)
    code_departement,
    departement,
    code_region,
    region,
    zone_agroecologique,

    -- Score (relatif, indicatif)
    round(score_vulnerabilite, 1) as score_vulnerabilite,
    iff(score_vulnerabilite is null, null,
        rank() over (partition by score_vulnerabilite is null order by score_vulnerabilite desc)
    ) as rang_vulnerabilite,
    iff(score_vulnerabilite is null, null,
        case ntile(5) over (partition by score_vulnerabilite is null order by score_vulnerabilite)
            when 1 then 'très faible (relatif)'
            when 2 then 'faible (relatif)'
            when 3 then 'moyenne (relatif)'
            when 4 then 'élevée (relatif)'
            when 5 then 'très élevée (relatif)'
        end
    ) as classe_vulnerabilite,
    round(score_alea_secheresse, 1) as score_alea_secheresse,
    round(score_sensibilite_rendement, 1) as score_sensibilite_rendement,
    iff(score_alea_secheresse is not null, 1, 0) + iff(score_sensibilite_rendement is not null, 1, 0) as nb_dimensions_disponibles,
    confiance_rendement,

    -- Indicateurs bruts du score
    freq_alerte_secheresse_pct,
    variabilite_pluie_cv_pct,
    pluie_saison_annee_seche_mm,
    variabilite_rendement_pct,
    tendance_rendement_pct_an,
    nb_cultures_rendement,
    nb_campagnes_rendement,

    -- Rangs centiles (0-100, 100 = plus vulnérable)
    round(rang_alerte_secheresse, 1) as rang_alerte_secheresse,
    round(rang_variabilite_pluie, 1) as rang_variabilite_pluie,
    round(rang_pluie_annee_seche, 1) as rang_pluie_annee_seche,
    round(rang_variabilite_rendement, 1) as rang_variabilite_rendement,
    round(rang_tendance_rendement, 1) as rang_tendance_rendement,

    -- Affichés hors score
    freq_alerte_exces_pct,
    proba_saison_seche_pct,
    proba_sequence_seche_15j_pct,
    part_cultures_pct,

    -- Traçabilité
    'v1' as methode_version,
    '1991-2020' as periode_climat,
    '1991-2015' as periode_rendement,
    nb_saisons_1991_2020

from final
