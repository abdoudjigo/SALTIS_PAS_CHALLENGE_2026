-- Nappes souterraines par département (BGS, grille 5 km), préparées par ingestion/collecte/eau/preparer_eau.py.
-- Désactivé tant que les tables RAW « eau » ne sont pas chargées : variable eau_chargee (dbt_project.yml).
-- Citation obligatoire : « Based upon mapping provided by British Geological Survey © NERC 2012 ».
{{
    config(
        materialized='view',
        enabled=var('eau_chargee', false)
    )
}}

select
    trim(code_departement) as code_departement,
    nb_points_grille,
    point_le_plus_proche,
    profondeur_classe_dominante,
    profondeur_mediane_m,
    part_nappe_peu_profonde_pct,
    productivite_classe_dominante,
    productivite_mediane_l_s,
    part_debit_suffisant_pct,
    part_nappe_accessible_pct,
    stock_classe_dominante,
    stock_median_mm,
    source,
    date_chargement
from {{ source('raw', 'e_eau_souterraine_departement') }}
