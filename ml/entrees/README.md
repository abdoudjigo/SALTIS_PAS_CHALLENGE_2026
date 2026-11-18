# Entrées pour prévoir les années à venir

`MART_ML_PREVISION_PLUIE` s'arrête en 2025. Pour prévoir une saison qui n'y est pas encore, on ajoute ici les indices océaniques de mars à mai de cette année, dès leur publication (fin mai ou début juin).

| Colonne | Calcul (identique au mart, vérifié sur 2024 et 2025) | Source |
|---|---|---|
| `indice_oni_mars_mai` | Moyenne des valeurs ONI « FMA », « MAM » et « AMJ » | NOAA CPC, https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt |
| `indice_tsa_mars_mai` | Moyenne des valeurs TSA de mars, avril et mai | NOAA PSL, https://psl.noaa.gov/data/correlation/tsa.data |

Vérification : pour 2025, ce calcul donne ONI −0,033 et TSA 0,12, exactement les valeurs du mart.

Quand l'équipe données ajoute l'année dans le mart, la ligne de ce fichier n'est plus utilisée (le mart prime).

Prochaine ligne à ajouter : **2027**, après la publication des valeurs de mai 2027.
