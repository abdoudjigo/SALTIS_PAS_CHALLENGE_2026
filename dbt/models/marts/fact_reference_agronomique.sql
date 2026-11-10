{{
    config(materialized='table')
}}

-- Grain : zone agroécologique (nullable = dose nationale) x culture x intrant x source_reference.
-- Une ligne par dose et par source : une future dose ISRA s'ajoute à côté des références
-- actuelles sans les écraser (voir CLAUDE.md, circuit ISRA).
--
-- Intrants et types (on n'additionne JAMAIS des doses de types ou d'unités différents) :
--   - PRODUIT : NPK_15_15_15, UREE, DAP_18_46_0 (kg/ha), FUMIER (t/ha), SEMENCES (kg/ha) ;
--   - ELEMENT : N, P2O5, K2O (kg/ha), éléments fertilisants apportés par les produits ;
--               les produits et les éléments décrivent la même fertilisation : les sommer
--               compterait deux fois l'engrais ;
--   - EAU     : EAU_IRRIGATION (m3/ha, avec besoin_eau_mm à côté).
--
-- Règles :
--   - une dose inconnue ne donne pas de ligne (zone x culture « à compléter ») ;
--   - une dose à 0 est gardée : produit absent de la formule, ou irrigation inutile en
--     année normale. En AgroDistrib, 0 = besoin nul ; absence = dose à saisir ;
--   - statut_validation : VALIDEE réservé aux doses validées par un spécialiste (ISRA,
--     ANCAR) ; aucune aujourd'hui. Texte d'origine conservé dans note_source.
--
-- Correspondance des statuts validée (A4) :
--   - « recommandation de la recherche (mil sanio) » (Tounkara 2022, Casamance)  -> A_CONFIRMER
--   - « pratique vulgarisée » (Faye 2020, riz irrigué, Vallée)                     -> A_CONFIRMER
--   - « dose établie en Basse Casamance … appliquée faute de mieux » (mil, 5 zones) -> NON_VERIFIEE
--   - « formule N120 P60 K60 de la vallée » (source web non vérifiée)               -> NON_VERIFIEE
--   - semis « repiquage : 40 kg » (Faye 2020) : Vallée -> A_CONFIRMER, autres zones -> NON_VERIFIEE
--   - EAU_IRRIGATION (estimation FAO-56, efficience 60 %)                           -> A_CONFIRMER
--   - « à compléter » : aucune dose chiffrée, donc aucune ligne.
-- Un nouveau texte de statut non prévu donne statut_validation nul et fait échouer le test not_null.
-- Cette correspondance vit dans macros/statuts_doses.sql (partagée avec fact_besoin_reference).

{% set intrants_fertilisation = [
    {'code': 'NPK_15_15_15', 'type': 'PRODUIT', 'colonne': 'npk_15_15_15_kg_ha',          'unite': 'kg/ha'},
    {'code': 'UREE',         'type': 'PRODUIT', 'colonne': 'uree_kg_ha',                  'unite': 'kg/ha'},
    {'code': 'DAP_18_46_0',  'type': 'PRODUIT', 'colonne': 'dap_kg_ha',                   'unite': 'kg/ha'},
    {'code': 'FUMIER',       'type': 'PRODUIT', 'colonne': 'fumier_t_ha',                 'unite': 't/ha'},
    {'code': 'N',            'type': 'ELEMENT', 'colonne': 'dose_n_recommandee_kg_ha',    'unite': 'kg/ha'},
    {'code': 'P2O5',         'type': 'ELEMENT', 'colonne': 'dose_p2o5_recommandee_kg_ha', 'unite': 'kg/ha'},
    {'code': 'K2O',          'type': 'ELEMENT', 'colonne': 'dose_k2o_recommandee_kg_ha',  'unite': 'kg/ha'},
] %}

with source as (

    select *
    from {{ ref('stg_besoins_hectare') }}
    where zone_agroecologique is not null
      and culture is not null

),

fertilisation as (

    select
        *,

        -- Correspondance partagée avec fact_besoin_reference (macros/statuts_doses.sql)
        {{ statut_validation_engrais('statut_dose') }} as statut_validation,
        {{ source_reference_engrais('statut_dose', 'origine_dose') }} as source_reference,

        array_to_string(array_construct_compact(
            'statut : ' || trim(statut_dose),
            'origine : ' || trim(origine_dose),
            'formule : ' || trim(formule_engrais_recommandee)
        ), ' | ') as note_source

    from source

),

{% for i in intrants_fertilisation %}
dose_{{ i.code | lower }} as (

    select
        zone_agroecologique,
        culture,
        '{{ i.code }}' as code_intrant,
        '{{ i.type }}' as type_intrant,
        {{ i.colonne }} as dose,
        '{{ i.unite }}' as unite,
        cast(null as float) as besoin_eau_mm,
        statut_validation,
        source_reference,
        note_source
    from fertilisation
    where {{ i.colonne }} is not null

),
{% endfor %}

semences as (

    select
        zone_agroecologique,
        culture,
        'SEMENCES' as code_intrant,
        'PRODUIT' as type_intrant,
        dose_semis_kg_ha as dose,
        'kg/ha' as unite,
        cast(null as float) as besoin_eau_mm,

        -- Faye et al. (2020) : casier de Matam, Vallée du fleuve Sénégal (macros/statuts_doses.sql)
        {{ statut_validation_semis('statut_dose_semis', 'zone_agroecologique') }} as statut_validation,
        {{ source_reference_semis('origine_dose_semis', 'zone_agroecologique') }} as source_reference,

        array_to_string(array_construct_compact(
            'statut : ' || trim(statut_dose_semis),
            'origine : ' || trim(origine_dose_semis)
        ), ' | ') as note_source

    from source
    where dose_semis_kg_ha is not null

),

irrigation as (

    select
        zone_agroecologique,
        culture,
        'EAU_IRRIGATION' as code_intrant,
        'EAU' as type_intrant,
        volume_irrigation_m3_ha as dose,
        'm3/ha' as unite,
        besoin_irrigation_normal_mm as besoin_eau_mm,
        'A_CONFIRMER' as statut_validation,
        'Estimation FAO-56 (dataset SALTIS)' as source_reference,
        'estimation calculée (FAO-56, efficience 60 %), non mesurée' as note_source
    from source
    where volume_irrigation_m3_ha is not null

),

unioned as (

    {% for i in intrants_fertilisation %}
    select * from dose_{{ i.code | lower }}
    union all
    {% endfor %}
    select * from semences
    union all
    select * from irrigation

)

select
    md5(
        coalesce(upper(trim(zone_agroecologique)), 'NATIONAL') || '|' || upper(trim(culture))
        || '|' || code_intrant || '|' || coalesce(source_reference, '')
    ) as id_reference_agronomique,

    -- Clés : zone nulle = dose nationale (futures données ISRA)
    {{ cle_zone('zone_agroecologique') }} as id_zone_agroecologique,
    iff(zone_agroecologique is null, 'NATIONAL', 'ZONE') as portee_geographique,
    {{ cle_culture('culture') }} as id_culture,

    -- Intrant
    code_intrant,
    type_intrant,

    -- Dose
    dose,
    unite,
    besoin_eau_mm,

    -- Traçabilité
    statut_validation,
    source_reference,
    note_source,
    cast(null as date) as date_reception

from unioned
