-- Contrôles du seed ref_prix_intrants. Le test échoue s'il renvoie au moins une ligne.

with prix as (
    select * from {{ ref('ref_prix_intrants') }}
)

-- Clé (code_intrant, campagne) unique
select code_intrant || '|' || campagne as cle, 'clé dupliquée' as anomalie
from prix
group by code_intrant, campagne
having count(*) > 1

union all

-- Coût réel = prix de cession + subvention / 20 sacs par tonne, à 1 FCFA près
select code_intrant || '|' || campagne, 'coût réel différent de cession + subvention / 20'
from prix
where abs(cout_reel_sac_50kg_fcfa - (prix_cession_sac_50kg_fcfa + subvention_tonne_fcfa / 20)) > 1

union all

-- A_SAISIR : aucune valeur (jamais 0 à la place) ; sinon les trois valeurs renseignées
select code_intrant || '|' || campagne, 'valeurs incohérentes avec le statut'
from prix
where (statut_validation = 'A_SAISIR'
       and coalesce(prix_cession_sac_50kg_fcfa, subvention_tonne_fcfa, cout_reel_sac_50kg_fcfa) is not null)
   or (statut_validation <> 'A_SAISIR'
       and (prix_cession_sac_50kg_fcfa is null or subvention_tonne_fcfa is null or cout_reel_sac_50kg_fcfa is null))
