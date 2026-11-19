-- Contrôles de cohérence des références agronomiques.
-- Le test échoue s'il renvoie au moins une ligne.

with fait as (

    select *
    from {{ ref('fact_reference_agronomique') }}

)

-- Grain : zone (ou national) x culture x intrant x source_reference
select max(id_reference_agronomique) as id, 'grain dupliqué' as anomalie
from fait
group by coalesce(id_zone_agroecologique, 'NATIONAL'), id_culture, code_intrant, source_reference
having count(*) > 1

union all

-- Garde-fou des agrégations : un code_intrant a un seul type et une seule unité.
-- On ne somme que par code_intrant (et unité), jamais entre types (PRODUIT, ELEMENT, EAU).
select code_intrant, 'code_intrant avec plusieurs types ou unités : agrégation impossible'
from fait
group by code_intrant
having count(distinct type_intrant) > 1
    or count(distinct unite) > 1

union all

-- Portée cohérente avec la zone
select id_reference_agronomique, 'portée incohérente avec la zone'
from fait
where (portee_geographique = 'NATIONAL') <> (id_zone_agroecologique is null)

union all

-- Doses jamais négatives (0 autorisé : besoin nul)
select id_reference_agronomique, 'dose négative'
from fait
where dose < 0
   or besoin_eau_mm < 0

union all

-- Une ligne existe seulement pour une dose chiffrée : jamais A_COMPLETER
select id_reference_agronomique, 'ligne A_COMPLETER : une dose inconnue ne doit pas donner de ligne'
from fait
where statut_validation = 'A_COMPLETER'

union all

-- VALIDEE seulement pour une dose reçue d'un spécialiste (date de réception connue)
select id_reference_agronomique, 'dose VALIDEE sans date de réception'
from fait
where statut_validation = 'VALIDEE'
  and date_reception is null

union all

-- Eau : besoin en mm renseigné, volume = besoin x 10 / 0,6 (efficience 60 %)
select id_reference_agronomique, 'irrigation incohérente (besoin manquant ou volume différent)'
from fait
where code_intrant = 'EAU_IRRIGATION'
  and (besoin_eau_mm is null
       or abs(dose - besoin_eau_mm * 10 / 0.6) > 1)

union all

-- besoin_eau_mm réservé à l'eau
select id_reference_agronomique, 'besoin_eau_mm renseigné hors irrigation'
from fait
where type_intrant <> 'EAU'
  and besoin_eau_mm is not null

union all

-- Dose dans la fourchette quand elle est donnée (PIA)
select id_reference_agronomique, 'dose hors de la fourchette dose_min - dose_max'
from fait
where dose < dose_min
   or dose > dose_max

union all

-- dose_retenue cohérente avec le nombre de zones où la dose est retenue
select id_reference_agronomique, 'dose_retenue incohérente avec nb_zones_retenue'
from fait
where dose_retenue <> (nb_zones_retenue > 0)
   or (portee_geographique = 'ZONE' and nb_zones_retenue > 1)
