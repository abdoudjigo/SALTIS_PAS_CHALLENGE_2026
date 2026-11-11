{{
    config(materialized='table')
}}

-- Écran carte agroclimatique (module A). Grain : département x campagne, 2 025 lignes.
-- Sources : fact_saison_departement (référence des variables de saison), profil
-- agroclimatique (normale), mart_vulnerabilite_departement (score et classe, relatifs).
--
-- risque_saison (règle validée, 90 saisons portent les deux alertes) :
--   'sécheresse et excès de pluie' / 'sécheresse' / 'excès de pluie' / 'normal'.
-- NDVI disponible à partir de 2000 seulement. Vulnérabilité : même valeur pour toutes les
-- campagnes d'un département (indicateur 1991-2020 / 1991-2015), relative et indicative.

with saison as (

    select *
    from {{ ref('fact_saison_departement') }}

),

profil as (

    select
        {{ cle_departement('code_departement') }} as id_departement,
        pluie_saison_normale_mm
    from {{ ref('stg_profil_agroclimatique') }}
    where code_departement is not null

)

select
    -- Territoire
    g.code_departement,
    g.departement,
    g.code_region,
    g.region,
    g.zone_agroecologique,
    g.zone_secondaire,
    g.latitude,
    g.longitude,

    -- Temps
    s.campagne_agricole,

    -- Quantité
    s.pluie_saison_mm,
    p.pluie_saison_normale_mm,
    s.anomalie_pluie_saison_pct,
    s.spi_saison,
    s.classe_saison,

    -- Calendrier (jour de l'année)
    s.debut_saison_jour,
    s.retard_debut_saison_j,
    s.fin_saison_jour,
    s.duree_saison_j,

    -- Répartition
    s.nb_jours_pluie,
    s.plus_longue_sequence_seche_j,
    s.nb_sequences_seches_7j,
    s.nb_decades_seches,

    -- Chaleur et végétation
    s.temp_max_moy_saison_c,
    s.nb_jours_tmax_sup_40,
    s.ndvi_max_saison_zc,
    s.anomalie_ndvi_pct,

    -- Risque
    s.alerte_secheresse,
    s.alerte_exces_pluie,
    case
        when s.alerte_secheresse and s.alerte_exces_pluie then 'sécheresse et excès de pluie'
        when s.alerte_secheresse                          then 'sécheresse'
        when s.alerte_exces_pluie                         then 'excès de pluie'
        else 'normal'
    end as risque_saison,

    -- Vulnérabilité (relative, indicative ; détail dans mart_vulnerabilite_departement)
    v.score_vulnerabilite,
    v.classe_vulnerabilite,

    -- Traçabilité
    s.source_calendrier

from saison s
join {{ ref('dim_geographie') }} g
    on g.id_departement = s.id_departement
left join profil p
    on p.id_departement = s.id_departement
left join {{ ref('mart_vulnerabilite_departement') }} v
    on v.code_departement = g.code_departement
