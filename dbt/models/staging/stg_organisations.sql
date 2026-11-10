-- Désactivé : la table RAW app_organisations n'existe pas encore.
-- À réactiver quand APP_ORGANISATIONS sera ingérée dans SALTIS.RAW
-- et déclarée dans _sources.yml.
{{
    config(
        materialized='view',
        enabled=false
    )
}}

select
    id_organisation,
    nom_organisation,
    type_organisation,
    statut,
    date_creation

from {{ source('raw', 'app_organisations') }}