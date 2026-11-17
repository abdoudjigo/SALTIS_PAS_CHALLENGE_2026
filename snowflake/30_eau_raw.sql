-- Carte des opportunités (eau et pluie) : tables brutes des sources « eau » dans SALTIS.RAW.
-- À exécuter à la main dans Snowflake, une seule fois, AVANT le chargement :
--     venv/bin/python -m ingestion.collecte.eau.charger_snowflake --confirmer
--
-- Une table par source, une ligne par département (45). Les fichiers sont préparés par
-- ingestion/collecte/eau/preparer_eau.py (BGS, FAO) et gee_eau_surface.js (JRC, ESA, MODIS).
-- Chaque chargement vide la table puis la remplit. dbt les lit en source (models/staging/_sources.yml)
-- et ne les modifie jamais.

use warehouse SALTIS_WH;
use database SALTIS;
use schema RAW;

-- ---------------------------------------------------------------------------
-- Nappes souterraines (BGS, grille 5 km)
-- ---------------------------------------------------------------------------
create table if not exists SALTIS.RAW.E_EAU_SOUTERRAINE_DEPARTEMENT (
    code_departement               varchar not null comment 'Code GADM du département',
    nb_points_grille               number  comment 'Points de la grille 5 km dans le département',
    point_le_plus_proche           boolean comment 'Vrai : département trop petit, valeur du point de grille le plus proche',
    profondeur_classe_dominante    varchar comment 'Classe de profondeur de la nappe la plus étendue (ex. 7-25 m)',
    profondeur_mediane_m           float   comment 'Profondeur médiane, valeur représentative de la classe (m)',
    part_nappe_peu_profonde_pct    float   comment 'Part du territoire où la nappe est à 25 m au plus (%)',
    productivite_classe_dominante  varchar comment 'Débit attendu d''un forage, classe la plus étendue (ex. 1-5 L/s)',
    productivite_mediane_l_s       float   comment 'Débit médian, valeur représentative de la classe (L/s)',
    part_debit_suffisant_pct       float   comment 'Part du territoire où un forage peut donner au moins 1 L/s (%)',
    part_nappe_accessible_pct      float   comment 'Part du territoire avec nappe à 25 m au plus ET au moins 1 L/s (%)',
    stock_classe_dominante         varchar comment 'Eau stockée dans l''aquifère, classe la plus étendue',
    stock_median_mm                float   comment 'Stock médian, valeur représentative de la classe (mm d''eau)',
    source                         varchar,
    date_chargement                timestamp_ntz default current_timestamp()
)
comment = 'Nappes souterraines par département (BGS, MacDonald et al. 2012). Citation : Based upon mapping provided by British Geological Survey © NERC 2012.';

-- ---------------------------------------------------------------------------
-- Irrigation déjà en place vers 2005 (FAO GMIA v5, grille 5 minutes d'arc)
-- ---------------------------------------------------------------------------
create table if not exists SALTIS.RAW.E_IRRIGATION_DEPARTEMENT (
    code_departement                 varchar not null,
    nb_cellules_grille               number,
    point_le_plus_proche             boolean,
    surface_equipee_irrigation_ha    float comment 'Surface équipée pour l''irrigation (ha), somme des cellules',
    part_surface_equipee_pct         float comment 'Part du territoire équipée pour l''irrigation (%)',
    part_equipee_irriguee_pct        float comment 'Part de la surface équipée réellement irriguée (%)',
    part_irrigation_nappe_pct        float comment 'Part de la surface équipée irriguée avec l''eau souterraine (%)',
    part_irrigation_eau_surface_pct  float comment 'Part de la surface équipée irriguée avec l''eau de surface (%)',
    annee_reference                  number(4),
    source                           varchar,
    date_chargement                  timestamp_ntz default current_timestamp()
)
comment = 'Irrigation équipée par département vers 2005 (FAO GMIA v5). Donnée ancienne : indicative.';

-- ---------------------------------------------------------------------------
-- Eau de surface en saison sèche et terres proches (Google Earth Engine)
-- ---------------------------------------------------------------------------
create table if not exists SALTIS.RAW.E_EAU_SURFACE_DEPARTEMENT (
    code_departement                    varchar not null,
    surface_eau_permanente_ha           float comment 'Eau présente au moins 10 mois sur 12 (ha)',
    surface_eau_saisonniere_ha          float comment 'Eau présente 1 à 9 mois (ha)',
    surface_proche_eau_ha               float comment 'Terres à moins de 2 km de l''eau permanente, hors eau (ha)',
    surface_proche_eau_cultivable_ha    float comment 'Dont cultures, prairies ou arbustes (ha)',
    surface_proche_eau_verte_ha         float comment 'Dont vertes en saison sèche (NDVI >= 0,3) : déjà exploitées (ha)',
    surface_proche_eau_inexploitee_ha   float comment 'Dont non vertes en saison sèche : potentiel de contre-saison (ha)',
    ndvi_saison_seche_proche_eau        float comment 'NDVI moyen février-avril des terres cultivables proches de l''eau',
    periode_ndvi                        varchar,
    source                              varchar,
    date_chargement                     timestamp_ntz default current_timestamp()
)
comment = 'Eau de surface et terres irrigables par département (JRC GSW, ESA WorldCover, MODIS), calculé dans Earth Engine.';

-- Vérification après chargement : 45 lignes par table.
-- select 'souterraine', count(*) from SALTIS.RAW.E_EAU_SOUTERRAINE_DEPARTEMENT
-- union all select 'irrigation', count(*) from SALTIS.RAW.E_IRRIGATION_DEPARTEMENT
-- union all select 'surface', count(*) from SALTIS.RAW.E_EAU_SURFACE_DEPARTEMENT;
