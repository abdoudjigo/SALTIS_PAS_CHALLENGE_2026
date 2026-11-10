-- Contrôles de cohérence du suivi décadaire des pluies.
-- Le test échoue s'il renvoie au moins une ligne.

with fait as (

    select *
    from {{ ref('fact_pluviometrie_decadaire') }}

),

-- Le cumul publié doit égaler la somme des pluies depuis la décade 16
cumul_recalcule as (

    select
        id_pluie_decade,
        cumul_depuis_juin_mm,
        sum(pluie_mm) over (
            partition by id_departement, annee
            order by numero_decade_annee
            rows between unbounded preceding and current row
        ) as cumul_calcule
    from fait
    where est_decade_saison

)

select id_pluie_decade, 'valeur négative' as anomalie
from fait
where pluie_mm < 0
   or pluie_normale_mm < 0
   or nb_jours_pluie < 0
   or plus_longue_sequence_seche_j < 0
   or cumul_depuis_juin_mm < 0

union all

-- Une décade compte au plus 11 jours
select id_pluie_decade, 'jours hors bornes'
from fait
where nb_jours_pluie > 11
   or plus_longue_sequence_seche_j > 11

union all

-- Cumul et part de saison : renseignés en saison, nuls hors saison
select id_pluie_decade, 'cumul incohérent avec la saison'
from fait
where (est_decade_saison and (cumul_depuis_juin_mm is null or cumul_normale_depuis_juin_mm is null))
   or (not est_decade_saison and (cumul_depuis_juin_mm is not null or part_saison_pct is not null))

union all

select id_pluie_decade, 'cumul différent de la somme des pluies'
from cumul_recalcule
where abs(cumul_depuis_juin_mm - cumul_calcule) > 0.01

union all

-- Grain : une seule ligne par département, année et décade
select max(id_pluie_decade), 'grain dupliqué'
from fait
group by id_departement, annee, numero_decade_annee
having count(*) > 1
