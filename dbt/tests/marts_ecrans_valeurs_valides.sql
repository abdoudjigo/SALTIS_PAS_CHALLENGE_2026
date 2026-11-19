-- Contrôles des marts par écran (B2).
-- Le test échoue s'il renvoie au moins une ligne.

-- mart_carte_agroclimat : grain, volume, règle risque_saison
select code_departement || '|' || to_varchar(campagne_agricole) as cle, 'carte : grain dupliqué' as anomalie
from {{ ref('mart_carte_agroclimat') }}
group by code_departement, campagne_agricole
having count(*) > 1

union all

select to_varchar(count(*)), 'carte : volume différent de fact_saison_departement'
from {{ ref('mart_carte_agroclimat') }}
having count(*) <> (select count(*) from {{ ref('fact_saison_departement') }})

union all

select code_departement || '|' || to_varchar(campagne_agricole), 'carte : risque_saison incohérent avec les alertes'
from {{ ref('mart_carte_agroclimat') }}
where risque_saison <> case
        when alerte_secheresse and alerte_exces_pluie then 'sécheresse et excès de pluie'
        when alerte_secheresse then 'sécheresse'
        when alerte_exces_pluie then 'excès de pluie'
        else 'normal'
      end

union all

-- mart_suivi_decadaire : grain, volume, écarts
select code_departement || '|' || to_varchar(annee) || '|' || to_varchar(numero_decade_annee), 'suivi : grain dupliqué'
from {{ ref('mart_suivi_decadaire') }}
group by code_departement, annee, numero_decade_annee
having count(*) > 1

union all

select to_varchar(count(*)), 'suivi : volume différent de fact_pluviometrie_decadaire'
from {{ ref('mart_suivi_decadaire') }}
having count(*) <> (select count(*) from {{ ref('fact_pluviometrie_decadaire') }})

union all

select code_departement || '|' || to_varchar(annee) || '|' || to_varchar(numero_decade_annee), 'suivi : écart différent de observé - normale'
from {{ ref('mart_suivi_decadaire') }}
where abs(ecart_pluie_mm - (pluie_mm - pluie_normale_mm)) > 0.001
   or abs(ecart_cumul_normale_mm - (cumul_depuis_juin_mm - cumul_normale_depuis_juin_mm)) > 0.001

union all

-- mart_choix_cultures : unicité département x culture x type_option x option ; colonnes par type
select code_departement || '|' || culture || '|' || type_option || '|' || option, 'choix : grain dupliqué'
from {{ ref('mart_choix_cultures') }}
group by code_departement, culture, type_option, option
having count(*) > 1

union all

select code_departement || '|' || culture || '|' || option, 'choix : colonne propre à un autre type renseignée'
from {{ ref('mart_choix_cultures') }}
where (type_option = 'VARIETE' and (score_adequation is not null or proba_besoin_eau_couvert_pct is not null or note_score is not null
                                   or score_adequation_source is not null or proba_besoin_eau_couvert_pct_source is not null
                                   or nb_annees_calc is not null))
   or (type_option = 'CYCLE' and (tolerance_secheresse is not null or disponibilite_semences is not null or zones_recommandees is not null))

union all

select code_departement || '|' || culture || '|' || option, 'choix : rang incohérent avec la probabilité'
from {{ ref('mart_choix_cultures') }}
where (rang_option is null) <> (proba_cycle_couvert_pct is null)

union all

-- mart_besoins : 45 départements, grain, semences retenues, irrigation
select to_varchar(count(distinct code_departement)), 'besoins : les 45 départements doivent apparaître'
from {{ ref('mart_besoins') }}
having count(distinct code_departement) <> (select count(*) from {{ ref('dim_geographie') }})

union all

select code_departement || '|' || coalesce(culture, '-'), 'besoins : grain dupliqué'
from {{ ref('mart_besoins') }}
group by code_departement, culture
having count(*) > 1

union all

select code_departement || '|' || coalesce(culture, '-'), 'besoins : semences retenues incohérentes'
from {{ ref('mart_besoins') }}
where culture is not null
  and ((not besoin_semences_applicable and besoin_semences_retenu_t is not null)
       or (besoin_semences_applicable and coalesce(besoin_semences_retenu_t, -1) <> coalesce(besoin_semences_t, -1)))

union all

select code_departement || '|' || coalesce(culture, '-'), 'besoins : irrigation totale hors irrigation requise'
from {{ ref('mart_besoins') }}
where (not irrigation_requise and irrigation_totale_m3 is not null)
   or (irrigation_requise and abs(irrigation_totale_m3 - superficie_reference_ha * volume_irrigation_m3_ha) > 0.01)

union all

select code_departement, 'besoins : département sans culture sans message'
from {{ ref('mart_besoins') }}
where (culture is null) <> (message_departement is not null)

union all

-- mart_territoires_agrodistrib : grain, superficie > 0, potentiel non évalué
select code_departement || '|' || culture, 'agrodistrib : grain dupliqué'
from {{ ref('mart_territoires_agrodistrib') }}
group by code_departement, culture
having count(*) > 1

union all

select code_departement || '|' || culture, 'agrodistrib : superficie de référence nulle ou absente'
from {{ ref('mart_territoires_agrodistrib') }}
where not (superficie_reference_ha > 0)

union all

select code_departement || '|' || culture, 'agrodistrib : potentiel renseigné alors que non évalué'
from {{ ref('mart_territoires_agrodistrib') }}
where (not potentiel_evalue and potentiel_gain_kg_ha is not null)
   or (potentiel_evalue and coalesce(potentiel_gain_kg_ha, -1e9) <> coalesce(ecart_rendement_kg_ha, -1e9))
