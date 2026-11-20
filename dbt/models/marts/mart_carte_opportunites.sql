{{
    config(materialized='table')
}}

-- Écran « carte des opportunités » : une carte, trois couleurs, deux publics. Grain : département (45).
--
--   jaune : saison des pluies courte → conseiller des semences à cycle court ;
--   vert  : saison des pluies longue → des semences à cycle long passent ;
--   bleu  : eau mobilisable et peu exploitée en saison sèche → cultiver toute l'année (agriculteur),
--           aménager ou forer (investisseur).
--
-- couleur_fond (jaune / vert) existe pour tous les départements : elle vient du module B
-- (mart_choix_cultures, mêmes probabilités que l'écran Choix des cultures). cycle_max_conseille_j est le plus
-- long cycle (culture ou variété) qui passe au moins 4 années sur 5 (proba_cycle_couvert_pct >= 80) ;
-- la saison est « longue » quand ce cycle atteint seuil_cycle_long_j jours, « courte » sinon (y compris quand
-- aucun cycle ne passe 4 années sur 5), « non évaluée » quand le module B n'a aucune probabilité.
-- couche_eau (bleu) n'est évaluée qu'une fois les sources « eau » chargées (variable eau_chargee) ; avant,
-- categorie_eau vaut 'non évaluée' et couleur_carte = couleur_fond.
-- couleur_carte : bleu prioritaire, sinon couleur_fond. Le front peut aussi afficher le fond et une couche
-- bleue par-dessus (couche_eau), pour garder les deux messages.

{% set eau_chargee = var('eau_chargee', false) %}

{#- zone_secondaire, latitude et longitude n'existent pas dans toutes les versions de dim_geographie -#}
{% set colonnes_geo = [] %}
{% if execute %}
    {% set colonnes_geo = adapter.get_columns_in_relation(ref('dim_geographie')) | map(attribute='name') | map('lower') | list %}
{% endif %}

with geo as (

    select
        code_departement, departement, code_region, region, zone_agroecologique,
        {% if 'zone_secondaire' in colonnes_geo %}zone_secondaire{% else %}cast(null as varchar) as zone_secondaire{% endif %},
        {% if 'latitude' in colonnes_geo %}latitude{% else %}cast(null as float) as latitude{% endif %},
        {% if 'longitude' in colonnes_geo %}longitude{% else %}cast(null as float) as longitude{% endif %}
with geo as (

    select code_departement, departement, code_region, region, zone_agroecologique, zone_secondaire, latitude, longitude
    from {{ ref('dim_geographie') }}

),

profil as (

    select
        trim(code_departement) as code_departement,
        pluie_saison_normale_mm,
        duree_saison_moyenne_j,
        duree_saison_courte_j
    from {{ ref('stg_profil_agroclimatique') }}
    where code_departement is not null

),

-- Options (cycles et variétés) qui passent au moins 4 années sur 5. Hors cultures irriguées ou pluriannuelles,
-- qui ne dépendent pas de la durée de la saison des pluies.
options_sures as (

    select code_departement, culture, type_option, option, cycle_jours
    from {{ ref('mart_choix_cultures') }}
    where proba_cycle_couvert_pct >= 80
      and cycle_jours is not null
      and coalesce(niveau_adequation, '') not in ('irrigation requise', 'non évaluée (culture pluriannuelle)')

),

-- Départements où la durée de la saison est évaluée (au moins une option avec une probabilité).
evalues as (

    select distinct code_departement
    from {{ ref('mart_choix_cultures') }}
    where proba_cycle_couvert_pct is not null
      and coalesce(niveau_adequation, '') not in ('irrigation requise', 'non évaluée (culture pluriannuelle)')

),

cycles as (

    select evalues.code_departement, max(options_sures.cycle_jours) as cycle_max_conseille_j
    from evalues
    left join options_sures on options_sures.code_departement = evalues.code_departement
    group by evalues.code_departement

),

cultures_cycle_long as (

    select code_departement, listagg(culture, ', ') within group (order by culture) as cultures_cycle_long
    from (select distinct code_departement, culture from options_sures where type_option = 'CYCLE' and option = 'longue')
    group by code_departement

),

varietes as (

    select
        code_departement,
        listagg(libelle, ' ; ') within group (order by libelle) as varietes_conseillees,
        count(*) as nb_varietes_conseillees
    from (
        select distinct code_departement, culture || ' : ' || option || ' (' || to_varchar(round(cycle_jours)::number(5, 0)) || ' j)' as libelle
        from options_sures
        where type_option = 'VARIETE'
    )
    group by code_departement

),

{% if eau_chargee %}
eau as (

    select * from {{ ref('fact_eau_departement') }}

),
{% else %}
-- Sources « eau » pas encore chargées : mêmes colonnes, vides.
eau as (

    select
        code_departement,
        cast(null as float) as surface_eau_permanente_ha,
        cast(null as float) as surface_proche_eau_cultivable_ha,
        cast(null as float) as surface_proche_eau_inexploitee_ha,
        cast(null as float) as part_proche_eau_exploitee_pct,
        cast(null as varchar) as profondeur_classe_dominante,
        cast(null as varchar) as productivite_classe_dominante,
        cast(null as float) as part_nappe_accessible_pct,
        cast(null as float) as surface_equipee_irrigation_ha,
        cast(null as boolean) as eau_surface_mobilisable,
        cast(null as boolean) as nappe_accessible
    from geo
    where false

),
{% endif %}

classes as (

    select
        geo.*,
        profil.pluie_saison_normale_mm,
        profil.duree_saison_moyenne_j,
        profil.duree_saison_courte_j,
        cycles.cycle_max_conseille_j,
        cultures_cycle_long.cultures_cycle_long,
        varietes.varietes_conseillees,
        coalesce(varietes.nb_varietes_conseillees, 0) as nb_varietes_conseillees,

        case
            when cycles.code_departement is null then 'non évaluée'
            when cycles.cycle_max_conseille_j >= {{ var('seuil_cycle_long_j') }} then 'longue'
            else 'courte'
        end as classe_saison_pluie,

        eau.surface_eau_permanente_ha,
        eau.surface_proche_eau_cultivable_ha,
        eau.surface_proche_eau_inexploitee_ha,
        eau.part_proche_eau_exploitee_pct,
        eau.profondeur_classe_dominante,
        eau.productivite_classe_dominante,
        eau.part_nappe_accessible_pct,
        eau.surface_equipee_irrigation_ha,

        case
            when eau.code_departement is null then 'non évaluée'
            when eau.eau_surface_mobilisable
                 and coalesce(eau.part_proche_eau_exploitee_pct, 0) < {{ var('seuil_exploitation_forte_pct') }}
                then 'eau de surface peu exploitée'
            when eau.nappe_accessible then 'nappe accessible'
            when eau.eau_surface_mobilisable then 'eau de surface déjà exploitée'
            else 'pas d''eau mobilisable identifiée'
        end as categorie_eau

    from geo
    left join profil on profil.code_departement = geo.code_departement
    left join cycles on cycles.code_departement = geo.code_departement
    left join cultures_cycle_long on cultures_cycle_long.code_departement = geo.code_departement
    left join varietes on varietes.code_departement = geo.code_departement
    left join eau on eau.code_departement = geo.code_departement

),

couleurs as (

    select
        *,
        case classe_saison_pluie when 'longue' then 'vert' when 'courte' then 'jaune' end as couleur_fond,
        categorie_eau in ('eau de surface peu exploitée', 'nappe accessible') as couche_eau
    from classes

)

select
    -- Territoire
    code_departement,
    departement,
    code_region,
    region,
    zone_agroecologique,
    zone_secondaire,
    latitude,
    longitude,

    -- Couleurs de la carte
    case when couche_eau then 'bleu' else couleur_fond end as couleur_carte,
    couleur_fond,
    couche_eau,

    -- Pluie : quel cycle semer (module B)
    classe_saison_pluie,
    cycle_max_conseille_j,
    cultures_cycle_long,
    varietes_conseillees,
    nb_varietes_conseillees,
    pluie_saison_normale_mm,
    duree_saison_moyenne_j,
    duree_saison_courte_j,

    -- Eau : où produire en contre-saison, où investir
    categorie_eau,
    case when categorie_eau = 'eau de surface peu exploitée' then surface_proche_eau_inexploitee_ha end
        as potentiel_contre_saison_ha,
    case
        when couche_eau then row_number() over (
            partition by couche_eau
            order by
                case when categorie_eau = 'eau de surface peu exploitée' then 0 else 1 end,
                surface_proche_eau_inexploitee_ha desc nulls last,
                part_nappe_accessible_pct desc nulls last,
                code_departement
        )
    end as rang_opportunite_eau,
    surface_eau_permanente_ha,
    surface_proche_eau_cultivable_ha,
    surface_proche_eau_inexploitee_ha,
    part_proche_eau_exploitee_pct,
    profondeur_classe_dominante,
    productivite_classe_dominante,
    part_nappe_accessible_pct,
    surface_equipee_irrigation_ha,

    -- Messages prêts à afficher (ou à lire en wolof par l'assistant vocal)
    case classe_saison_pluie
        when 'longue' then 'Saison des pluies longue : des semences à cycle long, jusqu''à '
            || to_varchar(round(cycle_max_conseille_j)::number(5, 0)) || ' jours, passent 4 années sur 5.'
        when 'courte' then coalesce(
            'Saison des pluies courte : choisir des semences à cycle court, '
                || to_varchar(round(cycle_max_conseille_j)::number(5, 0)) || ' jours au plus, pour récolter 4 années sur 5.',
            'Saison des pluies très courte : aucun cycle documenté ne passe 4 années sur 5 ; '
                || 'choisir les variétés les plus précoces.'
        )
        else 'Durée de la saison non évaluée pour ce département.'
    end
    || case categorie_eau
        when 'eau de surface peu exploitée' then ' En saison sèche, de l''eau reste disponible à moins de 2 km : '
            || 'une culture de contre-saison est possible.'
        when 'nappe accessible' then ' En saison sèche, la nappe est à 25 m au plus : un puits ou un forage '
            || 'permet une culture de contre-saison.'
        else ''
    end as conseil_agriculteur,

    case categorie_eau
        when 'eau de surface peu exploitée' then 'Environ ' || to_varchar(round(surface_proche_eau_inexploitee_ha, -1)::number(12, 0))
            || ' ha cultivables à moins de 2 km d''une eau permanente restent nus en saison sèche : '
            || 'aménagement hydro-agricole à étudier.'
        when 'nappe accessible' then 'Nappe à 25 m au plus, avec au moins 1 L/s par forage, sur '
            || to_varchar(round(part_nappe_accessible_pct)::number(3, 0)) || ' % du territoire : forages et maraîchage de contre-saison à étudier.'
        when 'eau de surface déjà exploitée' then 'Les terres proches de l''eau sont déjà exploitées en saison sèche ('
            || to_varchar(round(part_proche_eau_exploitee_pct)::number(3, 0)) || ' %) : marge d''extension faible.'
    end as conseil_investisseur

from couleurs
