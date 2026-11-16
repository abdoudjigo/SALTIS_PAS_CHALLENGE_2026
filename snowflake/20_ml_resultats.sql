-- Résultats des modèles d'IA (ml/) dans SALTIS.ML.
-- À exécuter à la main dans Snowflake, une seule fois, AVANT le chargement :
--     venv/bin/python -m ml.charger_snowflake --confirmer
--
-- Les 5 tables sont remplies par ce script de chargement à partir de ml/sorties/*.csv.
-- Chaque chargement vide la table puis la remplit : une table = la dernière version des modèles.
-- L'API les lit au préchargement de son cache (lecture seule), comme les marts.
--
-- Rôle : R_ML (écriture dans SALTIS.ML), créé par Ibrahima.

use role R_ML;
use warehouse SALTIS_WH;
use database SALTIS;
use schema ML;

-- ---------------------------------------------------------------------------
-- Modèle 1 — La saison qui vient : département × année
-- ---------------------------------------------------------------------------
create table if not exists SALTIS.ML.PREVISION_SAISONNIERE (
    code_departement     varchar not null comment 'Code GADM du département',
    departement          varchar not null,
    code_region          varchar not null,
    region               varchar not null,
    zone_agroecologique  varchar not null,
    annee                number(4) not null,
    type_prevision       varchar not null comment 'RETROSPECTIVE_VALIDATION (1981-2015, prévue sans cette année) RETROSPECTIVE_TEST (2016-2025) PREVISION_OCEAN (2026) ou PREVISION_TENDANCE (2027-2035)',
    proba_seche_pct      float comment 'Probabilité d''une saison sèche (%), les 3 probabilités font 100',
    proba_normale_pct    float,
    proba_humide_pct     float,
    classe_prevue        varchar comment 'sèche, normale ou humide',
    pluie_prevue_mm      float,
    pluie_basse_mm       float comment 'Fourchette : 8 chances sur 10 d''être entre basse et haute',
    pluie_haute_mm       float,
    pluie_normale_mm     float,
    pluie_observee_mm    float,
    classe_observee      varchar,
    version_modele       varchar not null,
    date_calcul          date not null
)
comment = 'Modèle 1 : prévision de la saison des pluies faite fin mai (ml/m1_prevision_saison).';

-- ---------------------------------------------------------------------------
-- Modèle 3 — Quelle culture / Alerte récolte : département × culture × année × moment
-- ---------------------------------------------------------------------------
create table if not exists SALTIS.ML.PREVISION_RENDEMENT (
    code_departement     varchar not null,
    departement          varchar not null,
    code_region          varchar not null,
    region               varchar not null,
    zone_agroecologique  varchar not null,
    culture              varchar not null,
    annee                number(4) not null,
    moment_prevision     varchar not null,
    type_prevision       varchar not null comment 'RETROSPECTIVE_VALIDATION, RETROSPECTIVE_TEST ou PROJECTION_NON_EVALUEE (2022-2025)',
    tendance_kg_ha           float comment 'Moyenne des 10 campagnes précédentes',
    rendement_bas_kg_ha      float,
    rendement_median_kg_ha   float,
    rendement_haut_kg_ha     float,
    proba_chute_pct          float comment 'Probabilité que le rendement passe sous 80 % de la tendance',
    proba_chute_reference_pct float,
    explication          varchar,
    rendement_fiable     boolean comment 'Vrai seulement si le modèle bat la référence (validation et test)',
    alerte_fiable        boolean,
    rendement_observe_kg_ha  float,
    chute_observee       boolean,
    version_modele       varchar not null,
    date_calcul          date not null
)
comment = 'Modèle 3 : rendement prévu et alerte récolte (ml/m3_rendement).';

-- ---------------------------------------------------------------------------
-- Modèle 4 — Quand semer : département × année × culture × décade de semis
-- ---------------------------------------------------------------------------
create table if not exists SALTIS.ML.RISQUE_SEMIS (
    code_departement     varchar not null,
    departement          varchar not null,
    code_region          varchar not null,
    region               varchar not null,
    zone_agroecologique  varchar not null,
    annee                number(4) comment 'Vide pour ANNEE_TYPE',
    type_prevision       varchar not null comment 'RETROSPECTIVE_TEST (2016-2025), PREVISION_OCEAN, PREVISION_TENDANCE ou ANNEE_TYPE',
    culture              varchar not null,
    cycle_jours          float,
    decade_semis         number(2) not null comment '16 = 1re décade de juin … 23 = 2e décade d''août',
    libelle_decade       varchar not null,
    chance_pluie_semis_pct      float,
    risque_faux_depart_pct      float,
    risque_fin_trop_tot_pct     float,
    risque_total_pct            float,
    decade_conseillee    boolean not null,
    proba_saison_seche_m1_pct   float,
    version_modele       varchar not null,
    date_calcul          date not null
)
comment = 'Modèle 4 : risque de semis par décade et décade conseillée (ml/m4_date_semis).';

-- ---------------------------------------------------------------------------
-- Fiabilité des 3 modèles (1, 3 et 4), en format long : une ligne par mesure
-- ---------------------------------------------------------------------------
create table if not exists SALTIS.ML.EVALUATION_MODELES (
    modele          varchar not null comment 'M1, M3, M4',
    version_modele  varchar not null,
    periode         varchar not null,
    moment          varchar,
    culture         varchar,
    risque          varchar,
    variables       varchar,
    mesure          varchar not null comment 'ex. rpss_vs_climatologie, brier_skill_score, auc_modele',
    valeur          float
)
comment = 'Fiabilité des modèles comparée à une prévision simple (ml/sorties/evaluation_m*.csv).';

-- ---------------------------------------------------------------------------
-- Lecture par l'API : le rôle de l'API (SNOWFLAKE_ROLE du .env de l'API) doit pouvoir lire SALTIS.ML.
-- Décommenter en remplaçant <ROLE_API> (ex. SYSADMIN), avec un rôle qui en a le droit.
-- ---------------------------------------------------------------------------
-- grant usage on schema SALTIS.ML to role <ROLE_API>;
-- grant select on all tables in schema SALTIS.ML to role <ROLE_API>;
-- grant select on future tables in schema SALTIS.ML to role <ROLE_API>;

-- ---------------------------------------------------------------------------
-- Vérifications, après le chargement
-- ---------------------------------------------------------------------------
-- select 'PREVISION_SAISONNIERE' t, count(*) from SALTIS.ML.PREVISION_SAISONNIERE   -- 2 025
-- union all select 'PREVISION_RENDEMENT', count(*) from SALTIS.ML.PREVISION_RENDEMENT -- 12 136
-- union all select 'RISQUE_SEMIS', count(*) from SALTIS.ML.RISQUE_SEMIS             -- 30 976
-- union all select 'EVALUATION_MODELES', count(*) from SALTIS.ML.EVALUATION_MODELES;
-- Aucune valeur NaN (une valeur absente doit être NULL) :
-- select count(*) from SALTIS.ML.PREVISION_SAISONNIERE where proba_seche_pct = 'NaN'::float;  -- 0
