# Modèle 4 — Quand semer

**Bouton dans l'application : « Quand semer »** (agriculteur). Il sert aussi au bouton combiné « Ma parcelle ».

## La question
Pour ma culture, dans mon département : **à quelle décade semer pour courir le moins de risque ?**

Exemple : « À Kaolack, pour l'arachide, semez de préférence en 2e décade de juillet : 5 % de risque. Semer en 1re décade de juin, c'est 36 % de risque de faux départ ; en 2e décade d'août, 95 % de risque que la saison finisse avant la récolte. »

## L'idée
Deux dangers tirent en sens inverse :

| Danger | Quand | Ce que c'est |
|---|---|---|
| **Faux départ** | Semer trop tôt | La pluie de semis tombe, puis une des deux décades suivantes est sèche : les jeunes plants meurent |
| **Fin trop tôt** | Semer trop tard | La saison s'arrête avant que la culture ait fini son cycle |

Risque total = 1 − (1 − risque de faux départ) × (1 − risque de fin trop tôt). Les deux risques sont supposés indépendants.

La **décade conseillée** est celle où le risque total est le plus bas, **parmi les décades où une pluie de semis arrive au moins une année sur deux**, parce qu'on ne peut pas semer sans pluie.

## Les définitions (à valider avec les agronomes)
| Seuil | Valeur | D'où il vient |
|---|---|---|
| Pluie de semis | ≥ 20 mm dans la décade | Seuil agronomique courant |
| Décade sèche | < 10 mm | Définition de la source (colonne `decade_seche`) |
| Faux départ | Une des 2 décades après le semis est sèche | Les 20 premiers jours sont les plus fragiles |
| Fin du cycle qui compte | Cycle moyen de la culture − 20 jours | En fin de cycle (maturité), la plante a peu besoin d'eau |
| Cycle de la culture | Moyenne du cycle court et du cycle long (`DIM_CULTURE`) | Ex. arachide (90 + 120) / 2 = 105 jours |

Décades étudiées : de la 1re décade de juin (16) à la 2e décade d'août (23).

**Limite** : nos données sont décadaires. Une période sèche à cheval sur deux décades est mal vue, et le seuil de 20 mm s'applique à la décade, pas à 1 à 3 jours de pluie comme le veut la définition agronomique stricte.

## Comment il apprend
- **Faux départ** : régression logistique sur tous les départements à la fois. Elle regarde :
  - la décade de semis ;
  - la pluie normale des deux décades suivantes, la variable qui compte le plus ;
  - la latitude, c'est-à-dire le nord ou le sud ;
  - la probabilité de saison sèche du **modèle 1**, connue fin mai : une saison annoncée sèche augmente le risque.
  Mettre tous les départements ensemble est l'intérêt du modèle : un département seul n'a que quelques faux départs en 30 ans, trop peu pour une fréquence fiable.
- **Fin trop tôt** : la date de fin de saison de chaque département (moyenne 1986-2015) et une marge d'erreur commune de ±8,6 jours (écart-type), selon une loi normale. Le modèle 1 a été testé ici : il ne décalait la fin que d'un demi-jour, il n'est pas utilisé.
- Entraînement sur 1986-2015, test sur 2016-2025.

## Est-ce qu'il marche ?
On le compare à la **fréquence passée** de chaque département (1986-2015). Le score de Brier mesure l'erreur sur une probabilité : plus il est bas, mieux c'est.

| Risque | Cas testés (2016-2025) | Fréquence observée | Gain par rapport à la fréquence passée | AUC modèle / référence |
|---|---|---|---|---|
| Faux départ | 2 111 semis | 8,1 % | **+5,5 %** | **0,83** / 0,76 |
| Fin trop tôt | 28 800 cas | 25 % | **+4,3 %** | 0,99 / 0,99 |

- **Faux départ** : le modèle classe nettement mieux les situations à risque que la simple fréquence passée (AUC 0,83 contre 0,76).
- **Fin trop tôt** : le gain vient du lissage de la loi normale. L'AUC très élevée ne prouve rien : elle est facile à obtenir, puisque semer en juin ou en août change tout. Le gain de Brier est le vrai chiffre.

## Ce qu'il produit
`ml/sorties/risque_semis.csv`, une ligne par département × année × culture × décade de semis (30 976 lignes) :
- 44 départements (Guédiawaye n'a pas de pluie décadaire) ;
- 8 cultures pluviales (arachide, coton, maïs, mil, niébé, pastèque, sésame, sorgho) ;
- 8 décades ;
- les années 2016-2025, plus une **année type** (`ANNEE_TYPE`, année sans prévision particulière).

| Colonne | Contenu |
|---|---|
| `code_departement`, `departement`, `annee`, `type_prevision` | `RETROSPECTIVE_TEST` (2016-2025) ou `ANNEE_TYPE` (`annee` vide) |
| `culture`, `cycle_jours` | La culture et son cycle moyen |
| `decade_semis`, `libelle_decade` | 16 à 23, « 2e décade de juillet » |
| `chance_pluie_semis_pct` | Part des années (1986-2015) avec une pluie de semis à cette décade |
| `risque_faux_depart_pct`, `risque_fin_trop_tot_pct`, `risque_total_pct` | Les risques |
| `decade_conseillee` | Vrai pour la décade la plus sûre (une par département × année × culture) |
| `proba_saison_seche_m1_pct` | La prévision du modèle 1 utilisée |
| `version_modele`, `date_calcul` | Traçabilité |

Plus `ml/sorties/evaluation_m4.csv` : le tableau de fiabilité ci-dessus.

## Ce qu'on voit dans les résultats (année type)
| Culture | Décade conseillée la plus fréquente |
|---|---|
| Arachide, maïs, sorgho, sésame | 2e décade de juillet |
| Mil | 2e ou 3e décade de juillet |
| Niébé (cycle court) | 1re ou 2e décade d'août |
| Coton (cycle long) | Variable : dès juin dans le sud |

Dans le nord, même la meilleure décade reste risquée (Podor, mil : 39 %). Le modèle le montre au lieu de le cacher.

## Dans l'application
- **Fenêtre** : une frise des 8 décades, chacune colorée du vert (risque faible) au rouge. La décade conseillée est marquée. Au survol, les deux risques et la chance de pluie. La phrase : « Semez de préférence en 2e décade de juillet : 5 % de risque. »
- **Carte** : pour la culture choisie, chaque département coloré selon sa décade conseillée. On voit le semis remonter du sud vers le nord.
- **Méthode**, repliée : les définitions, les seuils « à valider avec les agronomes », le tableau de fiabilité.

## Relancer
```bash
venv/bin/python -m ml.m1_prevision_saison.entrainer   # d'abord : le modèle 4 utilise sa sortie
venv/bin/python -m ml.m4_date_semis.entrainer
```
