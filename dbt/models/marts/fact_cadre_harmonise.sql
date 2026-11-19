{{ config(materialized='table') }}

-- Cadre harmonisé (CILSS / IPC) par département du projet.
-- Grain : département (GADM) × cycle (annee_cycle, code_cycle) × type de période (current / projected).
--
-- Fusion Keur Massar (décision de l'équipe) : Keur Massar, créé en 2021 par division de Pikine, n'existe pas
-- dans GADM 4.1 ; Pikine GADM couvre son territoire. Ses effectifs (population, phases 1 à 5, phases 3 à 5)
-- sont ajoutés à ceux de Pikine ; la phase retenue est la plus haute des deux (idem pour les phases des
-- résultats). fusion_keur_massar = vrai pour ces lignes. Une somme n'est faite que si toutes les lignes
-- fusionnées ont la valeur : sinon NULL, jamais une somme partielle.
--
-- Effectifs en personnes, additifs entre départements d'un même cycle et type de période seulement :
-- ne jamais additionner des cycles ou des types de période différents (mêmes personnes comptées plusieurs fois).
-- Phases : non additives.

{% set effectifs = ['population', 'population_phase1', 'population_phase2', 'population_phase3',
                    'population_phase4', 'population_phase5', 'population_phase3_5'] %}
{% set phases = ['phase_class', 'phase_consommation_alimentaire', 'phase_moyens_existence', 'phase_nutrition'] %}

with stg as (

    select * from {{ ref('stg_cadre_harmonise') }}

)

select
    {{ cle_departement('code_departement') }} as id_departement,
    code_departement,
    max(departement) as departement,
    annee_cycle,
    code_cycle,
    max(libelle_cycle) as libelle_cycle,
    max(ordre_cycle) as ordre_cycle,
    type_periode,
    max(libelle_periode_reference) as libelle_periode_reference,
    max(annee_periode_reference) as annee_periode_reference,
    max(date_debut_periode) as date_debut_periode,
    max(date_fin_periode) as date_fin_periode,
    -- identique pour les lignes fusionnées (testé)
    booland_agg(periode_a_utiliser) as periode_a_utiliser,
    {% for c in effectifs %}
    iff(count({{ c }}) = count(*), sum({{ c }}), null) as {{ c }},
    {% endfor %}
    {% for c in phases %}
    max({{ c }}) as {{ c }},
    {% endfor %}
    count(*) as nb_lignes_source,
    boolor_agg(lower(nom_departement_source) = 'keur massar') as fusion_keur_massar,
    listagg(distinct nom_departement_source, ', ') within group (order by nom_departement_source) as departements_source,
    max(source) as source
from stg
group by code_departement, annee_cycle, code_cycle, type_periode
