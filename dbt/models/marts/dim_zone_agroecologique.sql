
{{
    config(materialized='table')
}}

select distinct
    md5(upper(trim(zone_agroecologique))) as id_zone_agroecologique,
    upper(trim(zone_agroecologique)) as zone_agroecologique

from {{ ref('stg_besoins_hectare') }}

where zone_agroecologique is not null
