{{ config(materialized='table') }}

-- Écran Cadre harmonisé (CILSS / IPC), dernier cycle disponible. Grain : département (45 au plus).
-- À plat, codes lisibles, sans clé md5. Hors score de vulnérabilité (mart_vulnerabilite_departement inchangé).
--
--   - dernier cycle = plus grand ordre_cycle de fact_cadre_harmonise (Jan-May, analyse de mars, précède
--     Sep-Dec, analyse de novembre, dans une même année) ;
--   - phase et population en phases 3 à 5 de la situation courante (current) et de la projection (projected) ;
--   - période retenue (colonnes _retenue) : la période marquée periode_a_utiliser (usethisperiod) ; si les deux
--     le sont, ou aucune, la projection ;
--   - periode_terminee = date_fin_periode_retenue < date_calcul (date du dbt build ; le front peut recalculer
--     depuis date_fin_periode_retenue) ; mention_periode = « période terminée, prochain cycle attendu »
--     quand periode_terminee, NULL sinon ;
--   - aucune agrégation entre cycles ni entre types de période : chaque valeur est celle d'une seule ligne du fait.
-- Pikine inclut Keur Massar (fusion_keur_massar, note_fusion).

with fait as (

    select * from {{ ref('fact_cadre_harmonise') }}

),

dernier as (

    select * from fait
    where ordre_cycle = (select max(ordre_cycle) from fait)

),

libelles as (

    select
        *,
        case libelle_cycle when 'Jan-May' then 'mars' when 'Sep-Dec' then 'novembre' end
            || ' ' || annee_cycle as libelle_cycle_fr,
        case type_periode when 'current' then 'situation courante' when 'projected' then 'projection' end
            || ' '
            || case libelle_periode_reference
                   when 'Jan-May' then 'janvier-mai' when 'Jun-Aug' then 'juin-août' when 'Sep-Dec' then 'septembre-décembre'
               end
            || ' ' || annee_periode_reference as libelle_periode_fr,
        row_number() over (
            partition by code_departement
            order by periode_a_utiliser desc, iff(type_periode = 'projected', 0, 1)
        ) as rang_retenue
    from dernier

),

courante as (select * from libelles where type_periode = 'current'),
projetee as (select * from libelles where type_periode = 'projected'),
retenue as (select * from libelles where rang_retenue = 1),

geo as (

    select code_departement, departement, code_region, region, zone_agroecologique
    from {{ ref('dim_geographie') }}

)

select
    geo.code_departement,
    geo.departement,
    geo.code_region,
    geo.region,
    geo.zone_agroecologique,

    retenue.annee_cycle,
    retenue.code_cycle,
    retenue.libelle_cycle as libelle_cycle_source,
    retenue.libelle_cycle_fr as libelle_cycle,

    -- période retenue (affichée)
    retenue.type_periode as type_periode_retenue,
    retenue.libelle_cycle_fr || ', ' || retenue.libelle_periode_fr as libelle_periode_retenue,
    retenue.date_debut_periode as date_debut_periode_retenue,
    retenue.date_fin_periode as date_fin_periode_retenue,
    retenue.date_fin_periode < current_date as periode_terminee,
    iff(retenue.date_fin_periode < current_date, 'période terminée, prochain cycle attendu', null) as mention_periode,
    retenue.phase_class as phase_retenue,
    case retenue.phase_class
        when 1 then 'minimale' when 2 then 'sous pression' when 3 then 'crise' when 4 then 'urgence' when 5 then 'famine'
    end as libelle_phase_retenue,
    retenue.population as population_retenue,
    retenue.population_phase3_5 as population_phase3_5_retenue,

    -- situation courante et projection du même cycle
    courante.libelle_cycle_fr || ', ' || courante.libelle_periode_fr as libelle_periode_courante,
    courante.phase_class as phase_courante,
    courante.population as population_courante,
    courante.population_phase3_5 as population_phase3_5_courante,
    projetee.libelle_cycle_fr || ', ' || projetee.libelle_periode_fr as libelle_periode_projetee,
    projetee.phase_class as phase_projetee,
    projetee.population as population_projetee,
    projetee.population_phase3_5 as population_phase3_5_projetee,

    coalesce(retenue.fusion_keur_massar, false) as fusion_keur_massar,
    iff(retenue.fusion_keur_massar,
        'Pikine et Keur Massar réunis (Keur Massar, créé en 2021, n''existe pas dans GADM)', null) as note_fusion,
    'Cadre harmonisé, CILSS et partenaires ; données via HDX (Food Security and Nutrition Working Group, Afrique de l''Ouest et du Centre)' as source,
    'CC BY' as licence,
    current_date as date_calcul
from geo
left join retenue on retenue.code_departement = geo.code_departement
left join courante on courante.code_departement = geo.code_departement
left join projetee on projetee.code_departement = geo.code_departement
