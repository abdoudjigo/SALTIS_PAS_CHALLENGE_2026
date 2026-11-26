-- Contrôles du mart des séries de l'Observatoire. Chaque ligne rendue est une anomalie.

with s as (
    select * from {{ ref('mart_observatoire_series') }}
)

-- 1. clé unique
select 'doublon' as probleme, serie, niveau, code_zone, culture, campagne_agricole
from s
group by serie, niveau, code_zone, culture, campagne_agricole
having count(*) > 1

union all

-- 2. jamais 0 à la place d'un manque, jamais de valeur négative, plage 1981-2021 pour les sommes
select 'valeur_negative_ou_hors_plage', serie, niveau, code_zone, culture, campagne_agricole
from s
where production_t < 0 or superficie_ha < 0 or rendement_kg_ha < 0
   or (serie = 'DAPSA' and campagne_agricole not between 1981 and 2021)

union all

-- 3. rendement des agrégats et des départements = production x 1000 / superficie (arrondi)
select 'rendement_incoherent', serie, niveau, code_zone, culture, campagne_agricole
from s
where serie = 'DAPSA'
  and rendement_kg_ha is not null
  and (production_t is null or superficie_ha is null or superficie_ha = 0
       or abs(rendement_kg_ha - production_t * 1000 / superficie_ha) > 0.001)

union all

-- 4. rendement NULL seulement si production ou superficie manque (DAPSA, hors riz 2021 agrégé)
select 'rendement_manquant_a_tort', serie, niveau, code_zone, culture, campagne_agricole
from s
where serie = 'DAPSA' and rendement_kg_ha is null
  and production_t is not null and superficie_ha is not null and superficie_ha > 0

union all

-- 5. FAOSTAT : rendement seul, niveau pays, jamais de somme
select 'faostat_melange', serie, niveau, code_zone, culture, campagne_agricole
from s
where serie = 'FAOSTAT'
  and (production_t is not null or superficie_ha is not null or niveau <> 'PAYS' or source <> 'FAOSTAT' or rendement_kg_ha is null)

union all

-- 6. est_complet cohérent avec les nombres de départements (agrégats)
select 'est_complet_incoherent', serie, niveau, code_zone, culture, campagne_agricole
from s
where serie = 'DAPSA' and niveau <> 'DEPARTEMENT'
  and est_complet <> (nb_departements_observes = nb_departements_attendus and production_t is not null)

union all

-- 7. riz : total région et pays arrêté en 2020
select 'riz_2021_agrege_non_null', serie, niveau, code_zone, culture, campagne_agricole
from s
where serie = 'DAPSA' and niveau <> 'DEPARTEMENT' and culture = 'RIZ (IRRIGUÉ)' and campagne_agricole >= 2021
  and (production_t is not null or superficie_ha is not null or rendement_kg_ha is not null or est_complet)

union all

-- 8. somme des départements attendus = total région ; somme des régions = total pays
select 'somme_region_incoherente', 'DAPSA', 'REGION', r.code_zone, r.culture, r.campagne_agricole
from s r
join (
    select d.code_region, d.culture, d.campagne_agricole,
           sum(d.production_t) as p, sum(d.superficie_ha) as a
    from s d
    join {{ ref('ref_departements_attendus') }} at
      on at.culture = d.culture and at.code_departement = d.code_zone
    where d.niveau = 'DEPARTEMENT' and d.nb_departements_observes = 1
    group by d.code_region, d.culture, d.campagne_agricole
) x on x.code_region = r.code_zone and x.culture = r.culture and x.campagne_agricole = r.campagne_agricole
where r.niveau = 'REGION' and r.production_t is not null
  and (abs(r.production_t - x.p) > 0.001 or abs(r.superficie_ha - x.a) > 0.001)

union all

select 'somme_pays_incoherente', 'DAPSA', 'PAYS', p.code_zone, p.culture, p.campagne_agricole
from s p
join (
    select culture, campagne_agricole, sum(production_t) as pr, sum(superficie_ha) as a
    from s where niveau = 'REGION' and production_t is not null
    group by culture, campagne_agricole
) x on x.culture = p.culture and x.campagne_agricole = p.campagne_agricole
where p.niveau = 'PAYS' and p.serie = 'DAPSA' and p.production_t is not null
  and (abs(p.production_t - x.pr) > 0.001 or abs(p.superficie_ha - x.a) > 0.001)
