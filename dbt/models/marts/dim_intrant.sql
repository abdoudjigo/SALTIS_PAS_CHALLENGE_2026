{{
    config(materialized='table')
}}

-- Une ligne par intrant de référence (9).
-- Source : seed ref_intrants (référentiel du projet), et non plus stg_intrants,
-- qui reste désactivé tant que APP_INTRANTS n'est pas chargée.
-- C3 : SALTIS.APP.intrants reprendra ces code_intrant.
--
-- type_intrant : PRODUIT (engrais, fumier, semences), ELEMENT (N, P2O5, K2O), EAU.
-- Teneurs en % (N, P2O5, K2O) renseignées pour les engrais minéraux seulement ;
-- nulles (inconnues ou sans objet) pour le fumier, les semences, les éléments et l'eau.

select
    md5(upper(trim(code_intrant))) as id_intrant,
    upper(trim(code_intrant)) as code_intrant,
    trim(nom_intrant) as nom_intrant,
    upper(trim(type_intrant)) as type_intrant,
    trim(unite) as unite,
    teneur_n_pct,
    teneur_p2o5_pct,
    teneur_k2o_pct

from {{ ref('ref_intrants') }}

where code_intrant is not null
