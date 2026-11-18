-- Irrigation équipée vers 2005 par département (FAO GMIA v5), préparée par ingestion/collecte/eau/preparer_eau.py.
-- Donnée ancienne : sert à repérer où l'eau est déjà mobilisée, pas à mesurer l'irrigation actuelle.
{{
    config(
        materialized='view',
        enabled=var('eau_chargee', false)
    )
}}

select
    trim(code_departement) as code_departement,
    nb_cellules_grille,
    point_le_plus_proche,
    surface_equipee_irrigation_ha,
    part_surface_equipee_pct,
    part_equipee_irriguee_pct,
    part_irrigation_nappe_pct,
    part_irrigation_eau_surface_pct,
    annee_reference,
    source,
    date_chargement
from {{ source('raw', 'e_irrigation_departement') }}
