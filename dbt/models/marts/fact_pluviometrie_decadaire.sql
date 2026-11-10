{{
    config(materialized='table')
}}

-- Grain : un département, une année civile, une décade (1 à 36).
-- 44 départements x 1981-2025 x 36 décades = 71 280 lignes.
--
-- Suivi décade par décade pendant la campagne : pluie observée, cumul depuis le
-- 1er juin comparé à la normale.
--
-- Géographie : seule la clé département est portée. Zone agroécologique et région
-- s'obtiennent par dim_geographie (deux regroupements parallèles, pas une hiérarchie).
--
-- Lien au temps : numero_decade_annee (1 à 36) et campagne_agricole, calculée
-- comme dans dim_temps (juin N à mai N+1 rattachés à N). Pas d'id_temps journalier.
--
-- Limites connues :
--   - Guédiawaye absent de la source (calendrier NASA POWER, voir fact_saison_departement) ;
--   - cumul et part de saison renseignés uniquement pour les décades 16 à 30 (juin-octobre),
--     nuls ailleurs (jamais remplacés par zéro) ;
--   - anomalie nulle quand la normale de la décade est inférieure à 1 mm (calcul non significatif) ;
--   - decade_seche est presque toujours vrai hors saison (pas de pluie) : filtrer sur
--     est_decade_saison pour l'interpréter.
--
-- Exclu : libellés département et zone (portés par dim_geographie), `periode`
-- (voir dim_temps.libelle_decade).

with source as (

    select *
    from {{ ref('stg_suivi_pluie') }}
    where code_departement is not null
      and annee is not null
      and decade is not null

),

enrichi as (

    select
        source.*,

        decade between 16 and 30 as est_decade_saison,

        -- Cumul de la normale depuis le 1er juin, sur la même période que cumul_depuis_juin_mm
        case
            when decade between 16 and 30 then
                sum(iff(decade between 16 and 30, pluie_normale_mm, null)) over (
                    partition by code_departement, annee
                    order by decade
                    rows between unbounded preceding and current row
                )
        end as cumul_normale_depuis_juin_mm

    from source

)

select
    md5(trim(code_departement) || '|' || to_varchar(annee) || '|' || to_varchar(decade)) as id_pluie_decade,

    -- Clés vers les dimensions
    {{ cle_departement('code_departement') }} as id_departement,
    annee::integer as annee,
    decade::integer as numero_decade_annee,
    (case
        when mois >= 6 then annee
        else annee - 1
    end)::integer as campagne_agricole,
    est_decade_saison,

    -- Pluie de la décade
    pluie_mm,
    nb_jours_pluie,
    plus_longue_sequence_seche_j,
    decade_seche,

    -- Comparaison à la normale de la décade
    pluie_normale_mm,
    anomalie_pluie_pct,

    -- Cumul de la saison (décades 16 à 30)
    cumul_depuis_juin_mm,
    cumul_normale_depuis_juin_mm,
    cumul_depuis_juin_mm - cumul_normale_depuis_juin_mm as ecart_cumul_normale_mm,
    part_saison_pct

from enrichi
