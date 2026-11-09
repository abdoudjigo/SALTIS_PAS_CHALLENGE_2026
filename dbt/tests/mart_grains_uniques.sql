with duplicate_grains as (
    select
        'mart_saisons' as model_name,
        code_departement || '|' || to_varchar(annee) as grain_key,
        count(*) as row_count
    from {{ ref('mart_saisons') }}
    group by code_departement, annee
    having count(*) > 1

    union all

    select
        'mart_adequation',
        code_departement || '|' || culture || '|' || classe_cycle,
        count(*)
    from {{ ref('mart_adequation') }}
    group by code_departement, culture, classe_cycle
    having count(*) > 1

    union all

    select
        'mart_adequation_varietes',
        code_departement || '|' || culture || '|' || variete,
        count(*)
    from {{ ref('mart_adequation_varietes') }}
    group by code_departement, culture, variete
    having count(*) > 1

    union all

    select
        'mart_besoins',
        code_departement || '|' || culture,
        count(*)
    from {{ ref('mart_besoins') }}
    group by code_departement, culture
    having count(*) > 1

    union all

    select
        'mart_facteurs_limitants',
        zone_agroecologique || '|' || culture,
        count(*)
    from {{ ref('mart_facteurs_limitants') }}
    group by zone_agroecologique, culture
    having count(*) > 1

    union all

    select
        'mart_rendements',
        code_departement || '|' || to_varchar(annee) || '|' || culture,
        count(*)
    from {{ ref('mart_rendements') }}
    group by code_departement, annee, culture
    having count(*) > 1

    union all

    select
        'mart_agrodistrib',
        code_departement || '|' || scenario || '|' || produit,
        count(*)
    from {{ ref('mart_agrodistrib') }}
    group by code_departement, scenario, produit
    having count(*) > 1
)

select *
from duplicate_grains
