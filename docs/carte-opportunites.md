# Carte des opportunités — pluie et eau

Une seule carte, trois couleurs, deux publics.

| Couleur | Ce que la carte dit | Pour l'agriculteur | Pour l'investisseur |
|---|---|---|---|
| 🟨 **jaune** | Saison des pluies courte | Semer des variétés à cycle court | — |
| 🟩 **vert** | Saison des pluies longue | Un cycle long passe 4 années sur 5 | — |
| 🟦 **bleu** | De l'eau reste disponible en saison sèche et elle est peu exploitée | Cultiver aussi en contre-saison | Aménager un périmètre, forer, installer du maraîchage |

Les deux idées de départ, irrigation et zones à investir, sont **la même question** : où y a-t-il de l'eau en saison sèche que personne n'utilise encore ? Une zone bleue est une chance pour l'agriculteur, qui peut produire toute l'année, et pour l'investisseur, qui peut aménager.

---

## 1. La valeur ajoutée : ce que cette carte apporte de nouveau

**Avant**, la plateforme répondait à « que semer pendant l'hivernage ? » (module B). Elle ne disait rien de la saison sèche, alors que c'est là que se jouent les revenus de contre-saison (oignon, tomate, riz) et les décisions d'investissement.

**Maintenant**, pour chacun des 45 départements, on obtient :

1. **Une décision de semis lisible en une couleur.** Le jaune et le vert ne sont pas une nouvelle règle : ils reprennent exactement les probabilités de l'écran *Choix des cultures*. L'utilisateur ne voit jamais deux chiffres contradictoires. Le champ `cycle_max_conseille_j` dit jusqu'à combien de jours on peut aller, et `varietes_conseillees` nomme les variétés.
2. **Un chiffre d'investissement concret : des hectares.** `potentiel_contre_saison_ha` compte les terres cultivables à moins de 2 km d'une eau présente au moins 10 mois sur 12, et **encore nues en saison sèche**. Ce n'est pas un score abstrait : c'est une surface qu'un bailleur, une ONG ou un service de l'État peut comparer à un coût d'aménagement.
3. **Un classement des opportunités** (`rang_opportunite_eau`). L'eau de surface peu exploitée passe en premier, la nappe accessible par forage ensuite.
4. **Le repérage de ce qui est déjà pris.** Quand l'eau est déjà exploitée (`eau de surface déjà exploitée`), le département n'est **pas** peint en bleu. On évite ainsi d'envoyer un investisseur là où la place est prise.
5. **Des phrases prêtes à dire.** `conseil_agriculteur` et `conseil_investisseur` sont écrits en français simple. L'assistant vocal peut les lire en wolof sans autre calcul.

**Qui s'en sert, pour quelle décision :**

| Utilisateur | Question | Réponse de la carte |
|---|---|---|
| Producteur, conseiller ANCAR | Quelle durée de cycle semer ? | Jaune ou vert, avec le cycle maximal et les variétés |
| Producteur, coopérative | Puis-je produire en saison sèche ? | Bleu, avec le type d'eau (surface ou nappe) |
| Bailleur, banque agricole, investisseur | Où aménager ? Combien d'hectares ? | Zones bleues classées, avec les hectares et la profondeur de la nappe |
| État, ONG (AgroDistrib) | Où cibler les semences à cycle court ou le matériel d'irrigation ? | Filtre par couleur, colonne `couleur_carte` |

---

## 2. Le circuit complet

```
 Sources publiques                Préparation               Snowflake              dbt                      API
 ─────────────────                ───────────               ─────────              ───                      ───
 BGS (nappes, 5 km)       ─┐
 FAO GMIA (irrigation)     ├─ preparer_eau.py ──┐
 GADM (contours)          ─┘                    ├─ charger_snowflake.py ─► RAW.E_* ─► stg_eau_* ─► fact_eau_departement ─┐
 JRC + ESA + MODIS ─────── gee_eau_surface.js ──┘                                                                     ├─► mart_carte_opportunites ─► cache Redis ─► GET /api/v1/opportunites
                                                          RAW (profil) ─► stg_profil ───────────────────────────────┤
                                                          MARTS ─► mart_choix_cultures (module B) ──────────────────┘
```

La règle du projet est respectée : **rien n'arrive à l'API sans passer par Snowflake.** Les sources lourdes (grilles, images satellite) sont ramenées à **une ligne par département avant Snowflake**, et seuls ces petits fichiers y sont chargés.

