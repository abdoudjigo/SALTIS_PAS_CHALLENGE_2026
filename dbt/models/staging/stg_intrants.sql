-- Désactivé : la table RAW app_intrants n'existe pas encore.
-- À réactiver quand APP_INTRANTS sera ingérée dans SALTIS.RAW.
{{
    config(
        materialized='view',
        enabled=false
    )
}}

select
    id_intrant,
    code_intrant,
    nom_intrant,
    categorie_intrant,
    type_intrant,
    unite_mesure,
    description,
    actif,
    date_creation,
    date_maj

from {{ source('raw', 'app_intrants') }}