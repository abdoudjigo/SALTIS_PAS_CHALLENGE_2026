{{
    config(materialized='table')
}}

-- Objectifs et chiffres officiels de l'Observatoire (SSA 2025-2034, LPSAE 2025-2029), une ligne par valeur et par document.
-- Lecture directe du seed ref_objectifs_souverainete : aucune valeur ajoutée, vide = NULL (« non disponible »).
-- Les contradictions entre documents restent côte à côte (deux lignes, avec leur note).

select
    indicateur,
    perimetre,
    nullif(trim(culture), '') as culture,
    nullif(trim(cultures_concernees), '') as cultures_concernees,
    nullif(trim(unite), '') as unite,
    valeur_reference,
    annee_reference,
    cible,
    annee_cible,
    document,
    page,
    nullif(trim(url), '') as url,
    nullif(trim(note), '') as note
from {{ ref('ref_objectifs_souverainete') }}