**Bonne nouvelle : le jaune et le vert fonctionnent dès maintenant.** Ils n'utilisent que des données déjà présentes dans Snowflake. La couche bleue s'allume une fois les données eau chargées (étapes 1 à 3).

---

## 3. Les étapes une par une

### Étape 0 — Construire le mart tout de suite (jaune et vert)

- **Rôle** : produire la carte avec ce qu'on a déjà.
- **Pourquoi** : la carte apporte de la valeur sans attendre les sources eau, et l'API peut l'exposer dès aujourd'hui.
- **Comment** :
  ```powershell
  .\dbt.ps1 build --profiles-dir . --target snowflake --select mart_carte_opportunites
  ```
  Puis rafraîchir le cache de l'API (étape 5). Tant que l'eau n'est pas chargée, `categorie_eau` vaut `non évaluée`, aucune zone n'est bleue, et la réponse de l'API le signale dans `meta.avertissements`.

### Étape 1 — Récupérer et préparer les données eau

**1a. Nappes et irrigation : `ingestion/collecte/eau/preparer_eau.py`**

- **Rôle** : télécharger les grilles, puis calculer pour chaque département la profondeur de la nappe, le débit d'un forage et la surface déjà irriguée.
- **Pourquoi** : ces sources couvrent l'Afrique ou le monde entier, en grilles de 5 à 9 km. L'API et dbt raisonnent par département. Le script fait ce passage une fois pour toutes, sans nouvelle bibliothèque : seulement numpy et pandas, déjà présentes dans le projet.
- **Comment** :
  1. Télécharger à la main les cartes BGS. Elles n'ont pas de lien direct stable. Sur la [page BGS](https://www.bgs.ac.uk/groundwater/?p=5887), prendre les fichiers « XYZ ASCII » de *depth to groundwater*, *groundwater productivity* et *groundwater storage*. Les déposer **sans les renommer** dans `data/raw/eau/bgs/`.
  2. Lancer :
     ```bash
     venv/bin/python -m ingestion.collecte.eau.preparer_eau
     ```
     Le script télécharge lui-même les contours GADM et les 5 grilles FAO GMIA dans `data/raw/eau/`, puis écrit `data/modules/e_eau_souterraine_departement.csv` et `data/modules/e_irrigation_departement.csv`.
  3. Contrôler les deux lignes affichées en fin de script. Le total irrigué doit être de l'ordre de **120 000 ha** pour le Sénégal (chiffre AQUASTAT).
- **Méthode** : un point de grille appartient au département dont le contour le contient. Dakar, Guédiawaye et Pikine sont trop petits pour contenir un point. Ils reçoivent le point le plus proche de leur centre, et la colonne `point_le_plus_proche` le signale.

**1b. Eau de surface et terres proches : `ingestion/collecte/eau/gee_eau_surface.js`**

