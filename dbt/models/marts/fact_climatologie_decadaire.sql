{{
    config(materialized='table')
}}

-- Grain : niveau géographique x territoire x décade (numero_decade_annee 1 à 36).
-- Climatologie de référence 1991-2020 : ce qu'une décade apporte « normalement ».
--   - DEPARTEMENT : 44 départements x 36 = 1 584 lignes (Guédiawaye absent) ;
--   - ZONE        :  6 zones       x 36 =   216 lignes.
--
-- Une ligne porte exactement une clé géographique : id_departement si niveau
-- DEPARTEMENT, id_zone_agroecologique si niveau ZONE. Les valeurs de zone viennent
-- de la source zonale : elles ne sont jamais recalculées depuis les départements,
-- et une valeur zonale n'est jamais recopiée sur les départements.
--
-- Toutes les mesures sont NON ADDITIVES (moyennes, médianes, quantiles,
-- probabilités, parts) : ne jamais les sommer entre territoires ni entre niveaux.
--
-- Quantiles : pluie_1_annee_sur_5_mm est le quantile bas (année sèche, 1 année sur 5
-- en dessous), pluie_4_annees_sur_5_mm le quantile haut ; vérifié sur les données.
--
-- Cumul moyen, parts de saison et part cumulée : décades 16 à 30 uniquement, nuls ailleurs.
--
-- Exclu : totaux de saison constants par territoire (pluie_saison_normale_mm,
-- pluie_saison_annees_seches_mm, pluie_saison_annees_humides_mm), libellés et `periode`
-- (portés par les dimensions).

with departement as (

    select
        'DEPARTEMENT' as niveau_geographique,
        trim(code_departement) as code_territoire,
        {{ cle_departement('code_departement') }} as id_departement,
        cast(null as varchar) as id_zone_agroecologique,
        *
    from {{ ref('stg_repartition_pluie_departement') }}
    where code_departement is not null
      and decade is not null

),

zone as (

    select
        'ZONE' as niveau_geographique,
        upper(trim(zone_agroecologique)) as code_territoire,
        cast(null as varchar) as id_departement,
        {{ cle_zone('zone_agroecologique') }} as id_zone_agroecologique,
        *
    from {{ ref('stg_repartition_pluie_zone') }}
    where zone_agroecologique is not null
      and decade is not null

),

{% set mesures %}
        pluie_moyenne_mm,
        pluie_mediane_mm,
        pluie_1_annee_sur_5_mm,
        pluie_4_annees_sur_5_mm,
        pluie_max_mm,
        nb_jours_pluie_moyen,
        plus_longue_sequence_seche_moyenne_j,
        proba_decade_seche_pct,
        proba_decade_tres_pluvieuse_pct,
        proba_sequence_seche_7j_pct,
        cumul_moyen_depuis_juin_mm,
        part_saison_pct,
        part_cumulee_saison_pct,
        pluie_annees_seches_mm,
        part_saison_annees_seches_pct,
        pluie_annees_humides_mm,
        part_saison_annees_humides_pct
{% endset %}

unioned as (

    select niveau_geographique, code_territoire, id_departement, id_zone_agroecologique, decade,
        {{ mesures }}
    from departement

    union all

    select niveau_geographique, code_territoire, id_departement, id_zone_agroecologique, decade,
        {{ mesures }}
    from zone

)

select
    md5(niveau_geographique || '|' || code_territoire || '|' || to_varchar(decade)) as id_climatologie,

    -- Niveau et clés géographiques (une seule renseignée par ligne)
    niveau_geographique,
    id_departement,
    id_zone_agroecologique,

    -- Temps
    decade::integer as numero_decade_annee,
    decade between 16 and 30 as est_decade_saison,
    '1991-2020' as periode_reference,

    -- Mesures non additives
    {{ mesures }}

from unioned
