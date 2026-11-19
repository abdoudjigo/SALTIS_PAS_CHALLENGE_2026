-- Règles de la carte des opportunités. Le test échoue s'il renvoie au moins une ligne.
--   - 45 départements ;
--   - couche_eau ⇔ couleur_carte = 'bleu', et rang_opportunite_eau seulement dans la couche bleue ;
--   - couleur_fond cohérente avec classe_saison_pluie ;
--   - potentiel_contre_saison_ha seulement pour 'eau de surface peu exploitée', jamais négatif ;
--   - pourcentages entre 0 et 100, terres nues proches de l'eau <= terres cultivables proches de l'eau ;
--   - un conseil investisseur dès qu'une catégorie d'eau est évaluée (sauf « pas d'eau »).

with m as (

    select * from {{ ref('mart_carte_opportunites') }}

)

select to_varchar(count(*)) as code, 'nombre de départements différent de 45' as anomalie
from m
having count(*) <> 45

union all

select code_departement, 'couche_eau et couleur_carte incohérentes'
from m
where couche_eau <> (couleur_carte = 'bleu') or (couleur_carte is null and couche_eau)

union all

select code_departement, 'rang_opportunite_eau hors couche bleue'
from m
where (rang_opportunite_eau is not null) <> couche_eau

union all

select code_departement, 'couleur_fond incohérente avec classe_saison_pluie'
from m
where (classe_saison_pluie = 'longue' and couleur_fond <> 'vert')
   or (classe_saison_pluie = 'courte' and couleur_fond <> 'jaune')
   or (classe_saison_pluie = 'non évaluée' and couleur_fond is not null)

union all

select code_departement, 'potentiel_contre_saison_ha incohérent'
from m
where (potentiel_contre_saison_ha is not null) <> (categorie_eau = 'eau de surface peu exploitée')
   or potentiel_contre_saison_ha < 0

union all

select code_departement, 'pourcentage hors de 0-100'
from m
where part_proche_eau_exploitee_pct not between 0 and 100
   or part_nappe_accessible_pct not between 0 and 100

union all

select code_departement, 'terres nues proches de l''eau > terres cultivables proches de l''eau'
from m
where surface_proche_eau_inexploitee_ha > surface_proche_eau_cultivable_ha + 1

union all

select code_departement, 'conseil investisseur manquant'
from m
where categorie_eau in ('eau de surface peu exploitée', 'nappe accessible', 'eau de surface déjà exploitée')
  and conseil_investisseur is null
