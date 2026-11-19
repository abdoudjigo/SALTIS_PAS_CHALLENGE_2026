-- Cadre harmonisé, fait. Le test échoue s'il renvoie au moins une ligne.
--   - grain unique (département × cycle × type de période) ; 45 départements au plus par cycle et type ;
--   - phases entre 1 et 5 ; population en phases 3 à 5 <= population ;
--   - fusion Keur Massar : total national des phases 3 à 5 identique avant (staging) et après (fait),
--     par cycle et type de période ; periode_a_utiliser identique pour les lignes fusionnées ;
--   - fusion_keur_massar seulement pour Pikine.

with f as (select * from {{ ref('fact_cadre_harmonise') }}),
s as (select * from {{ ref('stg_cadre_harmonise') }}),

avant as (
    select annee_cycle, code_cycle, type_periode, sum(population_phase3_5) as total_35,
           count(distinct periode_a_utiliser::varchar || code_departement) - count(distinct code_departement) as ecart_usage
    from s group by all
),
apres as (
    select annee_cycle, code_cycle, type_periode, sum(population_phase3_5) as total_35, count(*) as nb
    from f group by all
)

select code_departement || ' ' || annee_cycle || ' ' || code_cycle || ' ' || type_periode as cle, 'grain non unique' as anomalie
from f group by code_departement, annee_cycle, code_cycle, type_periode having count(*) > 1

union all
select annee_cycle || ' ' || code_cycle || ' ' || type_periode, 'plus de 45 départements'
from apres where nb > 45

union all
select code_departement || ' ' || annee_cycle || ' ' || type_periode, 'phase hors 1 à 5'
from f
where phase_class not between 1 and 5
   or phase_consommation_alimentaire not between 1 and 5
   or phase_moyens_existence not between 1 and 5
   or phase_nutrition not between 1 and 5

union all
select code_departement || ' ' || annee_cycle || ' ' || type_periode, 'phases 3 à 5 > population'
from f where population_phase3_5 > population

union all
select coalesce(a.annee_cycle, p.annee_cycle) || ' ' || coalesce(a.code_cycle, p.code_cycle) || ' ' || coalesce(a.type_periode, p.type_periode),
       'total national 3 à 5 modifié par la fusion'
from avant a
full outer join apres p
  on p.annee_cycle = a.annee_cycle and p.code_cycle = a.code_cycle and p.type_periode = a.type_periode
where a.total_35 is null or p.total_35 is null or abs(a.total_35 - p.total_35) > 0.01

union all
select annee_cycle || ' ' || code_cycle || ' ' || type_periode, 'periode_a_utiliser différente entre lignes fusionnées'
from avant where ecart_usage <> 0

union all
select code_departement || ' ' || annee_cycle, 'fusion_keur_massar hors Pikine'
from f where fusion_keur_massar and departement <> 'Pikine'

union all
-- Chiffre officiel : 836 787 personnes en phases 3 à 5, projection juin-août 2026, cycle Jan-May 2026,
-- Keur Massar compris (à une personne près). Ne s'applique que tant que ce cycle est chargé.
select to_varchar(round(sum(population_phase3_5))), 'cycle Jan-May 2026 projeté : total 3 à 5 différent de 836 787'
from f
where annee_cycle = 2026 and code_cycle = 2 and type_periode = 'projected'
having count(*) > 0 and abs(sum(population_phase3_5) - 836787) > 1
