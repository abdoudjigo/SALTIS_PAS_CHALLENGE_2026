-- Seed ref_cultures (paramètres agronomiques) face à dim_culture et fact_adequation_culture.
-- Le test échoue s'il renvoie au moins une ligne :
--   - les 12 cultures du seed existent dans dim_culture, et chaque culture évaluée dans
--     fact_adequation_culture a ses paramètres ;
--   - cycle_min_jours = cycle_jours du cycle court, cycle_max_jours = celui du cycle long,
--     pour tous les départements ;
--   - Kc et température de base dans des bornes plausibles.

with culture as (

    select * from {{ ref('dim_culture') }}

),

seed as (

    select upper(trim(culture)) as culture
    from {{ ref('ref_cultures') }}

),

cycles as (

    select
        id_culture,
        min(iff(classe_cycle = 'courte', cycle_jours, null)) as court_min,
        max(iff(classe_cycle = 'courte', cycle_jours, null)) as court_max,
        min(iff(classe_cycle = 'longue', cycle_jours, null)) as long_min,
        max(iff(classe_cycle = 'longue', cycle_jours, null)) as long_max
    from {{ ref('fact_adequation_culture') }}
    group by id_culture

)

select s.culture, 'culture du seed absente de dim_culture' as anomalie
from seed s
left join culture c on c.culture = s.culture
where c.culture is null

union all

select to_varchar(count(*)), 'le seed doit compter 12 cultures'
from seed
having count(*) <> 12

union all

select c.culture, 'culture évaluée sans paramètres agronomiques'
from cycles a
join culture c on c.id_culture = a.id_culture
where c.nom_fao is null

union all

select c.culture, 'cycle min ou max différent des cycles court et long de l''adéquation'
from cycles a
join culture c on c.id_culture = a.id_culture
where c.cycle_min_jours <> a.court_min or c.cycle_min_jours <> a.court_max
   or c.cycle_max_jours <> a.long_min  or c.cycle_max_jours <> a.long_max
   or c.cycle_min_jours > c.cycle_max_jours

union all

select culture, 'Kc ou température de base hors bornes'
from culture
where nom_fao is not null
  and (kc_ini not between 0.1 and 1.5 or kc_mid not between 0.1 and 1.5 or kc_end not between 0.1 and 1.5
       or t_base_c not between 0 and 20)
