-- Cadre harmonisé (CILSS / IPC) par département. Grain : département SOURCE × cycle × type de période
-- (code_departement, nom_departement_source, annee_cycle, code_cycle, type_periode), comme RAW.
-- Keur Massar (créé en 2021, hors GADM 4.1) porte le code de Pikine : lignes séparées, fusion dans
-- fact_cadre_harmonise. Valeurs reprises telles quelles (personnes, décimales de la source).
--
-- Ajouts :
--   - date_debut_periode / date_fin_periode : mois de libelle_periode_reference (Jan-May, Jun-Aug, Sep-Dec)
--     dans annee_periode_reference ; un libellé non prévu donne NULL (test not_null) ;
--   - ordre_cycle : ordre chronologique des cycles. code_cycle n'est pas chronologique (1 = Sep-Dec, 2 = Jan-May) :
--     dans une année, le cycle Jan-May (analyse de mars) précède le cycle Sep-Dec (analyse de novembre).
{{ config(materialized='view') }}

with source as (

    select * from {{ source('raw', 'e_cadre_harmonise_departement') }}

),

mois as (

    select
        *,
        case trim(libelle_periode_reference)
            when 'Jan-May' then 1 when 'Jun-Aug' then 6 when 'Sep-Dec' then 9
        end as mois_debut_periode,
        case trim(libelle_periode_reference)
            when 'Jan-May' then 5 when 'Jun-Aug' then 8 when 'Sep-Dec' then 12
        end as mois_fin_periode
    from source

)

select
    trim(code_departement) as code_departement,
    trim(departement) as departement,
    trim(nom_departement_source) as nom_departement_source,
    trim(region_ch) as region_ch,
    trim(code_adm2_ch) as code_adm2_ch,
    annee_cycle::integer as annee_cycle,
    code_cycle::integer as code_cycle,
    trim(libelle_cycle) as libelle_cycle,
    annee_cycle * 10 + case code_cycle when 2 then 1 when 1 then 2 end as ordre_cycle,
    trim(type_periode) as type_periode,
    trim(libelle_periode_reference) as libelle_periode_reference,
    annee_periode_reference::integer as annee_periode_reference,
    date_from_parts(annee_periode_reference, mois_debut_periode, 1) as date_debut_periode,
    last_day(date_from_parts(annee_periode_reference, mois_fin_periode, 1)) as date_fin_periode,
    periode_a_utiliser,
    population,
    phase_class::integer as phase_class,
    population_phase1,
    population_phase2,
    population_phase3,
    population_phase4,
    population_phase5,
    population_phase3_5,
    phase_consommation_alimentaire::integer as phase_consommation_alimentaire,
    phase_moyens_existence::integer as phase_moyens_existence,
    phase_nutrition::integer as phase_nutrition,
    source,
    date_chargement
from mois
