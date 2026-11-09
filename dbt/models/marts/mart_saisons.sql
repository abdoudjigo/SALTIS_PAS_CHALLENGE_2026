-- Module A : une ligne par département et par année agricole.
select
    code_departement,
    departement,
    region,
    zone_agroecologique,
    annee,
    pluie_saison_mm,
    pluie_normale_saison_mm,
    anomalie_pluie_saison_pct,
    spi_saison,
    debut_saison_jour,
    retard_debut_saison_j,
    fin_saison_jour,
    duree_saison_j,
    nb_jours_pluie,
    nb_jours_pluie_forte,
    pluie_max_journaliere_mm,
    plus_longue_sequence_seche_j,
    nb_sequences_seches_7j,
    temp_max_moy_saison_c,
    nb_jours_tmax_sup_40,
    et0_saison_mm,
    humidite_sol_surface_m3_m3,
    ndvi_max_saison_zc,
    anomalie_ndvi_pct,
    source_calendrier,
    nb_decades_seches,
    nb_decades_tres_pluvieuses,
    pluie_juin_juillet_mm,
    classe_saison,
    alerte_secheresse,
    alerte_exces_pluie,
    case
        when alerte_secheresse = true then 'sécheresse'
        when alerte_exces_pluie = true then 'excès de pluie'
        else 'normal'
    end as risque_saison
from {{ ref('stg_saisons') }}
