select
    code_departement,
    departement,
    region,
    zone_agroecologique,
    annee,
    pluie_saison_mm,
    classe_saison,
    pluie_normale_saison_mm,
    pluie_saison_n_moins_1_mm,
    indice_amo_mars_mai,
    indice_oni_mars_mai,
    indice_tna_mars_mai,
    indice_tsa_mars_mai,
    humidite_sol_avril_mai_m3_m3
from {{ source('raw', 'a_predicteurs_saisonniers') }}
