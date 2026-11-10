-- Désactivé : dépend de stg_organisations (source APP_ORGANISATIONS à venir).
{{
    config(
        materialized='table',
        enabled=false
    )
}}

select
    id_organisation,
    nom_organisation,
    type_organisation,
    statut,
    date_creation

from {{ ref('stg_organisations') }}