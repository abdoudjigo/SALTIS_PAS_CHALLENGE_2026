
{{
    config(materialized='table')
}}

-- Référentiel des cultures (rendements, besoins, variétés), avec les paramètres
-- agronomiques du seed ref_cultures : nom FAOSTAT, température de base (°C),
-- coefficients culturaux FAO-56 (kc_ini, kc_mid, kc_end) et durée de cycle min / max
-- (découpée du texte « 85-95 »). Le min et le max sont égaux aux cycles court et long
-- de fact_adequation_culture (testé).

with cultures as (

    select culture
    from {{ ref('stg_rendements') }}

    union

    select culture
    from {{ ref('stg_besoins_culture') }}

    union

    select culture
    from {{ ref('stg_varietes') }}

),

normalisation as (

    select distinct
        upper(trim(culture)) as culture

    from cultures

    where culture is not null
      and trim(culture) <> ''

),

parametres as (

    -- Paramètres agronomiques (seed ref_cultures, fourni par Ibrahima)
    select
        upper(trim(culture)) as culture,
        trim(nom_fao) as nom_fao,
        t_base_c,
        kc_ini,
        kc_mid,
        kc_end,
        split_part(cycle_jours, '-', 1)::integer as cycle_min_jours,
        split_part(cycle_jours, '-', 2)::integer as cycle_max_jours
    from {{ ref('ref_cultures') }}

)

select
    md5(n.culture) as id_culture,
    n.culture,

    -- Paramètres agronomiques (NULL pour une culture absente du seed)
    p.nom_fao,
    p.t_base_c,
    p.kc_ini,
    p.kc_mid,
    p.kc_end,
    p.cycle_min_jours,
    p.cycle_max_jours

from normalisation n
left join parametres p
    on p.culture = n.culture
