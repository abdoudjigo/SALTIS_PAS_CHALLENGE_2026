select
    code_departement,
    departement,
    produit,
    stock_t,
    date_inventaire,
    lieu_stockage,
    source
from {{ source('raw', 'd_stocks_disponibles') }}
