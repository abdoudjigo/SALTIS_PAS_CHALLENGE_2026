{{
    config(materialized='view')
}}

-- Circuit des doses (docs/technique/etat-modelisation.md, section 6) : union de toutes les sources
-- de doses, puis choix d'UNE source par zone x culture x groupe de doses.
-- Grain : zone d'application x culture x code_intrant x source_reference.
--   - zone_agroecologique : zone de la source (NULL = dose nationale) ;
--   - zone_application    : zone où la dose est candidate. Une dose nationale est candidate
--     dans chacune des 6 zones (jamais recopiée par département).
--
-- Sources :
--   - doses actuelles (stg_besoins_hectare, c_besoins_par_hectare) : Tounkara 2022, Faye 2020,
--     extrapolations et « source web » ; statuts par macros/statuts_doses.sql ;
--   - doses PIA (seed ref_doses_pia : catalogue IFDC-CORAF des Paquets d'Intrants Agricoles,
--     fiches variétales ISRA), nationales, statut fourni par le fichier.
--
-- Groupes de doses : ENGRAIS (produits engrais, fumier et éléments N, P2O5, K2O, la formule
-- entière), SEMENCES, EAU. On retient une seule source par zone x culture x groupe :
-- on ne mélange jamais deux formules.
-- Priorité (rang_priorite, le plus petit gagne) :
--   1. dose propre à la zone issue d'un document de recherche (VALIDEE ou A_CONFIRMER) :
--      Tounkara 2022 (mil, Casamance), Faye 2020 (riz, Vallée, engrais et semences) ;
--   2. dose nationale VALIDEE ou A_CONFIRMER (PIA) ;
--   3. autres doses (NON_VERIFIEE : mil extrapolé, « source web », semis Faye extrapolé).
-- À rang égal : VALIDEE d'abord, puis ordre alphabétique de la source (déterministe).
-- Sans dose (sésame, coton, manioc, oignon, tomate, pastèque…) : aucune ligne, besoin NULL.

{% set intrants_fertilisation = [
    {'code': 'NPK_15_15_15', 'type': 'PRODUIT', 'colonne': 'npk_15_15_15_kg_ha',          'unite': 'kg/ha'},
    {'code': 'UREE',         'type': 'PRODUIT', 'colonne': 'uree_kg_ha',                  'unite': 'kg/ha'},
    {'code': 'DAP_18_46_0',  'type': 'PRODUIT', 'colonne': 'dap_kg_ha',                   'unite': 'kg/ha'},
    {'code': 'FUMIER',       'type': 'PRODUIT', 'colonne': 'fumier_t_ha',                 'unite': 't/ha'},
    {'code': 'N',            'type': 'ELEMENT', 'colonne': 'dose_n_recommandee_kg_ha',    'unite': 'kg/ha'},
    {'code': 'P2O5',         'type': 'ELEMENT', 'colonne': 'dose_p2o5_recommandee_kg_ha', 'unite': 'kg/ha'},
    {'code': 'K2O',          'type': 'ELEMENT', 'colonne': 'dose_k2o_recommandee_kg_ha',  'unite': 'kg/ha'},
] %}

with source as (

    select *
    from {{ ref('stg_besoins_hectare') }}
    where zone_agroecologique is not null
      and culture is not null

),

zones as (

    select distinct zone_agroecologique as zone_application
    from source

),

fertilisation as (

    select
        *,
        {{ statut_validation_engrais('statut_dose') }} as statut_validation,
        {{ source_reference_engrais('statut_dose', 'origine_dose') }} as source_reference,
        array_to_string(array_construct_compact(
            'statut : ' || trim(statut_dose),
            'origine : ' || trim(origine_dose),
            'formule : ' || trim(formule_engrais_recommandee)
        ), ' | ') as note_source
    from source

),

{% for i in intrants_fertilisation %}
dose_{{ i.code | lower }} as (

    select
        zone_agroecologique,
        culture,
        '{{ i.code }}' as code_intrant,
        '{{ i.type }}' as type_intrant,
        {{ i.colonne }} as dose,
        '{{ i.unite }}' as unite,
        cast(null as float) as besoin_eau_mm,
        cast(null as float) as dose_min,
        cast(null as float) as dose_max,
        cast(null as varchar) as regle,
        statut_validation,
        source_reference,
        note_source
    from fertilisation
    where {{ i.colonne }} is not null

),
{% endfor %}

