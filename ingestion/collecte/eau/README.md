# Sources « eau » de la carte des opportunités

| Fichier | Rôle |
|---|---|
| `preparer_eau.py` | Télécharge GADM et FAO GMIA, lit les cartes BGS déposées dans `data/raw/eau/bgs/`, produit `data/modules/e_eau_souterraine_departement.csv` et `e_irrigation_departement.csv` (45 lignes chacun) |
| `gee_eau_surface.js` | Script Google Earth Engine : eau présente 10 mois sur 12, terres cultivables à moins de 2 km, vertes ou nues en saison sèche → `e_eau_surface_departement.csv` |
| `charger_snowflake.py` | Vérifie les trois CSV, puis les charge dans `SALTIS.RAW.E_*` (`--confirmer`) |

Ordre, raisons et limites : [`docs/carte-opportunites.md`](../../../docs/carte-opportunites.md).
