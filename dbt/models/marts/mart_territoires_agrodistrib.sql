{{
    config(materialized='table')
}}

-- Critères par territoire pour AgroDistrib (module D).
-- Grain : département x culture, seulement là où la culture existe : superficie de
-- référence renseignée et > 0 (AgroDistrib ne répartit que là). region, code_region et
-- zone_agroecologique servent à agréger (deux regroupements parallèles, pas de hiérarchie).
--
-- Additivité :
--   - ADDITIFS (somme par région ou zone autorisée) : superficie_reference_ha et besoins (t),
--     sauf besoin_fumier_t, toujours NULL et exclu des totaux (« non chiffré : fumure organique
--     conseillée si possible ») ; produit absent d'une formule retenue = 0, culture sans formule = NULL ;
--     les semences à totaliser sont besoin_semences_retenu_t ;
--   - NON ADDITIFS : tout le reste (rendements, potentiel, probabilités, sol, vulnérabilité).
--
-- Potentiel de gain (décision validée, option a) : valeurs de ZONE (fact_facteurs_limitants)
-- portées comme attribut non additif, niveau_source_potentiel = 'ZONE'. Elles ne
-- s'additionnent jamais et ne distinguent pas les départements d'une même zone.
-- potentiel_evalue = false quand le rendement est une valeur nationale FAOSTAT recopiée sur
-- la zone : potentiel_gain_kg_ha est alors NULL (« non évalué au niveau de la zone »).
-- facteur_limitant_principal et recommandations de sol : également des valeurs de zone.
-- Le gain de rendement est une estimation indicative (aucune donnée de réponse aux engrais
-- par territoire ; à valider avec l'ISRA).

with besoins as (

    select *
    from {{ ref('fact_besoin_reference') }}
    where superficie_reference_ha > 0

),

adequation as (

    select
        id_departement,
        id_culture,
        -- meilleur niveau parmi les cycles : adaptée > à risque > déconseillée
        case min(case niveau_adequation
                    when 'adaptée' then 1
                    when 'à risque' then 2
                    when 'déconseillée' then 3
                 end)
            when 1 then 'adaptée'
            when 2 then 'à risque'
            when 3 then 'déconseillée'
            else max(niveau_adequation)   -- irrigation requise / non évaluée (même valeur pour tous les cycles)
        end as meilleur_niveau_adequation,
        max(iff(classe_cycle = 'moyenne', proba_cycle_couvert_pct, null)) as proba_cycle_couvert_moyen_pct
    from {{ ref('fact_adequation_culture') }}
    group by 1, 2

),

profil as (

    select
        {{ cle_departement('code_departement') }} as id_departement,
        proba_saison_seche_pct,
        classe_texture,
        ph_eau,
        reserve_utile_mm,
        carbone_organique_g_kg,
        part_cultures_pct
    from {{ ref('stg_profil_agroclimatique') }}
    where code_departement is not null

)

select
    -- Territoire (agrégation par région ou zone)
    g.code_departement,
    g.departement,
    g.code_region,
    g.region,
    g.zone_agroecologique,
    c.culture,

    -- Besoin (additif)
    b.superficie_reference_ha,
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
                when not b.a_formule_engrais_retenue     then 'dose à saisir'
        when b.superficie_reference_ha = 0       then 'superficie de référence nulle'
        when b.{{ col }} = 0                     then 'pas dans la formule'
        else 'calculé'
    end as libelle_{{ nom }},
    {% endfor %}
    iff(b.phosphate_fond_exclu,
        'phosphate de fond (400 kg tous les 3 ans) volontairement exclu du besoin annuel', null) as note_dap,
    'non chiffré : fumure organique conseillée si possible' as libelle_fumier,
    b.besoin_semences_applicable,
    iff(b.besoin_semences_applicable, b.besoin_semences_t, null) as besoin_semences_retenu_t,
    b.statut_validation_engrais,
    b.source_reference_engrais,
    b.statut_validation_semis,
    b.source_reference_semis,

    -- Potentiel de gain (valeurs de zone, non additives)
    'ZONE' as niveau_source_potentiel,
    f.rendement_moyen_kg_ha,
    f.rendement_atteignable_kg_ha,
    f.ecart_rendement_kg_ha,
    not f.est_rendement_national as potentiel_evalue,
    iff(f.est_rendement_national, null, f.ecart_rendement_kg_ha) as potentiel_gain_kg_ha,

    -- Capacité à valoriser l'intrant
    a.meilleur_niveau_adequation,
    a.proba_cycle_couvert_moyen_pct,
    f.facteur_limitant_principal,
    p.proba_saison_seche_pct,

    -- Sol (département) et recommandations (zone)
    p.classe_texture,
    p.ph_eau,
    p.reserve_utile_mm,
    p.carbone_organique_g_kg,
    f.amendement_ph_recommande,
    f.fractionnement_azote_recommande,

    -- Vulnérabilité (relative, indicative)
    v.score_vulnerabilite,
    v.classe_vulnerabilite,
    v.score_alea_secheresse,
    v.confiance_rendement,
    v.methode_version as methode_version_vulnerabilite,

    -- Contexte
    p.part_cultures_pct

from besoins b
join {{ ref('dim_geographie') }} g
    on g.id_departement = b.id_departement
join {{ ref('dim_culture') }} c
    on c.id_culture = b.id_culture
left join {{ ref('fact_facteurs_limitants') }} f
    on f.id_zone_agroecologique = g.id_zone_agroecologique
   and f.id_culture = b.id_culture
left join adequation a
    on a.id_departement = b.id_departement
   and a.id_culture = b.id_culture
left join profil p
    on p.id_departement = b.id_departement
left join {{ ref('mart_vulnerabilite_departement') }} v
    on v.code_departement = g.code_departement
