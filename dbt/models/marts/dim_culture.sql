
{{
    config(materialized='table')
}}

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

)

select
    md5(culture) as id_culture,
    culture

from normalisation
