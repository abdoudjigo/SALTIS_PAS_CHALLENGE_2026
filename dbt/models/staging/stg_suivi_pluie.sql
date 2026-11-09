select
    code_departement,
    departement,
    zone_agroecologique,
    annee,
    decade,
    mois,
    decade_du_mois,
    periode,
    pluie_mm,
    nb_jours_pluie,
    plus_longue_sequence_seche_j,
    cumul_depuis_juin_mm,
    part_saison_pct,
    pluie_normale_mm,
    anomalie_pluie_pct,
    decade_seche
from {{ source('raw', 'a_suivi_pluie_decade') }}
