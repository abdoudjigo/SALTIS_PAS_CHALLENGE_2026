-- Une ligne par valeur et par document : la clé est unique, document et page sont renseignés,
-- aucune valeur n'est négative.

select 'doublon' as probleme, indicateur, culture, annee_reference, annee_cible, document, page
from {{ ref('ref_objectifs_souverainete') }}
group by indicateur, culture, annee_reference, annee_cible, document, page
having count(*) > 1

union all

select 'document_ou_page_vide', indicateur, culture, annee_reference, annee_cible, document, page
from {{ ref('ref_objectifs_souverainete') }}
where trim(coalesce(document, '')) = '' or trim(coalesce(page, '')) = ''

union all

select 'valeur_negative', indicateur, culture, annee_reference, annee_cible, document, page
from {{ ref('ref_objectifs_souverainete') }}
where valeur_reference < 0 or cible < 0
