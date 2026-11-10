-- Contrôles de cohérence de la saison.
-- Le test échoue s'il renvoie au moins une ligne.

select
    id_saison,
    pluie_saison_mm,
    debut_saison_jour,
    fin_saison_jour,
    duree_saison_j,
    plus_longue_sequence_seche_j
from {{ ref('fact_saison_departement') }}
where pluie_saison_mm < 0
   or duree_saison_j < 0
   or plus_longue_sequence_seche_j < 0
   or nb_jours_pluie < 0
   or (debut_saison_jour is not null
       and fin_saison_jour is not null
       and fin_saison_jour < debut_saison_jour)