semences as (

    select
        zone_agroecologique,
        culture,
        'SEMENCES' as code_intrant,
        'PRODUIT' as type_intrant,
        dose_semis_kg_ha as dose,
        'kg/ha' as unite,
        cast(null as float) as besoin_eau_mm,
        cast(null as float) as dose_min,
        cast(null as float) as dose_max,
        cast(null as varchar) as regle,
        {{ statut_validation_semis('statut_dose_semis', 'zone_agroecologique') }} as statut_validation,
        {{ source_reference_semis('origine_dose_semis', 'zone_agroecologique') }} as source_reference,
        array_to_string(array_construct_compact(
            'statut : ' || trim(statut_dose_semis),
            'origine : ' || trim(origine_dose_semis)
        ), ' | ') as note_source
    from source
    where dose_semis_kg_ha is not null

),

irrigation as (

    select
        zone_agroecologique,
        culture,
        'EAU_IRRIGATION' as code_intrant,
        'EAU' as type_intrant,
        volume_irrigation_m3_ha as dose,
        'm3/ha' as unite,
        besoin_irrigation_normal_mm as besoin_eau_mm,
        cast(null as float) as dose_min,
        cast(null as float) as dose_max,
        cast(null as varchar) as regle,
        'A_CONFIRMER' as statut_validation,
        'Estimation FAO-56 (dataset SALTIS)' as source_reference,
        'estimation calculée (FAO-56, efficience 60 %), non mesurée' as note_source
    from source
    where volume_irrigation_m3_ha is not null

),

pia as (

    select
        nullif(trim(zone_agroecologique), '') as zone_agroecologique,
        trim(culture) as culture,
        upper(trim(code_intrant)) as code_intrant,
        upper(trim(type_intrant)) as type_intrant,
        dose,
        trim(unite) as unite,
        cast(null as float) as besoin_eau_mm,
        dose_min,
        dose_max,
        trim(regle) as regle,
        upper(trim(statut_validation)) as statut_validation,
        trim(source_reference) as source_reference,
        trim(note_source) as note_source
    from {{ ref('ref_doses_pia') }}
    where dose is not null

),

unioned as (

    {% for i in intrants_fertilisation %}
    select * from dose_{{ i.code | lower }}
    union all
    {% endfor %}
    select * from semences
    union all
    select * from irrigation
    union all
    select * from pia

),

candidats as (

    select
        md5(
            coalesce(upper(trim(u.zone_agroecologique)), 'NATIONAL') || '|' || upper(trim(u.culture))
            || '|' || u.code_intrant || '|' || coalesce(u.source_reference, '')
        ) as id_reference_agronomique,
        u.*,
        iff(u.zone_agroecologique is null, 'NATIONAL', 'ZONE') as portee_geographique,
        z.zone_application,
        case
            when u.code_intrant = 'SEMENCES' then 'SEMENCES'
            when u.type_intrant = 'EAU'      then 'EAU'
            else 'ENGRAIS'
        end as groupe_dose,
        case
            when u.statut_validation in ('VALIDEE', 'A_CONFIRMER') and u.zone_agroecologique is not null then 1
            when u.statut_validation in ('VALIDEE', 'A_CONFIRMER') then 2
            else 3
        end as rang_priorite
    from unioned u
    join zones z
        on u.zone_agroecologique is null
        or upper(trim(u.zone_agroecologique)) = upper(trim(z.zone_application))

),

-- Une source = toute sa formule pour le groupe : son rang est celui de sa meilleure ligne
sources as (

    select
        zone_application,
        upper(trim(culture)) as culture_cle,
        groupe_dose,
        source_reference,
        min(rang_priorite) as rang_source,
        boolor_agg(statut_validation = 'VALIDEE') as a_dose_validee
    from candidats
    group by 1, 2, 3, 4

),

source_retenue as (

    select zone_application, culture_cle, groupe_dose, source_reference
    from sources
    qualify row_number() over (
        partition by zone_application, culture_cle, groupe_dose
        order by rang_source, a_dose_validee desc, source_reference
    ) = 1

)

select
    c.id_reference_agronomique,
    c.zone_agroecologique,
    c.portee_geographique,
    c.zone_application,
    c.culture,
    c.code_intrant,
    c.type_intrant,
    c.groupe_dose,
    c.dose,
    c.unite,
    c.besoin_eau_mm,
    c.dose_min,
    c.dose_max,
    c.regle,
    c.statut_validation,
    c.source_reference,
    c.note_source,
    c.rang_priorite,
    r.source_reference is not null as est_retenue

from candidats c
left join source_retenue r
    on r.zone_application = c.zone_application
   and r.culture_cle = upper(trim(c.culture))
   and r.groupe_dose = c.groupe_dose
   and r.source_reference = c.source_reference
