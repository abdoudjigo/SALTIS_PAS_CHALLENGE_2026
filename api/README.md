# API Assaman & Suuf

L'API expose les marts de `SALTIS.MARTS` (Snowflake) pour le front et la BI. Toutes ses réponses sont précalculées et servies depuis un **cache complet** : en mémoire par défaut, ou dans Redis (optionnel).

- Documentation interactive : `http://localhost:8080/docs` (Swagger), `http://localhost:8080/redoc`.
- Contrat des colonnes : [`docs/contrat-donnees.md`](../docs/contrat-donnees.md).
- **Guide pratique** (lancer, arrêter, routes expliquées) : [`docs/guide-api.md`](../docs/guide-api.md).

## Démarrage

```bash
python -m api                         # charge les marts (environ 20 s), puis http://localhost:8080/docs ; Ctrl + C pour arrêter
```

Pas de Docker, pas de commande de préchargement : sans `REDIS_URL`, l'API charge les marts en mémoire à chaque démarrage, et n'accepte les requêtes qu'une fois le chargement terminé. Après un `dbt build`, on redémarre l'API.

Les identifiants Snowflake sont ceux du `.env`, les mêmes que pour dbt. Variables propres à l'API (voir `.env.example`) :

| Variable | Défaut | Rôle |
|---|---|---|
| `API_PORT`, `API_HOST` | `8080`, `127.0.0.1` | Adresse d'écoute de `python -m api` |
| `REDIS_URL` | vide | Redis optionnel (`redis://localhost:6379/0`) ; vide = cache en mémoire |
| `API_ADMIN_TOKEN` | vide | Jeton des routes d'administration ; vide = administration désactivée |
| `SNOWFLAKE_SCHEMA_MARTS` | `MARTS` | Schéma des marts lus |
| `PRECHARGEMENT_AU_DEMARRAGE` | `true` | Précharge au démarrage si le cache est vide |
| `CORS_ORIGINES` | `["*"]` | Origines autorisées (liste JSON) |

## Les routes expliquées

