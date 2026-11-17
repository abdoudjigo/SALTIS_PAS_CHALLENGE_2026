-- Eau de surface en saison sèche et terres proches, par département (Earth Engine :
-- ingestion/collecte/eau/gee_eau_surface.js). Une surface absente vaut 0 ha (mise à 0 au chargement).
{{
    config(
        materialized='view',
        enabled=var('eau_chargee', false)
    )
}}

select
    trim(code_departement) as code_departement,
    surface_eau_permanente_ha,
    surface_eau_saisonniere_ha,
    surface_proche_eau_ha,
    surface_proche_eau_cultivable_ha,
    surface_proche_eau_verte_ha,
    surface_proche_eau_inexploitee_ha,
    ndvi_saison_seche_proche_eau,
    periode_ndvi,
    source,
    date_chargement
from {{ source('raw', 'e_eau_surface_departement') }}
