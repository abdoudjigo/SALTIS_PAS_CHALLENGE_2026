-- Contrôles de cohérence de l'adéquation des cultures et des variétés.
-- Le test échoue s'il renvoie au moins une ligne.
--
-- Seuils du niveau, tels qu'appliqués par la source sur le score arrondi :
--   adaptée > 80 ; à risque > 50 et <= 80 ; déconseillée <= 50.

with culture as (

    select *
    from {{ ref('fact_adequation_culture') }}

),

variete as (

    select *
    from {{ ref('fact_adequation_variete') }}

)

-- Grain
select max(id_adequation_culture) as id, 'grain culture dupliqué' as anomalie
from culture
group by id_departement, id_culture, classe_cycle
having count(*) > 1

union all

select max(id_adequation_variete), 'grain variété dupliqué'
from variete
group by id_departement, id_variete
having count(*) > 1

union all

-- Probabilités et score entre 0 et 100
select id_adequation_culture, 'probabilité ou score hors de [0, 100]'
from culture
where proba_cycle_couvert_pct not between 0 and 100
   or proba_besoin_eau_couvert_pct not between 0 and 100
   or score_adequation not between 0 and 100

union all

select id_adequation_variete, 'probabilité hors de [0, 100]'
from variete
where proba_cycle_couvert_pct not between 0 and 100

union all

-- Score nul uniquement pour 'irrigation requise' et 'non évaluée'
select id_adequation_culture, 'score nul pour un niveau évalué, ou renseigné pour un niveau non évalué'
from culture
where (score_adequation is null)
   <> (niveau_adequation in ('irrigation requise', 'non évaluée (culture pluriannuelle)'))

union all

-- id_culture du fait égal à celui de dim_variete pour la même variété
select variete.id_adequation_variete, 'id_culture différent de dim_variete'
from variete
join {{ ref('dim_variete') }} dv
    on dv.id_variete = variete.id_variete
where dv.id_culture <> variete.id_culture

union all

-- Niveau cohérent avec le score
select id_adequation_culture, 'niveau incohérent avec le score'
from culture
where score_adequation is not null
  and niveau_adequation <> case
        when score_adequation > 80 then 'adaptée'
        when score_adequation > 50 then 'à risque'
        else 'déconseillée'
      end
