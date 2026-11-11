-- Contrôles du jeu de données de prévision de la pluie de saison.
-- Le test échoue s'il renvoie au moins une ligne.

with m as (

    select *
    from {{ ref('mart_ml_prevision_pluie') }}

)

-- Grain : une ligne par département et année
select code_departement || '|' || to_varchar(annee) as cle, 'grain dupliqué' as anomalie
from m
group by code_departement, annee
having count(*) > 1

union all

-- 45 départements x 1981-2025
select to_varchar(count(*)), 'volume différent de 2 025 lignes'
from m
having count(*) <> 2025

union all

-- Découpage temporel
select code_departement || '|' || to_varchar(annee), 'jeu incohérent avec l''année'
from m
where jeu <> iff(annee <= 2015, 'ENTRAINEMENT', 'TEST')

union all

-- Indices océaniques : une seule valeur par année pour tous les départements
select to_varchar(annee), 'indice océanique différent selon le département'
from m
group by annee
having count(distinct indice_oni_mars_mai) > 1
    or count(distinct indice_tna_mars_mai) > 1
    or count(distinct indice_tsa_mars_mai) > 1
    or count(distinct indice_amo_mars_mai) > 1

union all

-- Pluie N-1 = cible de l'année précédente (nulle seulement en 1981)
select m1.code_departement || '|' || to_varchar(m1.annee), 'pluie N-1 différente de la saison précédente'
from m m1
left join m m0
    on m0.code_departement = m1.code_departement
   and m0.annee = m1.annee - 1
where (m0.annee is null) <> (m1.pluie_saison_n_moins_1_mm is null)
   or abs(m1.pluie_saison_n_moins_1_mm - m0.pluie_saison_mm) > 0.01

union all

-- Cibles toujours renseignées ; ONI, TNA, TSA et normale toujours renseignés
select code_departement || '|' || to_varchar(annee), 'cible ou variable obligatoire manquante'
from m
where pluie_saison_mm is null
   or classe_saison is null
   or indice_oni_mars_mai is null
   or indice_tna_mars_mai is null
   or indice_tsa_mars_mai is null
   or pluie_normale_saison_mm is null
