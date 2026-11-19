-- Les quantités ne doivent jamais être négatives,
-- et une ligne marquée non observée ne doit porter aucune mesure.

select
    id_rendement,
    superficie_ha,
    production_t,
    rendement_kg_ha,
    est_observe
from {{ ref('fact_rendement_departement') }}
where superficie_ha < 0
   or production_t < 0
   or rendement_kg_ha < 0
   or (
        not est_observe
        and (superficie_ha is not null
             or production_t is not null
             or rendement_kg_ha is not null)
      )