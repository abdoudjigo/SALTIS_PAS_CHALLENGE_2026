-- Contrôles du score de vulnérabilité (méthode v1).
-- Le test échoue s'il renvoie au moins une ligne.

with m as (

    select *
    from {{ ref('mart_vulnerabilite_departement') }}

)

-- 45 départements, comme dim_geographie
select to_varchar(count(*)) as cle, 'nombre de départements différent de dim_geographie' as anomalie
from m
having count(*) <> (select count(*) from {{ ref('dim_geographie') }})

union all

-- Scores et rangs entre 0 et 100
select code_departement, 'score ou rang hors de [0, 100]'
from m
where score_vulnerabilite not between 0 and 100
   or score_alea_secheresse not between 0 and 100
   or score_sensibilite_rendement not between 0 and 100
   or least(rang_alerte_secheresse, rang_variabilite_pluie, rang_pluie_annee_seche) < 0
   or greatest(rang_alerte_secheresse, rang_variabilite_pluie, rang_pluie_annee_seche) > 100

union all

-- Recalcul : aléa = moyenne des 3 rangs ; sensibilité = 0,7 / 0,3 ; score = 0,6 / 0,4
select code_departement, 'score différent de la méthode v1'
from m
where abs(score_alea_secheresse - (rang_alerte_secheresse + rang_variabilite_pluie + rang_pluie_annee_seche) / 3) > 0.2
   or abs(score_sensibilite_rendement - (0.7 * rang_variabilite_rendement + 0.3 * rang_tendance_rendement)) > 0.2
   or abs(score_vulnerabilite - (0.6 * score_alea_secheresse + 0.4 * score_sensibilite_rendement)) > 0.2

union all

-- Score NULL si et seulement si une dimension manque ; jamais remplacé par 0
select code_departement, 'score NULL incohérent avec les dimensions disponibles'
from m
where (score_vulnerabilite is null) <> (nb_dimensions_disponibles < 2)
   or (score_vulnerabilite is null) <> (classe_vulnerabilite is null)
   or (score_vulnerabilite is null) <> (rang_vulnerabilite is null)

union all

-- Classes par quintiles : chaque classe regroupe 8 ou 9 départements (sur 43 notés)
select classe_vulnerabilite, 'quintile déséquilibré'
from m
where classe_vulnerabilite is not null
group by classe_vulnerabilite
having count(*) not between
    floor((select count(score_vulnerabilite) from m) / 5)
    and ceil((select count(score_vulnerabilite) from m) / 5)

union all

-- Confiance : faible si moins de 3 cultures ou moins de 15 campagnes observées
-- (couples culture x campagne)
select code_departement, 'confiance_rendement incohérente'
from m
where nb_cultures_rendement is not null
  and (confiance_rendement = 'faible') <> (nb_cultures_rendement < 3 or nb_campagnes_rendement < 15)

union all

-- Confiance faible : sensibilité, rangs de rendement et score NULL, aléa toujours affiché
select code_departement, 'confiance faible avec une sensibilité ou un score renseigné'
from m
where confiance_rendement = 'faible'
  and (score_sensibilite_rendement is not null
       or rang_variabilite_rendement is not null
       or rang_tendance_rendement is not null
       or score_vulnerabilite is not null
       or score_alea_secheresse is null)
