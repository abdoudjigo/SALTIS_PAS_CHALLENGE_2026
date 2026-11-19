{{
    config(materialized='table')
}}

-- Grain : zone agroécologique (nullable = dose nationale) x culture x intrant x source_reference.
-- Lignes construites dans int_reference_dose (union des doses actuelles et des doses PIA,
-- règle de priorité) ; ce fait garde une ligne par dose et par source, sans rien écraser.
-- dose_retenue : la ligne est la dose retenue dans au moins une zone (nb_zones_retenue) ;
-- une dose nationale peut être retenue dans certaines zones et pas dans d'autres (ex. PIA
-- mil : 5 zones, Casamance garde Tounkara 2022). Détail par zone : int_reference_dose.
-- Une ligne par dose et par source : une future dose ISRA s'ajoute à côté des références
-- actuelles sans les écraser (voir CLAUDE.md, circuit ISRA).
--
-- Intrants et types (on n'additionne JAMAIS des doses de types ou d'unités différents) :
--   - PRODUIT : NPK_15_15_15, NPK_15_10_10, NPK_6_20_10 (PIA), UREE, DAP_18_46_0 (kg/ha),
--               FUMIER (t/ha), SEMENCES (kg/ha) ;
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
-- Doses PIA (IFDC-CORAF, fiches ISRA) : nationales, A_CONFIRMER (statut fourni par le seed),
-- avec dose_min, dose_max et regle (choix de la dose dans la fourchette des fiches).

with candidats as (

    select *
    from {{ ref('int_reference_dose') }}

),

lignes as (

    select
        id_reference_agronomique,
        any_value(zone_agroecologique) as zone_agroecologique,
        any_value(portee_geographique) as portee_geographique,
        any_value(culture) as culture,
        any_value(code_intrant) as code_intrant,
        any_value(type_intrant) as type_intrant,
        any_value(dose) as dose,
        any_value(unite) as unite,
        any_value(besoin_eau_mm) as besoin_eau_mm,
        any_value(dose_min) as dose_min,
        any_value(dose_max) as dose_max,
        any_value(regle) as regle,
        any_value(statut_validation) as statut_validation,
        any_value(source_reference) as source_reference,
        any_value(note_source) as note_source,
        any_value(rang_priorite) as rang_priorite,
        boolor_agg(est_retenue) as dose_retenue,
        count_if(est_retenue) as nb_zones_retenue
    from candidats
    group by id_reference_agronomique

)

select
    id_reference_agronomique,

    -- Clés : zone nulle = dose nationale
    {{ cle_zone('zone_agroecologique') }} as id_zone_agroecologique,
    portee_geographique,
    {{ cle_culture('culture') }} as id_culture,

    -- Intrant
    code_intrant,
    type_intrant,

    -- Dose
    dose,
    unite,
    besoin_eau_mm,
    dose_min,
    dose_max,
    regle,

    -- Priorité (int_reference_dose)
    rang_priorite,
    dose_retenue,
    nb_zones_retenue,

    -- Traçabilité
    statut_validation,
    source_reference,
    note_source,
    cast(null as date) as date_reception

from lignes
