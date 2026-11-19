-- Cadre harmonisé, mart (dernier cycle). Le test échoue s'il renvoie au moins une ligne.
--   - 45 départements au plus ; un seul cycle, le dernier du fait ; une seule période retenue pour tous ;
--   - phases entre 1 et 5 ; population en phases 3 à 5 <= population (retenue, courante, projetée) ;
--   - aucune agrégation entre cycles : chaque valeur retenue = la ligne du fait du même département,
--     du dernier cycle et du type retenu ;
--   - période retenue : usethisperiod, sinon la projection ; periode_terminee = fin < date_calcul ;
--   - note_fusion renseignée si et seulement si fusion_keur_massar.

with m as (select * from {{ ref('mart_cadre_harmonise_departement') }}),
f as (select * from {{ ref('fact_cadre_harmonise') }}),
dernier as (select max(ordre_cycle) as ordre_cycle from f)

select to_varchar(count(*)) as cle, 'plus de 45 départements' as anomalie
from m having count(*) > 45

union all
select to_varchar(count(distinct annee_cycle * 10 + code_cycle)) || ' / ' || to_varchar(count(distinct libelle_periode_retenue)),
       'plusieurs cycles ou plusieurs périodes retenues'
from m having count(distinct annee_cycle * 10 + code_cycle) > 1 or count(distinct libelle_periode_retenue) > 1

union all
select m.code_departement, 'cycle du mart différent du dernier cycle du fait'
from m
join f on f.code_departement = m.code_departement and f.annee_cycle = m.annee_cycle and f.code_cycle = m.code_cycle
cross join dernier
where f.ordre_cycle <> dernier.ordre_cycle

union all
select code_departement, 'phase hors 1 à 5'
from m where phase_retenue not between 1 and 5 or phase_courante not between 1 and 5 or phase_projetee not between 1 and 5

union all
select code_departement, 'phases 3 à 5 > population'
from m
where population_phase3_5_retenue > population_retenue
   or population_phase3_5_courante > population_courante
   or population_phase3_5_projetee > population_projetee

union all
select m.code_departement, 'valeur retenue différente de la ligne du fait (agrégation interdite)'
from m
left join f
  on f.code_departement = m.code_departement and f.annee_cycle = m.annee_cycle
 and f.code_cycle = m.code_cycle and f.type_periode = m.type_periode_retenue
where m.type_periode_retenue is not null
  and (f.code_departement is null
       or equal_null(f.population_phase3_5, m.population_phase3_5_retenue) = false
       or equal_null(f.population, m.population_retenue) = false
       or equal_null(f.phase_class, m.phase_retenue) = false)

union all
select m.code_departement, 'période retenue contraire à la règle (usethisperiod, sinon projection)'
from m
join f on f.code_departement = m.code_departement and f.annee_cycle = m.annee_cycle and f.code_cycle = m.code_cycle
group by m.code_departement, m.type_periode_retenue
having m.type_periode_retenue <> iff(
    count_if(f.periode_a_utiliser) = 1, max(iff(f.periode_a_utiliser, f.type_periode, null)),
    coalesce(max(iff(f.type_periode = 'projected', 'projected', null)), max(f.type_periode)))

union all
select code_departement, 'periode_terminee incohérente'
from m where type_periode_retenue is not null and periode_terminee <> (date_fin_periode_retenue < date_calcul)

union all
select code_departement, 'note_fusion incohérente'
from m where (note_fusion is not null) <> fusion_keur_massar
