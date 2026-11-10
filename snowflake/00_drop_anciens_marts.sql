-- T0. Suppression des anciens marts (copies du staging créées au début du projet).
-- Les fichiers dbt correspondants ont été supprimés de dbt/models/marts/.
-- À exécuter à la main dans Snowflake, avec un rôle propriétaire du schéma SALTIS.MARTS.

use database SALTIS;

drop table if exists SALTIS.MARTS.MART_SAISONS;
drop table if exists SALTIS.MARTS.MART_PROFIL_AGRO;
drop table if exists SALTIS.MARTS.MART_ADEQUATION;
drop table if exists SALTIS.MARTS.MART_ADEQUATION_VARIETES;
drop table if exists SALTIS.MARTS.MART_BESOINS;
drop table if exists SALTIS.MARTS.MART_RENDEMENTS;
drop table if exists SALTIS.MARTS.MART_FACTEURS_LIMITANTS;
drop table if exists SALTIS.MARTS.MART_AGRODISTRIB;

-- Vérification : doit renvoyer 0 ligne.
select table_schema, table_name
from SALTIS.INFORMATION_SCHEMA.TABLES
where table_schema = 'MARTS'
  and table_name like 'MART\\_%' escape '\\';

-- ---------------------------------------------------------------------------
-- Optionnel, à décider : trois copies existent aussi dans un ancien schéma
-- SALTIS.ANALYTICS_MARTS (construit avant la configuration +schema: marts).
-- Décommenter si ce schéma n'est plus utilisé.
--
-- Avant de décommenter les drop, vérifier que rien d'autre ne traîne :
--   show tables  in schema SALTIS.ANALYTICS_MARTS;
--   show views   in schema SALTIS.ANALYTICS_MARTS;
--   show schemas in database SALTIS;   -- repérer d'autres restes du même genre (ANALYTICS_STAGING…)
-- ---------------------------------------------------------------------------
-- drop table if exists SALTIS.ANALYTICS_MARTS.MART_SAISONS;
-- drop table if exists SALTIS.ANALYTICS_MARTS.MART_ADEQUATION;
-- drop table if exists SALTIS.ANALYTICS_MARTS.MART_AGRODISTRIB;
-- drop schema if exists SALTIS.ANALYTICS_MARTS;

-- ---------------------------------------------------------------------------
-- Optionnel, à décider : même reste dans SALTIS.ANALYTICS_STAGING (3 vues créées
-- le 2026-11-08 à 13:17, comme ANALYTICS_MARTS). Constat du 2026-11-10 :
-- STG_ADEQUATION, STG_BESOINS, STG_SAISONS ; aucune table.
-- ---------------------------------------------------------------------------
-- drop view if exists SALTIS.ANALYTICS_STAGING.STG_ADEQUATION;
-- drop view if exists SALTIS.ANALYTICS_STAGING.STG_BESOINS;
-- drop view if exists SALTIS.ANALYTICS_STAGING.STG_SAISONS;
-- drop schema if exists SALTIS.ANALYTICS_STAGING;
