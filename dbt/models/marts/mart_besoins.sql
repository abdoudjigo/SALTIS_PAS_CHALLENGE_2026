{{
    config(materialized='table')
}}

-- Écran besoins en intrants (module C). Besoins de RÉFÉRENCE HISTORIQUES, pas prévisionnels.
-- Grain : département x culture. Part de dim_geographie : les 45 départements apparaissent,
-- Guédiawaye et Pikine avec une seule ligne (culture NULL) « pas de superficie agricole de
-- référence ». 367 + 2 = 369 lignes.
--
-- Règles validées (A5) :
--   - besoins = superficie x dose RETENUE de la zone (fact_besoin_reference, int_reference_dose :
--     recherche propre à la zone, puis PIA national, puis NON_VERIFIEE) ;
--   - dose inconnue -> besoin NULL (« dose à saisir »), jamais 0 ; dose à 0 -> besoin 0 ;
--     produit engrais absent d'une formule retenue -> 0 (« pas dans la formule ») ; culture
--     sans formule -> NULL (« dose à saisir ») ; fumier toujours NULL (non chiffré, hors totaux) ;
--   - semences non applicables (dose de repiquage irrigué appliquée au riz pluvial) :
--     besoin_semences_retenu_t = NULL, c'est la colonne à totaliser. Avec la dose PIA du riz
--     pluvial, aucune ligne n'est concernée aujourd'hui ;
--   - reference_anterieure_2015 : dernière année de annees_reference < 2015 ;
--   - irrigation_totale_m3 = superficie x volume par hectare de la zone, uniquement quand la
--     culture est en « irrigation requise » dans le département, NULL sinon.
-- Les doses et le volume d'irrigation par hectare sont des références de ZONE (non additives).

with besoins as (

    select *
    from {{ ref('fact_besoin_reference') }}

),

irrigation_zone as (

    select id_zone_agroecologique, id_culture, dose as volume_irrigation_m3_ha, besoin_eau_mm
    from {{ ref('fact_reference_agronomique') }}
    where code_intrant = 'EAU_IRRIGATION'
      and portee_geographique = 'ZONE'

),

irrigation_requise as (

    select id_departement, id_culture,
           boolor_agg(niveau_adequation = 'irrigation requise') as irrigation_requise
    from {{ ref('fact_adequation_culture') }}
    group by 1, 2

)

select
    -- Territoire
    g.code_departement,
    g.departement,
    g.code_region,
    g.region,
    g.zone_agroecologique,

    -- Situation
    c.culture,
    iff(b.id_besoin_reference is null, 'pas de superficie agricole de référence', null) as message_departement,

    -- Superficie de référence
    b.superficie_reference_ha,
    b.annees_reference,
    b.type_superficie,
    try_to_number(split_part(b.annees_reference, '-', 2)) < 2015 as reference_anterieure_2015,

    -- Engrais (t)
    b.besoin_azote_n_t,
    b.besoin_phosphate_p2o5_t,
    b.besoin_potasse_k2o_t,
    b.besoin_npk_15_15_15_t,
    b.besoin_npk_15_10_10_t,
    b.besoin_npk_6_20_10_t,
    b.besoin_uree_t,
    b.besoin_dap_t,
    b.besoin_fumier_t,

    -- Libellés par produit engrais (règle du 19/11/2026)
    {% for col, nom in [('besoin_npk_15_15_15_t', 'npk_15_15_15'), ('besoin_npk_15_10_10_t', 'npk_15_10_10'),
                        ('besoin_npk_6_20_10_t', 'npk_6_20_10'), ('besoin_uree_t', 'uree'), ('besoin_dap_t', 'dap')] %}
    case
        when b.id_besoin_reference is null       then null
        when not b.a_formule_engrais_retenue     then 'dose à saisir'
        when b.superficie_reference_ha = 0       then 'superficie de référence nulle'
        when b.{{ col }} = 0                     then 'pas dans la formule'
        else 'calculé'
    end as libelle_{{ nom }},
    {% endfor %}
    iff(b.phosphate_fond_exclu,
        'phosphate de fond (400 kg tous les 3 ans) volontairement exclu du besoin annuel', null) as note_dap,
    iff(b.id_besoin_reference is not null,
        'non chiffré : fumure organique conseillée si possible', null) as libelle_fumier,
    case
        when b.id_besoin_reference is null             then null
        when b.statut_validation_engrais = 'A_COMPLETER' then 'dose à saisir'
        when b.superficie_reference_ha = 0             then 'superficie de référence nulle'
        else 'calculé'
    end as libelle_besoin_engrais,

    -- Semences (t)
    b.besoin_semences_t,
    b.besoin_semences_applicable,
    iff(b.besoin_semences_applicable, b.besoin_semences_t, null) as besoin_semences_retenu_t,
    case
        when b.id_besoin_reference is null             then null
        when not b.besoin_semences_applicable          then 'non applicable (riz pluvial)'
        when b.statut_validation_semis = 'A_COMPLETER' then 'dose à saisir'
        when b.superficie_reference_ha = 0             then 'superficie de référence nulle'
        else 'calculé'
    end as libelle_semences,

    -- Irrigation
    i.besoin_eau_mm as besoin_irrigation_mm,
    i.volume_irrigation_m3_ha,
    coalesce(r.irrigation_requise, false) as irrigation_requise,
    iff(r.irrigation_requise, b.superficie_reference_ha * i.volume_irrigation_m3_ha, null) as irrigation_totale_m3,

    -- Statuts des doses
    b.statut_validation_engrais,
    b.source_reference_engrais,
    b.statut_validation_semis,
    b.source_reference_semis,
    b.coherence_dose_n,
    b.coherence_dose_semis

from {{ ref('dim_geographie') }} g
left join besoins b
    on b.id_departement = g.id_departement
left join {{ ref('dim_culture') }} c
    on c.id_culture = b.id_culture
left join irrigation_zone i
    on i.id_zone_agroecologique = g.id_zone_agroecologique
   and i.id_culture = b.id_culture
left join irrigation_requise r
    on r.id_departement = g.id_departement
   and r.id_culture = b.id_culture
