{{
    config(materialized='table')
}}

-- Besoins de référence HISTORIQUES, PAS PRÉVISIONNELS (règle 7).
-- Grain : un département, une culture. 367 lignes, 43 départements.
-- Besoin (t) = superficie_reference_ha x dose RETENUE de la zone / 1000 (fumier : t/ha, donc
-- sans division). Calculé dans dbt depuis int_reference_dose (une source par zone x culture
-- pour la formule d'engrais, une pour les semences ; priorité : recherche propre à la zone,
-- puis PIA national, puis doses NON_VERIFIEE). Les besoins calculés par la source
-- (c_besoins_departement) ne sont plus repris.
--
-- superficie_reference_ha : moyenne des dernières campagnes connues (annees_reference),
-- superficie semée ou récoltée selon type_superficie (de 2003-2004 à 2019-2021).
--
-- Règle NULL / 0 (décision du 19/11/2026) :
--   - culture sans formule d'engrais retenue dans la zone (sésame, coton, manioc, oignon,
--     tomate, pastèque…) -> besoins en produits et éléments NULL (« dose à saisir »), jamais 0 ;
--   - formule retenue : un produit engrais (NPK 15-15-15, 15-10-10, 6-20-10, urée, DAP) absent
--     de la formule -> besoin 0 (« pas dans la formule ») ; dose à 0 -> besoin 0 ;
--     superficie à 0 -> besoin 0. Le phosphate de fond (400 kg/ha tous les 3 ans des fiches PIA)
--     est volontairement exclu du besoin annuel ;
--   - fumier : besoin_fumier_t toujours NULL (« non chiffré : fumure organique conseillée si
--     possible »), jamais additionné ; la dose reste dans fact_reference_agronomique (conseil) ;
--   - a_formule_engrais_retenue : vrai si une formule d'engrais est retenue pour la zone x culture ;
--   - phosphate_fond_exclu : la formule retenue cite un phosphate de fond de 400 kg/ha tous les 3 ans,
--     non compté dans le besoin annuel (note_source des fiches PIA) ;
--   - statut_validation_* et source_reference_* : ceux de la source retenue ; sans dose,
--     statut issu du texte de la source (macros/statuts_doses.sql), A_COMPLETER.
-- besoin_semences_applicable : faux seulement si la dose de semis retenue est la dose de
-- repiquage irrigué (Faye 2020) appliquée hors de sa zone (riz pluvial). Avec la dose PIA du
-- riz pluvial (60 kg/ha hors Vallée), aucune ligne n'est concernée aujourd'hui.
--
-- Exclu : doses par hectare (références de ZONE : voir fact_reference_agronomique).

{% set besoins = [
    ('besoin_azote_n_t',        'N',            1000),
    ('besoin_phosphate_p2o5_t', 'P2O5',         1000),
    ('besoin_potasse_k2o_t',    'K2O',          1000),
    ('besoin_npk_15_15_15_t',   'NPK_15_15_15', 1000),
    ('besoin_npk_15_10_10_t',   'NPK_15_10_10', 1000),
    ('besoin_npk_6_20_10_t',    'NPK_6_20_10',  1000),
    ('besoin_uree_t',           'UREE',         1000),
    ('besoin_dap_t',            'DAP_18_46_0',  1000),
    ('besoin_fumier_t',         'FUMIER',       1),
    ('besoin_semences_t',       'SEMENCES',     1000),
] %}
{# Produits engrais : 0 quand ils sont absents d'une formule retenue #}
{% set produits_formule = ['NPK_15_15_15', 'NPK_15_10_10', 'NPK_6_20_10', 'UREE', 'DAP_18_46_0'] %}

with source as (

    select *
    from {{ ref('int_reference_besoins_departement_culture') }}
    where code_departement is not null
      and culture is not null

),

doses as (

    select
        upper(trim(zone_application)) as zone_cle,
        upper(trim(culture)) as culture_cle,
        {% for colonne, code, diviseur in besoins %}
        max(iff(code_intrant = '{{ code }}', dose, null)) as dose_{{ code | lower }},
        {% endfor %}
        max(iff(groupe_dose = 'ENGRAIS', statut_validation, null)) as statut_engrais,
        max(iff(groupe_dose = 'ENGRAIS', source_reference, null)) as source_engrais,
        max(iff(groupe_dose = 'SEMENCES', statut_validation, null)) as statut_semis,
        max(iff(groupe_dose = 'SEMENCES', source_reference, null)) as source_semis,
        -- fiches PIA : « phosphate … 400 kg/ha tous les 3 ans non compté » (fumure de fond)
        boolor_agg(groupe_dose = 'ENGRAIS' and note_source ilike '%400 kg/ha tous les 3 ans%') as phosphate_fond_exclu
    from {{ ref('int_reference_dose') }}
    where est_retenue
      and groupe_dose in ('ENGRAIS', 'SEMENCES')
    group by 1, 2

)

select
    md5(trim(s.code_departement) || '|' || upper(trim(s.culture))) as id_besoin_reference,

    -- Clés vers les dimensions
    {{ cle_departement('s.code_departement') }} as id_departement,
    {{ cle_culture('s.culture') }} as id_culture,

    -- Superficie de référence
    s.superficie_reference_ha,
    trim(s.annees_reference) as annees_reference,
    trim(s.type_superficie) as type_superficie,

    -- Besoins (t) : éléments N, P2O5, K2O puis produits
    {% for colonne, code, diviseur in besoins %}
    {% if code == 'FUMIER' %}
    cast(null as float) as {{ colonne }},
    {% elif code in produits_formule %}
    iff(d.source_engrais is not null,
        s.superficie_reference_ha * coalesce(d.dose_{{ code | lower }}, 0) / {{ diviseur }},
        null) as {{ colonne }},
    {% else %}
    s.superficie_reference_ha * d.dose_{{ code | lower }} / {{ diviseur }} as {{ colonne }},
    {% endif %}
    {% endfor %}
    d.source_engrais is not null as a_formule_engrais_retenue,
    coalesce(d.phosphate_fond_exclu, false) as phosphate_fond_exclu,

    coalesce(d.source_semis, '') <> {{ source_semis_faye_extrapole() }} as besoin_semences_applicable,

    -- Source et statut des doses retenues
    coalesce(d.statut_engrais, {{ statut_validation_engrais('s.statut_dose') }}) as statut_validation_engrais,
    d.source_engrais as source_reference_engrais,
    coalesce(d.statut_semis, {{ statut_validation_semis('s.statut_dose_semis', 's.zone_agroecologique') }}) as statut_validation_semis,
    d.source_semis as source_reference_semis,

    -- Cohérence entre la dose départementale et la référence de zone de la source
    s.coherence_dose_n,
    s.coherence_dose_semis

from source s
left join doses d
    on d.zone_cle = upper(trim(s.zone_agroecologique))
   and d.culture_cle = upper(trim(s.culture))
