-- Contrôles de cohérence des facteurs limitants.
-- Le test échoue s'il renvoie au moins une ligne.

with fait as (

    select *
    from {{ ref('fact_facteurs_limitants') }}

)

-- Grain : une ligne par zone et culture
select max(id_facteur_limitant) as id, 'grain dupliqué' as anomalie
from fait
group by id_zone_agroecologique, id_culture
having count(*) > 1

union all

-- Corrélations entre -1 et 1
select id_facteur_limitant, 'corrélation hors de [-1, 1]'
from fait
where correlation_eau not between -1 and 1
   or correlation_sequence_seche not between -1 and 1
   or correlation_chaleur not between -1 and 1
   or correlation_demarrage_tardif not between -1 and 1

union all

-- Écart = atteignable - moyen (tolérance d'arrondi)
select id_facteur_limitant, 'écart différent de atteignable - moyen'
from fait
where abs(ecart_rendement_kg_ha - (rendement_atteignable_kg_ha - rendement_moyen_kg_ha)) > 0.05

union all

-- Rendements jamais négatifs
select id_facteur_limitant, 'rendement négatif'
from fait
where rendement_moyen_kg_ha < 0
   or rendement_atteignable_kg_ha < 0
