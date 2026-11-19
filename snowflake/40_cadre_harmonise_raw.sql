-- Phase A3 : Cadre harmonisé (CILSS / IPC) dans SALTIS.RAW, une ligne par département source × cycle × type de période.
-- À exécuter à la main dans Snowflake, une seule fois, AVANT le chargement :
--     venv/bin/python -m ingestion.collecte.cadre_harmonise.charger_snowflake --confirmer
--
-- Fichier préparé par ingestion/collecte/cadre_harmonise/preparer_ch.py depuis HDX
-- (cadre_harmonise_caf_ipc_mars26.xlsx, licence CC BY ; citer « Cadre harmonisé, CILSS »).
-- Valeurs reprises telles quelles : population en personnes (décimales de la source conservées), aucune
-- valeur manquante remplacée par 0. Keur Massar (créé en 2021, hors GADM 4.1) est rattaché au code de Pikine,
-- en lignes séparées : la fusion des effectifs se fait dans dbt. La table est recréée à chaque chargement
-- (create or replace), puis remplie : elle contient toujours la dernière préparation.

use warehouse SALTIS_WH;
use database SALTIS;
use schema RAW;

create or replace table SALTIS.RAW.E_CADRE_HARMONISE_DEPARTEMENT (
    code_departement               varchar not null comment 'Code GADM du département (dbt/seeds/ref_departements.csv)',
    departement                    varchar not null comment 'Nom du département GADM du projet (Pikine pour les lignes Keur Massar)',
    nom_departement_source         varchar not null comment 'Nom du département dans le Cadre harmonisé (adm2_name), Keur Massar porte le code de Pikine',
    region_ch                      varchar comment 'Nom de la région dans le Cadre harmonisé (adm1_name)',
    code_adm2_ch                   varchar comment 'Code du département dans le Cadre harmonisé (adm2_pcod2, ex. SN1201)',
    annee_cycle                    number  not null comment 'Année du cycle d''analyse (exercise_year)',
    libelle_cycle                  varchar not null comment 'Cycle d''analyse : Jan-May (mars) ou Sep-Dec (novembre) (exercise_label)',
    code_cycle                     number  not null comment 'Code du cycle : 1 = Sep-Dec, 2 = Jan-May (exercise_code)',
    type_periode                   varchar not null comment 'current = situation courante, projected = projection (chtype)',
    libelle_periode_reference      varchar comment 'Période couverte par l''analyse (reference_label : Jan-May, Jun-Aug, Sep-Dec)',
    annee_periode_reference        number  comment 'Année de la période couverte (reference_year)',
    periode_a_utiliser             boolean comment 'usethisperiod = Y : faux pour une projection remplacée par un cycle plus récent',
    population                     float   comment 'Population analysée (personnes)',
    phase_class                    float   comment 'Phase du département, 1 (minimale) à 5 (famine)',
    population_phase1              float   comment 'Population en phase 1 (personnes)',
    population_phase2              float   comment 'Population en phase 2, sous pression (personnes)',
    population_phase3              float   comment 'Population en phase 3, crise (personnes)',
    population_phase4              float   comment 'Population en phase 4, urgence (personnes)',
    population_phase5              float   comment 'Population en phase 5, famine (personnes)',
    population_phase3_5            float   comment 'Population en phases 3 à 5, à assister (phase35, personnes)',
    phase_consommation_alimentaire float   comment 'Phase du résultat consommation alimentaire (foodconsumption_phase), souvent nulle',
    phase_moyens_existence         float   comment 'Phase du résultat moyens d''existence (livelihoods_phase), souvent nulle',
    phase_nutrition                float   comment 'Phase du résultat nutrition (nutrition_phase), souvent nulle',
    source                         varchar comment 'Fichier source et licence',
    date_chargement                timestamp_ntz default current_timestamp() comment 'Date du chargement',
    constraint pk_e_cadre_harmonise primary key (code_departement, nom_departement_source, annee_cycle, code_cycle, type_periode)
)
comment = 'Cadre harmonisé CILSS/IPC par département GADM, cycles depuis 2014 (HDX, CC BY). Keur Massar rattaché à Pikine en lignes séparées (fusion dans dbt).';
