-- Contrôles de cohérence des besoins de référence (historiques, pas prévisionnels).
-- Le test échoue s'il renvoie au moins une ligne.

with fait as (

    select *
    from {{ ref('fact_besoin_reference') }}

),

-- Doses de référence de la zone du département (sources actuelles uniquement)
doses as (

    select
        g.id_departement,
        r.id_culture,
        max(iff(r.code_intrant = 'N', r.dose, null)) as dose_n,
        max(iff(r.code_intrant = 'SEMENCES', r.dose, null)) as dose_semences
    from {{ ref('fact_reference_agronomique') }} r
    join {{ ref('dim_geographie') }} g
        on g.id_zone_agroecologique = r.id_zone_agroecologique
    where r.source_reference not ilike 'ISRA%'
    group by 1, 2

)

-- Grain
select max(id_besoin_reference) as id, 'grain dupliqué' as anomalie
from fait
group by id_departement, id_culture
having count(*) > 1

union all

-- Jamais de besoin ni de superficie négatifs
select id_besoin_reference, 'valeur négative'
from fait
where superficie_reference_ha < 0
   or least(
        coalesce(besoin_azote_n_t, 0), coalesce(besoin_phosphate_p2o5_t, 0), coalesce(besoin_potasse_k2o_t, 0),
        coalesce(besoin_npk_15_15_15_t, 0), coalesce(besoin_uree_t, 0), coalesce(besoin_dap_t, 0),
        coalesce(besoin_fumier_t, 0), coalesce(besoin_semences_t, 0)
      ) < 0

union all

-- Besoin en engrais nul (inconnu) si et seulement si la dose est à compléter
select id_besoin_reference, 'besoin engrais incohérent avec le statut'
from fait
where (besoin_azote_n_t is null) <> (statut_validation_engrais = 'A_COMPLETER')

union all

select id_besoin_reference, 'besoin semences incohérent avec le statut'
from fait
where (besoin_semences_t is null) <> (statut_validation_semis = 'A_COMPLETER')

union all

-- Besoin = superficie x dose de référence de la zone (fact_reference_agronomique)
select f.id_besoin_reference, 'besoin différent de superficie x dose de référence'
from fait f
join doses d
    on d.id_departement = f.id_departement
   and d.id_culture = f.id_culture
where (f.besoin_azote_n_t is not null
       and abs(f.besoin_azote_n_t - f.superficie_reference_ha * d.dose_n / 1000) > 0.05)
   or (f.besoin_semences_t is not null
       and abs(f.besoin_semences_t - f.superficie_reference_ha * d.dose_semences / 1000) > 0.05)
