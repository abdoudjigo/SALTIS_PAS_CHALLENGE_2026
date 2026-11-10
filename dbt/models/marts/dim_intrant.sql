-- Désactivé : dépend de stg_intrants (source APP_INTRANTS à venir).
{{
    config(
        materialized='table',
        enabled=false
    )
}}

select
    md5(trim(id_intrant)) as id_intrant,
    id_intrant as code_intrant_source,
    code_intrant,
    upper(trim(nom_intrant)) as nom_intrant,
    upper(trim(categorie_intrant)) as categorie_intrant,
    upper(trim(type_intrant)) as type_intrant,
    unite_mesure,
    description,
    actif

from {{ ref('stg_intrants') }}

where id_intrant is not null
  and nom_intrant is not null