Toutes les routes commencent par `/api/v1`. Chaque réponse a la même forme : `donnees` (le résultat) et `meta` (version, source, filtres, nombre d'éléments, `avertissements`).

### Le code GADM d'un département

La plupart des routes demandent un département par son **code**, pas par son nom. Un nom pose des problèmes (accents : `Kébémer` ou `Kebemer` ? majuscules, espaces), alors qu'un code est unique et s'écrit toujours de la même façon. GADM est la base mondiale des découpages administratifs, et les contours de la future carte utiliseront les mêmes codes.

```
SEN . 7 . 1 _1
 │    │   │
 │    │   └─ département n°1 dans la région
 │    └───── région n°7 (Kolda)
 └────────── Sénégal
```

Les 4 codes proposés dans Swagger (Kolda `SEN.7.1_1`, Dakar `SEN.1.1_1`, Saint-Louis `SEN.10.3_1`, Kaffrine `SEN.4.2_1`) ne sont **que des exemples**. Les 45 codes existent tous : on les obtient avec `GET /api/v1/referentiels/departements`.

### Référentiels : les listes de valeurs valides

Ces routes ne contiennent aucune donnée agricole. Elles disent quelles valeurs on peut utiliser dans les autres routes. Le front s'en sert pour remplir ses menus déroulants.

| Route | Ce qu'elle renvoie |
|---|---|
| `/referentiels/departements` | Les 45 départements : nom, **code**, région, zone agroécologique, **latitude et longitude**, zone secondaire ; s'ils ont un suivi décadaire et un score de vulnérabilité |
| `/referentiels/regions` | Les 14 régions et leur nombre de départements |
| `/referentiels/zones` | Les 6 zones agroécologiques |
| `/referentiels/cultures` | Les 12 cultures, avec leur nom exact (`MIL (SOUNA)`, `MAÏS`…) |
| `/referentiels/periodes` | Les années disponibles (campagnes 1981-2025, suivi décadaire) |

Zone et région sont deux découpages **parallèles** : une région peut s'étendre sur deux zones (Louga, Matam, Tambacounda).

### A · Carte agroclimatique : le bilan de chaque saison

Le mart `MART_CARTE_AGROCLIMAT` contient une ligne par **département × année** (45 × 45 = 2 025 lignes) : pluie de la saison, écart à la normale, démarrage, fin, séquences sèches, alertes, `risque_saison`, vulnérabilité. On le lit de deux façons :

| Route | On donne | On obtient | Usage |
|---|---|---|---|
| `/agroclimat/campagnes/{campagne}` | une **année** (ex. `2024`) | les 45 départements pour cette année | colorier la carte du Sénégal |
| `/agroclimat/departements/{code}` | un **département** | ses 45 années (1981-2025) | tracer la courbe de l'historique d'un département |

`risque_saison` prend 4 valeurs : `normal`, `sécheresse`, `excès de pluie`, `sécheresse et excès de pluie` (les deux alertes la même année).

Chaque ligne porte aussi la **position du département** :

| Colonne | Exemple | Usage |
|---|---|---|
| `latitude`, `longitude` | `12.89`, `-14.94` (Kolda) | Placer le marqueur du département sur la carte (degrés décimaux, WGS 84) |
| `zone_secondaire` | « Niayes (frange côtière) » | Renseignée pour 8 départements de transition entre deux zones (Kébémer, Louga, Saint-Louis…), à afficher dans l'infobulle. **Jamais une clé d'agrégation** : on regroupe toujours par `zone_agroecologique` |

Un seul appel à `/agroclimat/campagnes/2024` suffit donc pour dessiner 45 points colorés selon `risque_saison`. Les contours des 6 zones ne passent pas par l'API : c'est un fichier GeoJSON que le front lit directement (`app/public/geo/zones_agroecologiques.geojson`, propriété `zone_agroecologique`, à comparer en majuscules). Les contours des départements (GADM) sont à venir.

### A · Suivi décadaire : pendant la campagne

L'année est découpée en 36 **décades** (3 par mois : du 1er au 10, du 11 au 20, du 21 à la fin du mois). La saison des pluies correspond aux décades 16 à 30 (de juin à octobre).

```
GET /api/v1/suivi-decadaire/{code}/{annee}?saison_seulement=true
```

- **`code`** et **`annee`** : obligatoires, par exemple `SEN.7.1_1/2025`.
- **`saison_seulement`** (facultatif) : `true` ne garde que les décades 16 à 30.

Chaque ligne compare, décade par décade, **ce qui est tombé** et **ce qui tombe d'habitude** (la normale 1991-2020) :
- `pluie_mm`, `pluie_normale_mm`, et l'écart entre les deux ;
- le cumul depuis juin, comparé au cumul normal : c'est la question « sommes-nous en avance ou en retard ? » ;
- une fourchette : année sèche (1 année sur 5), médiane, année humide (4 années sur 5).

Guédiawaye est absent : la source n'a pas de série pour ce département (erreur 404 `suivi_indisponible`). Pour le **total** d'une saison, on utilise la carte agroclimatique, sans additionner les décades : les deux sont calculés différemment par la source.

### B · Choix des cultures : quelle culture, quel cycle ?

La question : **« Dans mon département, quelle culture et quelle durée de cycle ont le plus de chances de réussir avec la pluie ? »**

```
GET /api/v1/choix-cultures/{code}?culture=mais
```

- **`code`** (obligatoire) : par exemple `SEN.7.1_1` (Kolda).
- **`culture`** (facultatif) : sans ce paramètre, on obtient les 12 cultures. Les accents ne sont pas nécessaires (`mais`, `niebe`).

Pour une culture, chaque ligne est une **option** :

| `type_option` | `option` | Signification |
|---|---|---|
| `CYCLE` | `courte` / `moyenne` / `longue` | Variété hâtive, moyenne ou tardive, de façon générale |
| `VARIETE` | un nom précis | Une variété documentée (il y en a peu aujourd'hui) |

Les colonnes à regarder :
1. **`proba_cycle_couvert_pct`** : **la colonne principale**. Sur 30 ans (1991-2020), combien d'années la saison des pluies a-t-elle duré assez longtemps pour cette option ? À 100 %, c'était le cas chaque année ; à 40 %, seulement 4 années sur 10.
2. **`rang_option`** : 1 désigne la meilleure option du département pour cette culture, d'après la colonne précédente.
3. **`niveau_adequation`** : le verdict en clair, `adaptée`, `à risque` ou `déconseillée`. Deux cas particuliers : `irrigation requise` (riz irrigué, oignon, tomate), parce que la pluie ne suffit pas, et `non évaluée` (manioc), parce que c'est une culture sur plusieurs années.

**La part « eau » est calculée pour chaque cycle.** La source ne calculait la probabilité « eau » que pour le cycle moyen et la recopiait sur les cycles court et long. L'équipe données la recalcule désormais par cycle (méthode FAO, décade par décade) :
- cycle moyen : valeur de la source, inchangée ;
- cycles court et long : valeur du cycle moyen de la source + l'écart calculé entre le cycle et le cycle moyen.

`score_adequation`, `proba_besoin_eau_couvert_pct` et `niveau_adequation` portent ces **valeurs corrigées**. 25 options sur 1 064 changent de niveau : les cycles courts s'améliorent, les cycles longs se dégradent. Pour expliquer ou vérifier le verdict :

| Colonne | Rôle |
|---|---|
| `methode_niveau` | D'où vient le verdict : `FAO décadaire v1, ancrage sur le cycle moyen de la source`, ou `source` (irrigation requise, non évaluée, variétés, Guédiawaye) |
| `nb_annees_calc` | Nombre d'années utilisées par le calcul (28 à 30) |
| `score_adequation_source`, `proba_besoin_eau_couvert_pct_source`, `niveau_adequation_source` | Les valeurs d'origine de la source, pour comparer (« la source disait *à risque*, le calcul par cycle dit *adaptée* ») |
| `note_score` | Précise l'origine de la probabilité « eau » de la ligne |

On compare toujours les options entre elles sur `proba_cycle_couvert_pct` : `rang_option` est calculé sur cette colonne.

Exemple : `/choix-cultures/SEN.7.1_1?culture=mais` renvoie le maïs à Kolda en 3 lignes (court, moyen, long). Si le cycle court est à 100 % et le long à 60 %, le conseil est une variété hâtive.

### C · Besoins en intrants : combien d'engrais et de semences ?

La question : **« De quelle quantité d'engrais et de semences un département a-t-il besoin pour une culture ? »**

Le calcul est simple : **superficie cultivée × dose par hectare**. La dose vient de la zone agroécologique du département. Ce sont des besoins **de référence** (superficies passées), **pas des prévisions** pour la campagne à venir.

| Route | On donne | On obtient |
|---|---|---|
| `/besoins/departements/{code}?culture=` | un département (culture facultative) | une ligne par culture : superficie, besoins en tonnes (N, P2O5, K2O, NPK, urée, DAP, fumier, semences), irrigation |
| `/besoins/totaux?niveau=NATIONAL&culture=` | un niveau : `NATIONAL`, `REGION` ou `ZONE` | les mêmes besoins, additionnés |

Ce qu'il faut savoir pour lire les chiffres :
- **NULL n'est pas 0**. Quand la dose n'est pas connue, le besoin vaut `null` et le libellé indique « dose à saisir ». Un besoin à 0 signifie au contraire un vrai besoin nul (produit absent de la formule).
- **Semences du riz en Casamance** : la dose disponible correspond au riz irrigué repiqué, pas au riz pluvial. Le besoin retenu (`besoin_semences_retenu_t`) est donc exclu et la ligne affiche « non applicable (riz pluvial) ».
- **Irrigation** : un volume n'est donné que si la culture est en « irrigation requise ».
- **Ancienneté** : `reference_anterieure_2015` signale une superficie de référence ancienne.
- **Guédiawaye et Pikine** : une seule ligne, « pas de superficie agricole de référence ».
- **Totaux** : seules les quantités (superficie, tonnes, m³) sont additionnées. Les `null` ne sont pas comptés comme 0 : ils sont écartés et comptés dans `valeurs_manquantes`. Si ce compteur n'est pas à 0, le total est **partiel**.

Exemple : `/besoins/totaux?niveau=REGION&culture=mais` donne le besoin en urée du maïs pour chacune des 14 régions.

### D · AgroDistrib : les critères pour répartir un stock

La question : **« Une ONG ou un service de l'État a un stock d'intrants. Où l'envoyer en priorité ? »** L'API ne fait pas la répartition : elle fournit les **critères** dont l'algorithme aura besoin.

| Route | On donne | On obtient |
|---|---|---|
| `/agrodistrib/territoires?culture=` | une culture (facultative) | une ligne par département × culture **là où la culture existe** (superficie > 0), avec tous les critères |
| `/agrodistrib/agregats?niveau=REGION&culture=` | un niveau : `REGION`, `ZONE` ou `NATIONAL` | les besoins additionnés à ce niveau |

Les critères d'une ligne de `/territoires` :
- **le besoin** : superficie et tonnes, les seules colonnes qui s'additionnent ;
- **le potentiel de gain** : l'écart entre le rendement atteignable et le rendement moyen. C'est une **valeur de zone** (`niveau_source_potentiel = 'ZONE'`) : tous les départements d'une même zone ont la même valeur. Elle sert à classer, jamais à additionner ;
- **la capacité à valoriser l'intrant** : meilleure adéquation climat et cycle, facteur limitant principal ;
- **le sol du département** : pH, texture, réserve en eau, carbone ;
- **la vulnérabilité** du département (voir plus bas).

`besoin_semences_applicable` vaut `false` pour le riz pluvial de Casamance : le besoin en semences de ces lignes n'entre pas dans les totaux.

`/agregats` sert quand le décideur veut répartir par région ou par zone plutôt que par département : le besoin d'une région est la **somme de ses départements**.

### D · Vulnérabilité : quels départements sont les plus fragiles ?

| Route | On obtient |
|---|---|
| `/vulnerabilite` | les 45 départements classés du plus vulnérable (`rang_vulnerabilite` = 1) au moins vulnérable |
| `/vulnerabilite/{code}` | le détail d'un département |

Le score va de 0 à 100 (100 = le plus vulnérable) et mélange deux choses :
- **60 % pour l'aléa sécheresse** : fréquence des alertes, variabilité des pluies, pluie d'une année sèche ;
- **40 % pour la sensibilité des rendements** : variabilité des rendements et tendance (1991-2015).

Le score est **relatif** : il compare les départements entre eux, ce n'est pas une mesure absolue. Il est aussi **indicatif**, car il reste à faire valider par les techniciens. La classe (`classe_vulnerabilite`) découpe le classement en 5 groupes de taille proche. Trois départements n'ont pas de score (`null`, en fin de liste) : Guédiawaye et Pikine, faute de rendements, et Dakar, faute de données suffisantes. Leur aléa sécheresse reste affiché.

### IA · Prévisions : les 4 modèles d'IA

Les résultats des modèles de `ml/` (voir [`ml/MODELES.md`](../ml/MODELES.md)) sont lus dans **`SALTIS.ML`**. **Tant que `SALTIS.ML` n'est pas chargé, l'API les lit directement dans `ml/sorties/*.csv`** (`source_locale.py`) : `python -m api` suffit pour tout servir. S'il n'y a ni table ni fichier, ces routes répondent `404` (`prevision_indisponible`) et les marts restent servis.

| Route | Modèle → bouton | On obtient |
|---|---|---|
| `/previsions/saison/{annee}` | 1 → « La saison qui vient » | les 45 départements : probabilités sèche / normale / humide, pluie prévue et sa fourchette |
| `/previsions/saison/departements/{code}` | 1 | les prévisions d'un département, année par année (1981-2025) |
| `/previsions/annees-semblables/{code}/{annee}?moment=` | 2 → « Comment finira la saison » | les 3 années passées les plus semblables et comment leur saison a fini, à chaque moment (`FIN_MAI` … `FIN_AOUT`) |
| `/previsions/rendement/{code}/{annee}?culture=` | 3 → « Quelle culture » | la fourchette de rendement par culture, aux 4 moments |
| `/previsions/alerte-recolte/{annee}?moment=FIN_JUILLET&culture=` | 3 → « Alerte récolte » | tous les départements, du risque de chute de récolte le plus fort au plus faible |
| `/previsions/semis/departements/{code}?annee=&culture=` | 4 → « Quand semer » | pour chaque décade de semis : les deux risques, le risque total, la décade conseillée. Sans `annee` : année type |
| `/previsions/semis/carte?culture=ARACHIDE&annee=` | 4 | la décade conseillée dans chaque département, pour colorier la carte |
| `/previsions/fiabilite?modele=M1` | tous | la fiabilité de chaque modèle comparée à une prévision simple |

Ce qu'il faut afficher honnêtement (rappelé dans `meta.avertissements`) :
- **modèle 1** : le gain est modeste, donc on affiche toujours les 3 probabilités et la fourchette, jamais une classe seule ;
- **modèle 2** : fiable à partir de `FIN_JUILLET` ; à `FIN_MAI`, ses probabilités sont vides et on affiche celles du modèle 1 ;
- **modèle 3** : une prévision de l'année seulement là où `alerte_fiable` ou `rendement_fiable` est vrai ; ailleurs, c'est la récolte et le risque **habituels** du département. Les lignes `PROJECTION_NON_EVALUEE` (2022-2025) sont invérifiables ;
- **modèle 4** : les seuils (pluie de semis, décade sèche) sont à valider avec les agronomes.

Pour les mettre dans Snowflake (facultatif pour tester) :
1. une fois : exécuter `snowflake/20_ml_resultats.sql` ;
2. `venv/bin/python -m ml.charger_snowflake --confirmer` ;
3. `POST /systeme/cache/rafraichir`, ou redémarrer l'API.

### IA · Voix : poser sa question à voix haute

| Route | On envoie | On obtient |
|---|---|---|
| `POST /voix/texte` | `{texte, code_departement?, annee?}` (français transcrit par le navigateur, ou wolof écrit) | la réponse en français et en wolof, et la vue de la carte |
| `POST /voix/question?code_departement=&annee=` | l'audio brut en wolof (30 s au plus) | la transcription, la réponse, et la réponse parlée en wolof |

La compréhension et les phrases types sont dans `voix/` (`comprendre.py`, `repondre.py`, `nombres.py`) ; les chiffres viennent du cache, jamais d'un texte inventé. Le wolof parlé passe par le Space Hugging Face `VOIX_SPACE`. Mise en ligne et limites : [`voix/README.md`](../voix/README.md).

### Système et cache : l'état de l'API

| Route | Rôle | Jeton |
|---|---|---|
| `GET /systeme/sante` | L'API est-elle prête ? `ok`, ou `503` si le cache n'est pas encore chargé | non |
| `GET /systeme/cache` | Version des données servie, date du chargement, nombre de lignes par mart, colonnes ignorées, versions conservées | non |
| `POST /systeme/cache/rafraichir` | Relit les marts dans Snowflake (après un `dbt build`) et bascule sur la nouvelle version quand elle est prête | oui |
| `POST /systeme/cache/retour-arriere` | Revient à la version précédente des données, instantanément | oui |

Les deux routes `POST` demandent l'en-tête `X-Admin-Token`, égal à `API_ADMIN_TOKEN` du `.env`. Si cette variable est vide, elles sont désactivées (`403`). En mode simple (sans Redis), redémarrer l'API revient au même que `rafraichir`.

Exemple :

```bash
curl -X POST -H "X-Admin-Token: $API_ADMIN_TOKEN" http://localhost:8080/api/v1/systeme/cache/rafraichir
```

### Colonnes ajoutées le 11/11/2026

Les colonnes `latitude`, `longitude`, `zone_secondaire`, `methode_niveau`, `nb_annees_calc` et `*_source` n'existent dans Snowflake qu'après un `dbt build` des commits d'Aby (référentiels d'Ibrahima, couverture en eau des cycles). Tant que `SALTIS.MARTS` n'est pas reconstruit, l'API fonctionne quand même : ces colonnes valent `null`, et l'avertissement du choix des cultures rappelle que la part « eau » des cycles court et long est encore celle du cycle moyen. Après la reconstruction, il suffit de redémarrer l'API (ou d'appeler `rafraichir`).

## Fonctionnement du cache

Avec Redis (optionnel : `docker compose up -d redis`, `REDIS_URL` dans `.env`, `python -m api.cache.prechargement`) :

```
dbt build ──► SALTIS.MARTS ──► préchargement ──► Redis ──► API ──► front
                               (lecture, validation,      (1 GET par requête)
                                5 182 réponses gzip)
```

1. **Préchargement** (`make cache-warm`, `POST /api/v1/systeme/cache/rafraichir`, ou démarrage sur un cache vide) :
   - il lit les 6 marts en une seule connexion ;
   - il **valide chaque ligne** contre les schémas de `schemas/` (types, énumérations) ;
   - il construit toutes les réponses possibles et les écrit sous une nouvelle version.
2. **Bascule atomique** : `saltis:version_active` change en une seule opération. La version précédente est conservée pour un **retour arrière instantané** (`POST /api/v1/systeme/cache/retour-arriere`). Les plus anciennes sont supprimées.
3. **Lecture** : une requête fait un seul `MGET` Redis et renvoie les octets tels quels (gzip si le client l'accepte, ce que font tous les navigateurs). Il n'y a ni SQL ni sérialisation pendant la requête.
4. **HTTP** : l'`ETag` est la version, donc `If-None-Match` donne `304`. `Cache-Control` est réglé avec `stale-while-revalidate`. `X-Cache`, `X-Data-Version`, `Server-Timing` et `X-Temps-Traitement-ms` servent au diagnostic.
5. **Sécurité des données** : un mart hors contrat (colonne manquante, valeur inattendue, mart vide) fait échouer le préchargement, et l'API continue de servir la version en place. Les colonnes nouvelles sont ignorées et signalées dans `GET /api/v1/systeme/cache`.
6. **Repli** : si Redis est injoignable, l'API bascule sur un cache en mémoire du processus et le précharge automatiquement. `rafraichir` retente Redis.
7. **Plusieurs workers** (`make api-prod`) : ils partagent le même Redis. Un verrou garantit un seul préchargement à la fois, et un worker qui démarre sur un cache rempli ne relit pas Snowflake.

Disposition des clés : voir `cache/cles.py`.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `main.py` | Application, CORS, chronométrage, erreurs |
| `config.py` | Paramètres (`.env`) |
| `marts.py` | Registre des tables exposées : marts (`MARTS`, obligatoires) et résultats des modèles (`ML`, facultatifs) |
| `source_snowflake.py` | Lecture des tables (lecture seule, noms de tables issus du registre) |
| `source_locale.py` | Secours : prévisions lues dans `ml/sorties/*.csv` quand `SALTIS.ML` n'est pas chargé |
| `schemas/` | Contrat de chaque mart (Pydantic) : documentation Swagger et validation au préchargement |
| `cache/construction.py` | Validation, agrégats additifs, construction des réponses |
| `cache/stockage.py` | Stockage Redis ou mémoire, versions, verrou |
| `cache/service.py` | Version active, préchargement, repli, retour arrière |
| `cache/prechargement.py` | Commande `python -m api.cache.prechargement [--verifier]` |
| `routes/` | Routes de données et routes système |
| `docs.py`, `static/` | Page Swagger et thème |

## Règles respectées par l'API

- NULL est renvoyé tel quel, jamais remplacé par 0. Aucune clé md5 n'est exposée.
- Les totaux (`/besoins/totaux`, `/agrodistrib/agregats`) ne somment que les colonnes additives. Un NULL est exclu de la somme et compté dans `valeurs_manquantes`, et le total est alors partiel. Les besoins d'une région ou d'une zone sont la somme de ses départements.
- Chaque réponse porte ses limites d'usage dans `meta.avertissements`.
- `MART_ML_PREVISION_PLUIE` (table d'entraînement) n'est pas exposé : on expose ses prévisions (`/previsions`).
- Les résultats des modèles (`SALTIS.ML`) sont facultatifs : leur absence ne bloque jamais les marts.

## Tests

```bash
make test-api       # ou : python -m pytest api/tests -q
make cache-check    # lit et valide les vrais marts sans rien publier
```
