-- Désactivé : dépend de stg_scenarios_allocation, qui n'existe pas encore
-- (source APP_SCENARIOS_ALLOCATION à venir).
{{
    config(
        materialized='table',
        enabled=false
    )
}}

select
    id_scenario,
    id_organisation,
    campagne_agricole,
    nom_scenario,
    objectif,
    statut,
    date_creation

from {{ ref('stg_scenarios_allocation') }}