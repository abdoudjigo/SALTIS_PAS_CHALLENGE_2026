{{
    config(materialized='table')
}}

-- Observatoire Sénégal 2050 : séries de production, de superficie et de rendement
-- par département, par région et pour le pays, 1981-2021, plus le rendement national FAOSTAT
-- (série distincte, jamais additionnée aux sommes des départements).
--
-- Grain : (serie, niveau, code_zone, culture, campagne_agricole).
--
-- Règles
--   - Source : fact_rendement_departement (non modifié), campagnes <= 2021. Aucune prévision, aucune interpolation.
--   - Un département compte (nb_departements_observes) seulement s'il a production ET superficie.
--     Seules ces lignes entrent dans les sommes : production_t et superficie_ha sont donc toujours sur la même base.
--   - Région et pays = somme des départements ATTENDUS (seed ref_departements_attendus, Guédiawaye et Pikine exclus).
--   - rendement_kg_ha = sum(production_t) * 1000 / sum(superficie_ha), jamais une moyenne de rendements.
--     Le rendement fourni par la source n'est pas repris : il est recalculé (écarts constatés jusqu'à 5 kg/ha).
--   - est_complet = tous les départements attendus ont production et superficie. Sinon faux : total partiel.
--   - Riz 2021 : saison irriguée probablement manquante (287 135 t contre 1 326 761 t au tableau 1 de la SSA).
--     Départements visibles avec est_complet = false ; région et pays = NULL (le total national s'arrête en 2020).
--   - Mesure absente = NULL, jamais 0.
--   - Cultures : 7 cultures par département (arachide, mil, sorgho, niébé, maïs, riz, manioc) + sésame au niveau
--     département seulement (données jusqu'en 2016, trop partielles pour une somme).
--   - serie = 'FAOSTAT' : rendement national seul (production et superficie NULL), campagnes 1981-2024.

{% set derniere_campagne = 2021 %}
{% set cultures_agregees = ["ARACHIDE", "MANIOC", "MAÏS", "MIL (SOUNA)", "NIÉBÉ", "RIZ (IRRIGUÉ)", "SORGHO"] %}

with cultures as (

    select id_culture, culture
    from {{ ref('dim_culture') }}
    where culture in (
        {% for c in cultures_agregees %}'{{ c }}',{% endfor %}
        'SÉSAME'
    )

)

, geo as (

    select id_departement, code_departement, departement, code_region, region
    from {{ ref('dim_geographie') }}

)

, attendus as (

    select
        upper(trim(a.culture)) as culture,
        trim(a.code_departement) as code_departement
    from {{ ref('ref_departements_attendus') }} a

)

, nb_attendus_pays as (

    select culture, count(*) as nb_attendus
    from attendus
    group by culture

)

, nb_attendus_region as (

    select a.culture, g.code_region, count(*) as nb_attendus
    from attendus a
    join geo g on g.code_departement = a.code_departement
    group by a.culture, g.code_region

)

, departements as (

    select
        f.campagne_agricole,
        c.culture,
        g.code_departement,
        g.departement,
        g.code_region,
        g.region,
        f.production_t,
        f.superficie_ha,
        (f.production_t is not null and f.superficie_ha is not null and f.superficie_ha > 0) as a_les_deux,
        f.type_superficie,
        coalesce(f.source_rendement, 'DAPSA') as source_rendement,
        (at.code_departement is not null) as est_attendu
    from {{ ref('fact_rendement_departement') }} f
    join cultures c on c.id_culture = f.id_culture
    join geo g on g.id_departement = f.id_departement
    left join attendus at
        on at.culture = c.culture and at.code_departement = g.code_departement
    where f.campagne_agricole between 1981 and {{ derniere_campagne }}
      and f.est_observe

)

-- Niveau département : toutes les lignes observées (production seule ou superficie seule visibles, rendement NULL)
, lignes_departement as (

    select
        'DEPARTEMENT' as niveau,
        code_departement as code_zone,
        departement as zone,
        code_region,
        region,
        culture,
        campagne_agricole,
        production_t,
        superficie_ha,
        case when a_les_deux then production_t * 1000 / superficie_ha end as rendement_kg_ha,
        case when a_les_deux then 1 else 0 end as nb_departements_observes,
        case when est_attendu then 1 when culture = 'SÉSAME' then null else 0 end as nb_departements_attendus,
        (a_les_deux and not (culture = 'RIZ (IRRIGUÉ)' and campagne_agricole = 2021)) as est_complet,
        type_superficie,
        'DAPSA' as serie,
        source_rendement as source,
        case
            when culture = 'RIZ (IRRIGUÉ)' and campagne_agricole = 2021
                then 'Incomplet : saison irriguée probablement manquante (SSA 2025-2034, tableau 1 : 1 326 761 t)'
            when not a_les_deux
                then 'Production ou superficie manquante : rendement non calculé'
        end as note
    from departements

)

, base_agregats as (

    select *
    from departements
    where est_attendu and a_les_deux and culture in (
        {% for c in cultures_agregees %}'{{ c }}'{% if not loop.last %},{% endif %}{% endfor %}
    )

)

, agregats_region as (

    select
        'REGION' as niveau,
        b.code_region as code_zone,
        max(b.region) as zone,
        b.code_region,
        max(b.region) as region,
        b.culture,
        b.campagne_agricole,
        sum(b.production_t) as production_t,
        sum(b.superficie_ha) as superficie_ha,
        count(*) as nb_departements_observes,
        max(n.nb_attendus) as nb_departements_attendus,
        case when min(b.type_superficie) = max(b.type_superficie) then min(b.type_superficie) else 'mixte' end as type_superficie,
        min(b.source_rendement) as source_rendement
    from base_agregats b
    join nb_attendus_region n on n.culture = b.culture and n.code_region = b.code_region
    group by b.code_region, b.culture, b.campagne_agricole

)

, agregats_pays as (

    select
        'PAYS' as niveau,
        'SEN' as code_zone,
        'Sénégal' as zone,
        cast(null as varchar) as code_region,
        cast(null as varchar) as region,
        b.culture,
        b.campagne_agricole,
        sum(b.production_t) as production_t,
        sum(b.superficie_ha) as superficie_ha,
        count(*) as nb_departements_observes,
        max(n.nb_attendus) as nb_departements_attendus,
        case when min(b.type_superficie) = max(b.type_superficie) then min(b.type_superficie) else 'mixte' end as type_superficie,
        min(b.source_rendement) as source_rendement
    from base_agregats b
    join nb_attendus_pays n on n.culture = b.culture
    group by b.culture, b.campagne_agricole

)

, agregats as (

    select * from agregats_region
    union all
    select * from agregats_pays

)

, lignes_agregats as (

    select
        niveau,
        code_zone,
        zone,
        code_region,
        region,
        culture,
        campagne_agricole,
        case when ferme then null else production_t end as production_t,
        case when ferme then null else superficie_ha end as superficie_ha,
        case when ferme then null else production_t * 1000 / nullif(superficie_ha, 0) end as rendement_kg_ha,
        nb_departements_observes,
        nb_departements_attendus,
        (nb_departements_observes = nb_departements_attendus and not ferme) as est_complet,
        type_superficie,
        'DAPSA' as serie,
        'Somme des départements attendus, ' || source_rendement as source,
        case
            when ferme
                then 'Total arrêté en 2020 : riz 2021 incomplet (saison irriguée probablement manquante)'
            when nb_departements_observes < nb_departements_attendus
                then 'Total partiel : ' || nb_departements_observes || ' départements sur ' || nb_departements_attendus || ' attendus'
        end as note
    from (
        select
            *,
            (culture = 'RIZ (IRRIGUÉ)' and campagne_agricole >= 2021) as ferme
        from agregats
    )

)

, faostat as (

    select
        'PAYS' as niveau,
        'SEN' as code_zone,
        'Sénégal' as zone,
        cast(null as varchar) as code_region,
        cast(null as varchar) as region,
        c.culture,
        r.annee::integer as campagne_agricole,
        cast(null as float) as production_t,
        cast(null as float) as superficie_ha,
        max(r.rendement_national_kg_ha) as rendement_kg_ha,
        cast(null as integer) as nb_departements_observes,
        cast(null as integer) as nb_departements_attendus,
        cast(null as boolean) as est_complet,
        cast(null as varchar) as type_superficie,
        'FAOSTAT' as serie,
        'FAOSTAT' as source,
        'Rendement national seul : série distincte, jamais additionnée aux sommes des départements' as note
    from {{ ref('stg_rendements') }} r
    join cultures c on c.id_culture = {{ cle_culture('r.culture') }}
    where r.rendement_national_kg_ha is not null
      and r.annee is not null
      and c.culture in (
        {% for c in cultures_agregees %}'{{ c }}'{% if not loop.last %},{% endif %}{% endfor %}
      )
    group by c.culture, r.annee

)

select * from lignes_departement
union all
select * from lignes_agregats
union all
select * from faostat
