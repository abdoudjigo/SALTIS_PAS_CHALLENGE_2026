select
    code_departement,
    departement,
    region,
    zone_agroecologique,
    scenario,
    produit,
    quantite_disponible_nationale_t,
    besoin_t,
    allocation_t,
    taux_couverture_pct,
    deficit_t
from {{ source('raw', 'd_scenarios_repartition') }}
