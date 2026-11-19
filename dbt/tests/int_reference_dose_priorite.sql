-- Règle de priorité des doses (int_reference_dose). Le test échoue s'il renvoie au moins une ligne.
--   - une seule source retenue par zone x culture x groupe (on ne mélange jamais deux formules) ;
--   - exactement une ligne retenue par zone x culture x intrant quand la source retenue a cette dose ;
--   - groupes retenus = groupes ayant au moins une dose dans les entrées (contrôle indépendant du modèle) ;
--   - aucune source retenue n'a un rang moins bon qu'une source candidate ;
--   - contrôles métier : mil en Casamance = Tounkara 2022, ailleurs PIA ; riz dans la Vallée
--     = Faye 2020 (engrais et semences), ailleurs PIA ; cultures sans dose : rien de retenu.

with d as (
    select *, upper(trim(culture)) as culture_cle, upper(trim(zone_application)) as zone_cle
    from {{ ref('int_reference_dose') }}
),

retenu as (
    select * from d where est_retenue
)

select zone_cle || '|' || culture_cle || '|' || groupe_dose as cle, 'plusieurs sources retenues pour un groupe' as anomalie
from retenu
group by zone_cle, culture_cle, groupe_dose
having count(distinct source_reference) > 1

union all

-- Exactement une ligne retenue par zone x culture x intrant de la source retenue du groupe
-- (doublon de la source => 2 ; ligne de la source perdue ou mal marquée => 0) ; aucune ligne
-- retenue pour un intrant absent de la source retenue
select s.zone_cle || '|' || s.culture_cle || '|' || s.code_intrant, 'pas exactement une ligne retenue par intrant'
from (
    select d.zone_cle, d.culture_cle, d.code_intrant,
           count_if(d.source_reference = g.source_reference) as nb_lignes_source_retenue,
           count_if(d.est_retenue) as nb_retenues
    from d
    left join (select distinct zone_cle, culture_cle, groupe_dose, source_reference from retenu) g
        on g.zone_cle = d.zone_cle and g.culture_cle = d.culture_cle and g.groupe_dose = d.groupe_dose
    group by d.zone_cle, d.culture_cle, d.code_intrant
) s
where (s.nb_lignes_source_retenue > 0 and s.nb_retenues <> 1)
   or (s.nb_lignes_source_retenue = 0 and s.nb_retenues <> 0)

union all

-- Groupes attendus d'après les ENTRÉES (stg_besoins_hectare, seed ref_doses_pia : au moins
-- une dose non nulle) comparés aux groupes ayant une source retenue : tout écart échoue
-- (groupe avec dose mais rien de retenu, ou source retenue sans dose en entrée)
select coalesce(a.zone_cle, r.zone_cle) || '|' || coalesce(a.culture_cle, r.culture_cle) || '|'
       || coalesce(a.groupe_dose, r.groupe_dose),
       iff(r.zone_cle is null, 'groupe avec dose sans source retenue', 'source retenue sans dose en entrée')
from (
    select upper(trim(zone_agroecologique)) as zone_cle, upper(trim(culture)) as culture_cle, 'ENGRAIS' as groupe_dose
    from {{ ref('stg_besoins_hectare') }}
    where zone_agroecologique is not null and culture is not null
      and coalesce(npk_15_15_15_kg_ha, uree_kg_ha, dap_kg_ha, fumier_t_ha, dose_n_recommandee_kg_ha,
                   dose_p2o5_recommandee_kg_ha, dose_k2o_recommandee_kg_ha) is not null
    union
    select upper(trim(zone_agroecologique)), upper(trim(culture)), 'SEMENCES'
    from {{ ref('stg_besoins_hectare') }}
    where zone_agroecologique is not null and culture is not null and dose_semis_kg_ha is not null
    union
    select upper(trim(zone_agroecologique)), upper(trim(culture)), 'EAU'
    from {{ ref('stg_besoins_hectare') }}
    where zone_agroecologique is not null and culture is not null and volume_irrigation_m3_ha is not null
    union
    select z.zone_cle, upper(trim(p.culture)),
           case when upper(trim(p.code_intrant)) = 'SEMENCES' then 'SEMENCES'
                when upper(trim(p.type_intrant)) = 'EAU' then 'EAU' else 'ENGRAIS' end
    from {{ ref('ref_doses_pia') }} p
    join (select distinct upper(trim(zone_agroecologique)) as zone_cle
          from {{ ref('stg_besoins_hectare') }} where zone_agroecologique is not null) z
        on nullif(trim(p.zone_agroecologique), '') is null or upper(trim(p.zone_agroecologique)) = z.zone_cle
    where p.dose is not null
) a
full outer join (select distinct zone_cle, culture_cle, groupe_dose from retenu) r
    on r.zone_cle = a.zone_cle and r.culture_cle = a.culture_cle and r.groupe_dose = a.groupe_dose
where a.zone_cle is null or r.zone_cle is null

union all

-- Une source candidate de meilleur rang que la source retenue
select c.zone_cle || '|' || c.culture_cle || '|' || c.groupe_dose, 'source de meilleur rang non retenue'
from d c
join retenu r
    on r.zone_cle = c.zone_cle and r.culture_cle = c.culture_cle and r.groupe_dose = c.groupe_dose
where c.rang_priorite < r.rang_priorite

union all

-- Contrôles métier
select zone_cle || '|' || culture_cle || '|' || groupe_dose, 'source retenue inattendue'
from retenu
where groupe_dose in ('ENGRAIS', 'SEMENCES')
  and (
       (culture_cle = 'MIL (SOUNA)' and groupe_dose = 'ENGRAIS' and zone_cle = 'CASAMANCE'
            and source_reference <> 'Tounkara et al. (2022)')
    or (culture_cle = 'MIL (SOUNA)' and zone_cle <> 'CASAMANCE' and source_reference not ilike 'IFDC-CORAF%')
    or (culture_cle = 'RIZ (IRRIGUÉ)' and zone_cle = 'VALLÉE DU FLEUVE SÉNÉGAL'
            and source_reference <> 'Faye et al. (2020)')
    or (culture_cle = 'RIZ (IRRIGUÉ)' and zone_cle <> 'VALLÉE DU FLEUVE SÉNÉGAL'
            and source_reference not ilike 'IFDC-CORAF%')
    or culture_cle in ('SÉSAME', 'COTON', 'MANIOC', 'OIGNON', 'TOMATE', 'PASTÈQUE')
  )
