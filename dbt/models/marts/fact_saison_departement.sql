{{
    config(materialized='table')
}}

-- Grain : un département, une campagne agricole (saison des pluies juin-octobre).
-- 45 départements x 1981-2025.
--
-- Source de référence pour les variables climatiques départementales
-- (pluie, SPI, démarrage, séquences sèches, chaleur, NDVI) : elles ne sont plus
-- portées par fact_rendement_departement, où elles étaient répétées pour chaque culture.
--
-- Exclu : pluie_normale_saison_mm (constante par département, voir stg_profil_agroclimatique ;
-- reprise dans mart_carte_agroclimat).
-- Limites connues :
--   - Guédiawaye : calendrier NASA POWER (source_calendrier), pas de décades ;
--   - NDVI disponible à partir de 2000.

with source as (

    select *
    from {{ ref('stg_saisons') }}
    where code_departement is not null
      and annee is not null

)

select
    md5(trim(code_departement) || '|' || to_varchar(annee)) as id_saison,

    -- Clés vers les dimensions
    {{ cle_departement('code_departement') }} as id_departement,
    annee::integer as campagne_agricole,

    -- Quantité de pluie
    pluie_saison_mm,
    anomalie_pluie_saison_pct,
    spi_saison,
    pluie_juin_juillet_mm,

    -- Calendrier de la saison (jour de l'année)
    debut_saison_jour,
    retard_debut_saison_j,
    fin_saison_jour,
    duree_saison_j,

    -- Répartition des pluies
    nb_jours_pluie,
    nb_jours_pluie_forte,
    pluie_max_journaliere_mm,
    plus_longue_sequence_seche_j,
    nb_sequences_seches_7j,
    nb_decades_seches,
    nb_decades_tres_pluvieuses,

    -- Chaleur, demande en eau, sol, végétation
    temp_max_moy_saison_c,
    nb_jours_tmax_sup_40,
    et0_saison_mm,
    humidite_sol_surface_m3_m3,
    ndvi_max_saison_zc,
    anomalie_ndvi_pct,

    -- Classement et alertes
    classe_saison,
    alerte_secheresse,
    alerte_exces_pluie,

    -- Traçabilité
    source_calendrier

from source