{{
    config(
        materialized='table',
        enabled=var('eau_chargee', false)
    )
}}

-- Ressources en eau mobilisables en saison sèche, une ligne par département (45).
-- Sources : stg_eau_surface (JRC, ESA, MODIS), stg_eau_souterraine (BGS), stg_irrigation (FAO GMIA v5).
--
-- Deux indicateurs de décision, seuils dans dbt_project.yml (vars) :
--   eau_surface_mobilisable : au moins seuil_surface_inexploitee_ha hectares cultivables à moins de 2 km
--                             d'une eau présente 10 mois sur 12, et nus en saison sèche ;
--   nappe_accessible        : nappe à 25 m au plus avec au moins 1 L/s sur seuil_part_nappe_accessible_pct %
--                             du territoire.
-- part_proche_eau_exploitee_pct : part des terres cultivables proches de l'eau déjà vertes en saison sèche
-- (NDVI >= 0,3) ; NULL quand il n'y a aucune terre cultivable proche de l'eau, jamais 0.

with geo as (

    select id_departement, code_departement
    from {{ ref('dim_geographie') }}

),

surface as (

    select * from {{ ref('stg_eau_surface') }}

),

souterraine as (

    select * from {{ ref('stg_eau_souterraine') }}

),

irrigation as (

    select * from {{ ref('stg_irrigation') }}

)

select
    geo.id_departement,
    geo.code_departement,

    -- Eau de surface et terres proches (ha)
    surface.surface_eau_permanente_ha,
    surface.surface_eau_saisonniere_ha,
    surface.surface_proche_eau_ha,
    surface.surface_proche_eau_cultivable_ha,
    surface.surface_proche_eau_verte_ha,
    surface.surface_proche_eau_inexploitee_ha,
    case
        when surface.surface_proche_eau_cultivable_ha > 0
            then round(100 * surface.surface_proche_eau_verte_ha / surface.surface_proche_eau_cultivable_ha, 1)
    end as part_proche_eau_exploitee_pct,
    surface.ndvi_saison_seche_proche_eau,
    surface.periode_ndvi,

    -- Nappes souterraines
    souterraine.profondeur_classe_dominante,
    souterraine.profondeur_mediane_m,
    souterraine.part_nappe_peu_profonde_pct,
    souterraine.productivite_classe_dominante,
    souterraine.productivite_mediane_l_s,
    souterraine.part_debit_suffisant_pct,
    souterraine.part_nappe_accessible_pct,
    souterraine.stock_classe_dominante,
    souterraine.point_le_plus_proche as nappe_valeur_point_proche,

    -- Irrigation déjà équipée (vers 2005)
    irrigation.surface_equipee_irrigation_ha,
    irrigation.part_surface_equipee_pct,
    irrigation.part_equipee_irriguee_pct,
    irrigation.part_irrigation_nappe_pct,
    irrigation.part_irrigation_eau_surface_pct,
    irrigation.annee_reference as annee_reference_irrigation,

    -- Indicateurs de décision
    coalesce(surface.surface_proche_eau_inexploitee_ha, 0) >= {{ var('seuil_surface_inexploitee_ha') }}
        as eau_surface_mobilisable,
    coalesce(souterraine.part_nappe_accessible_pct, 0) >= {{ var('seuil_part_nappe_accessible_pct') }}
        as nappe_accessible

from geo
left join surface on surface.code_departement = geo.code_departement
left join souterraine on souterraine.code_departement = geo.code_departement
left join irrigation on irrigation.code_departement = geo.code_departement