- **Rôle** : mesurer l'eau présente en saison sèche, les terres cultivables à moins de 2 km et la part déjà verte (donc exploitée) en février-avril.
- **Pourquoi** : c'est le cœur de la valeur investisseur. L'eau est cartographiée à 30 m, ce qui fait plus de 200 millions de pixels pour le Sénégal. Google Earth Engine fait ce calcul gratuitement à côté des données, et on n'exporte que 45 lignes.
- **Comment** :
  1. Dans [Earth Engine](https://code.earthengine.google.com), importer les contours GADM niveau 2 comme *table* (Assets → New → Shape files, fichiers `gadm41_SEN_2.*` de `gadm41_SEN_shp.zip`).
  2. Coller le script, remplacer le chemin `projects/VOTRE_PROJET/assets/gadm41_SEN_2`, cliquer sur **Run**. Vérifier les trois couches sur la carte : eau en bleu, terres non exploitées en orange, terres déjà vertes en vert.
  3. Onglet **Tasks** → **Run**. Le CSV arrive dans Google Drive : le copier dans `data/modules/e_eau_surface_departement.csv`.

| Donnée | Source | Pourquoi celle-là |
|---|---|---|
| Eau présente 10 mois sur 12 | JRC Global Surface Water v1.4 (Landsat, 30 m) | Seule carte mondiale qui donne le **nombre de mois** avec de l'eau |
| Terres cultivables | ESA WorldCover 2021 (10 m) | Exclut le bâti, les arbres, les mangroves et le sol nu (souvent des tannes salées) |
| Végétation en saison sèche | MODIS MOD13Q1 (250 m), février-avril 2021-2024 | Une parcelle verte en saison sèche est irriguée ou exploitée |

### Étape 2 — Créer les tables RAW (une seule fois)

- **Rôle** : préparer l'emplacement des données dans Snowflake.
- **Pourquoi** : comme `10_geo_departements.sql` et `20_ml_resultats.sql`, les tables sont créées à la main, avec un commentaire sur chaque colonne. dbt les lit et ne les modifie jamais.
- **Comment** : exécuter `snowflake/30_eau_raw.sql` dans Snowsight.

### Étape 3 — Charger les trois fichiers dans `SALTIS.RAW`

- **Rôle** : déposer les CSV dans `RAW.E_EAU_SOUTERRAINE_DEPARTEMENT`, `RAW.E_IRRIGATION_DEPARTEMENT` et `RAW.E_EAU_SURFACE_DEPARTEMENT`.
- **Pourquoi un script** : il **vérifie avant d'écrire**, puis vide et remplit chaque table. Il contrôle les 45 départements, les codes GADM connus, les colonnes identiques à la table et les pourcentages entre 0 et 100. Une table ne mélange donc jamais deux préparations.
- **Comment** :
  ```bash
  venv/bin/python -m ingestion.collecte.eau.charger_snowflake             # vérification, rien n'est écrit
  venv/bin/python -m ingestion.collecte.eau.charger_snowflake --confirmer # chargement
  ```

### Étape 4 — Transformer avec dbt

- **Rôle** : passer des données brutes à l'écran.
- **Pourquoi** : on suit les couches du projet. Le staging nettoie, le fait calcule les indicateurs, le mart prépare l'écran à plat pour l'API.
- **Comment** :
  1. Dans `dbt/dbt_project.yml`, passer `eau_chargee: true`.
  2. Lancer :
     ```powershell
     .\dbt.ps1 build --profiles-dir . --target snowflake --select +mart_carte_opportunites
     ```

| Modèle | Rôle |
|---|---|
| `stg_eau_souterraine`, `stg_irrigation`, `stg_eau_surface` | Lecture des tables RAW (désactivés tant que `eau_chargee` vaut `false`) |
| `fact_eau_departement` | Une ligne par département : surfaces, nappe, irrigation, et deux indicateurs (`eau_surface_mobilisable`, `nappe_accessible`) |
| `mart_carte_opportunites` | Couleurs, classement, hectares, conseils ; s'appuie aussi sur `mart_choix_cultures` (module B) et le profil agroclimatique |

Tests ajoutés : unicité et non-nullité des clés, valeurs autorisées pour chaque couleur et catégorie, et un test métier (`tests/mart_carte_opportunites_valeurs_valides.sql`) qui contrôle :
- les 45 départements ;
- bleu si et seulement si `couche_eau` ;
- un rang seulement en zone bleue ;
- le fond cohérent avec la saison ;
- des surfaces et des pourcentages plausibles.

### Étape 5 — Exposer dans l'API

- **Rôle** : servir la carte au front et à l'assistant vocal.
- **Pourquoi** : l'API ne lit jamais Snowflake pendant une requête. Le mart est lu au préchargement, transformé en réponses JSON prêtes à servir et rangé dans Redis, comme tous les autres écrans. Le mart est déclaré **facultatif** : l'API démarre même s'il n'est pas encore construit, et ses routes répondent alors `404 opportunites_indisponible`.
- **Comment** : après `dbt build`, appeler `POST /api/v1/systeme/cache/rafraichir` (jeton d'administration) ou redémarrer l'API.

| Route | On obtient |
|---|---|
| `GET /api/v1/opportunites` | Les 45 départements, avec leur couleur et leurs conseils |
| `GET /api/v1/opportunites?couleur=bleu` | Les opportunités eau seulement, **classées** (`rang_opportunite_eau` = 1 en tête) |
| `GET /api/v1/opportunites?couleur=jaune` (ou `vert`) | Les départements à saison courte (ou longue) |
| `GET /api/v1/opportunites/{code_departement}` | Le détail d'un département |

Fichiers modifiés :
- `api/schemas/opportunites.py` (contrat de la réponse) ;
- `api/marts.py` (registre) ;
- `api/cache/cles.py` et `api/cache/construction.py` (réponses précalculées) ;
- `api/routes/opportunites.py` (routes) ;
- `api/docs.py` (documentation Swagger) ;
- `api/tests/test_opportunites.py` (tests).

### Étape 6 — Afficher (prochaine étape, côté front)

Ajouter `opportunites: (couleur?) => appel('/opportunites', { params: { couleur } })` dans `app/src/api/index.ts`, puis peindre `couleur_carte` sur le fond de carte existant (`CarteSenegal`). Le détail du département affiche `conseil_agriculteur`, et l'onglet « Investir » liste `?couleur=bleu`.

---

## 4. Règles de décision et seuils

Tous les seuils sont des variables dbt (`dbt_project.yml`). Ils sont **à valider avec les techniciens** (ANCAR pour les cycles ; SAED et DGPRE pour l'eau).

| Règle | Seuil | Raison |
|---|---|---|
| Saison **longue** (vert) si un cycle d'au moins `seuil_cycle_long_j` passe 4 années sur 5 | 110 jours | Les variétés tardives d'arachide, de maïs ou de sorgho vont d'environ 110 à 130 jours |
| « Passe 4 années sur 5 » | `proba_cycle_couvert_pct` ≥ 80 | Même seuil que l'écran *Choix des cultures* (« adaptée ») |
| Eau de surface mobilisable | `seuil_surface_inexploitee_ha` = 200 ha | Seuil de départ pour un aménagement collectif, à calibrer avec la SAED |
| Eau proche | 2 km | Distance d'un pompage et d'un réseau simples |
| Eau en saison sèche | présente au moins 10 mois sur 12 | Encore là de février à mai |
| Parcelle exploitée en saison sèche | NDVI ≥ 0,3 | Un sol nu ou une savane sèche reste en général sous 0,2 |
| Eau déjà exploitée | `seuil_exploitation_forte_pct` = 50 % | Au-delà, la marge d'extension est faible |
| Nappe accessible | ≤ 25 m **et** ≥ 1 L/s, sur `seuil_part_nappe_accessible_pct` = 25 % du département | 1 L/s pompé 10 h par jour donne environ 36 m³, de quoi arroser un demi-hectare de maraîchage ; à 25 m, un puits ou un petit forage suffit |

Ordre de décision de la couleur :
1. eau de surface mobilisable et peu exploitée → **bleu** ;
2. sinon nappe accessible → **bleu** ;
3. sinon → **jaune** ou **vert** selon la saison.

---

## 5. Limites, à dire franchement

- **C'est un repérage, pas une étude de faisabilité.** Avant tout investissement, il faut vérifier sur place le foncier, la salinité (tannes du Saloum et de la Casamance), la qualité de l'eau et l'accès.
- **Les hectares sont bruts.** Une terre nue à 2 km de l'eau peut être une réserve, un parcours pastoral ou un terrain litigieux.
- **Les nappes BGS sont continentales** (échelle 1:20 millions). Elles donnent un ordre de grandeur par département, pas l'emplacement d'un forage.
- **L'irrigation FAO date d'environ 2005.** Elle sert à repérer l'eau déjà mobilisée. La végétation de saison sèche (MODIS 2021-2024) est plus récente et c'est elle qui décide de « déjà exploitée ».
- **L'eau du JRC s'arrête en 2021.** Les retenues récentes, comme les bassins de rétention, peuvent manquer.
- **Licences et citations** : BGS (« Based upon mapping provided by British Geological Survey © NERC 2012 »), GADM (usage non commercial, citation), FAO, JRC/Copernicus, ESA WorldCover et MODIS (libres, citation).

---

## 6. Sources

- BGS — [Quantitative groundwater maps for Africa](https://www.bgs.ac.uk/groundwater/?p=5887) (MacDonald et al., 2012, *Environmental Research Letters*)
- FAO AQUASTAT — [Global Map of Irrigation Areas v5](https://www.fao.org/aquastat/en/geospatial-information/global-maps-irrigated-areas/latest-version/index.html)
- JRC — [Global Surface Water v1.4](https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater) (Pekel et al., 2016, *Nature*)
- ESA — WorldCover 2021 v200 ; NASA — MODIS MOD13Q1 v061
- GADM — version 4.1, niveau 2

---

## 7. État au 17/11/2026

| Partie | État |
|---|---|
| Fond jaune / vert (`mart_carte_opportunites`) | En production dans `SALTIS.MARTS` : 45 départements, 16 verts, 29 jaunes, tests dbt au vert |
| API `/api/v1/opportunites` | En service : filtre `?couleur=`, détail `/{code}`, 89 tests pytest au vert |
| Couche bleue (eau) | Code prêt ; en attente des données (étapes 1 à 4) puis de `eau_chargee: true` |
| Front | À faire (étape 6) |

Vérification : `python -m api`, puis `curl "http://127.0.0.1:8080/api/v1/opportunites?couleur=vert"`.
