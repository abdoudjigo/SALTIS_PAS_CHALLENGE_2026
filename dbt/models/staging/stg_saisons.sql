select
    code_departement,
    departement,
    zone_agroecologique,
    annee,
    pluie_saison_mm,
    spi_saison,
    classe_saison,
    duree_saison_j,
    plus_longue_sequence_seche_j,
    alerte_secheresse,
    alerte_exces_pluie
from {{ source('raw', 'a_saisons_departement') }}
