{{
    config(materialized='table')
}}

-- Jeu de données du modèle de prévision de la pluie de saison (équipe ML).
-- Grain : un département, une année (campagne). 45 x 1981-2025 = 2 025 lignes.
--
-- Variables explicatives : uniquement des variables CONNUES FIN MAI (avant la saison) :
--   indices océaniques moyens mars-mai (ONI, TNA, TSA, AMO), pluie de la saison N-1,
--   humidité du sol avril-mai, normale du département (1991-2020).
-- Cibles : pluie_saison_mm et classe_saison, issues de fact_saison_departement
--   (identiques à la table de prédicteurs, vérifié : 0 écart).
-- jeu : ENTRAINEMENT (<= 2015) / TEST (2016-2025). Découpage temporel : ne jamais
--   mélanger les années au hasard.
--
-- Limites connues (valeurs nulles conservées, jamais remplacées) :
--   - indices océaniques identiques pour tous les départements d'une même année
--     (une seule situation océanique par an : 35 situations sur 1981-2015) ;
--   - AMO : dernière valeur en 2022, nulle de 2023 à 2025 ;
--   - pluie N-1 nulle en 1981 (pas de saison 1980) ;
--   - humidité du sol nulle pour 6 départements côtiers sur toute la période (Dakar,
--     Guédiawaye, Pikine, Rufisque, Oussouye, Ziguinchor), pour Goudomp (4 années entre
--     1989 et 2003) et pour 8 départements en 1986 ;
--   - la normale 1991-2020 chevauche le jeu de test (2016-2020) : évaluation pas
--     totalement indépendante ;
--   - les variables de saison (pluie juin-juillet, démarrage, SPI, NDVI…) sont connues
--     après fin mai : elles sont volontairement absentes.

with predicteurs as (

    select
        {{ cle_departement('code_departement') }} as id_departement,
        annee::integer as annee,
        indice_oni_mars_mai,
        indice_tna_mars_mai,
        indice_tsa_mars_mai,
        indice_amo_mars_mai,
        pluie_saison_n_moins_1_mm,
        humidite_sol_avril_mai_m3_m3,
        pluie_normale_saison_mm
    from {{ ref('stg_predicteurs_saisonniers') }}
    where code_departement is not null
      and annee is not null

),

cibles as (

    select id_departement, campagne_agricole as annee, pluie_saison_mm, classe_saison
    from {{ ref('fact_saison_departement') }}

)

select
    -- Territoire et année (codes lisibles, pas de clé md5)
    g.code_departement,
    g.departement,
    g.code_region,
    g.region,
    g.zone_agroecologique,
    p.annee,
    iff(p.annee <= 2015, 'ENTRAINEMENT', 'TEST') as jeu,

    -- Variables connues fin mai
    p.indice_oni_mars_mai,
    p.indice_tna_mars_mai,
    p.indice_tsa_mars_mai,
    p.indice_amo_mars_mai,
    p.pluie_saison_n_moins_1_mm,
    p.humidite_sol_avril_mai_m3_m3,
    p.pluie_normale_saison_mm,
    iff(p.indice_oni_mars_mai is null, 1, 0)
      + iff(p.indice_tna_mars_mai is null, 1, 0)
      + iff(p.indice_tsa_mars_mai is null, 1, 0)
      + iff(p.indice_amo_mars_mai is null, 1, 0)
      + iff(p.pluie_saison_n_moins_1_mm is null, 1, 0)
      + iff(p.humidite_sol_avril_mai_m3_m3 is null, 1, 0)
      + iff(p.pluie_normale_saison_mm is null, 1, 0) as nb_variables_manquantes,

    -- Cibles (fact_saison_departement)
    c.pluie_saison_mm,
    c.classe_saison

from predicteurs p
join {{ ref('dim_geographie') }} g
    on g.id_departement = p.id_departement
left join cibles c
    on c.id_departement = p.id_departement
   and c.annee = p.annee
