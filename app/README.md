# Front — Assaman & Suuf

Application web (PWA installable) de la plateforme. Une **landing** présente le projet ; deux portes (**Agriculteur**, **ONG et services de l'État**) ouvrent la **scène** : une carte plein écran du Sénégal, pilotée par un dock de fonctionnalités, nourrie par l'API (`python -m api`) et les modèles d'IA (`ml/`). Cahier des charges : [`docs/v1-cahier-des-charges.md`](../docs/v1-cahier-des-charges.md).

| Élément | Choix |
|---|---|
| Framework | React 19 + Vite 8, **TypeScript** strict |
| Style | Tailwind CSS 4 (thème « Ciel & Terre » dans `src/index.css`) ; polices IBM Plex Sans et Source Serif 4, auto-hébergées |
| Carte | Mapbox GL 3 (style Standard : globe, volumes 3D, arcs) |
| Données | TanStack Query |
| PWA | `vite-plugin-pwa` (installation, cache hors ligne, mise à jour proposée) |
| Routage | React Router 7, un fichier JS par page (chargement à la demande) |

## 1. Démarrage local

Prérequis : Node.js **20.19 ou plus** (`node -v`).

```bash
cd app
npm ci                         # dépendances (package-lock.json)
cp .env.example .env.local     # configuration locale, jamais commitée
npm run dev                    # http://localhost:5173
```

Ou depuis la racine : `make front-install` puis `make front`.

Pour les vraies données, lancer aussi l'API depuis la racine : `venv/bin/python -m api` (port 8080). Elle sert les marts de Snowflake et les prévisions des modèles (`ml/sorties/`).

On entre dans la scène par une des deux portes de la landing : **Agriculteur**, ou **ONG et services de l'État**. Pas de compte à créer.

### Variables d'environnement (`app/.env.local`)

| Variable | Rôle | Exemple |
|---|---|---|
| `VITE_API_URL` | URL de l'API FastAPI, sans `/` final | `http://localhost:8080` |
| `VITE_USE_MOCK` | `true` = données d'exemple, `false` = vraie API | `true` |
| `VITE_AUTH_DEMO`, `VITE_DONNEES_DEMO` | Réglages séparés, facultatifs (chacun vaut `VITE_USE_MOCK` par défaut). Site déployé sans back d'authentification : `VITE_AUTH_DEMO=true` (comptes de démonstration) et `VITE_DONNEES_DEMO=false` (données de l'API) | `true`, `false` |
| `VITE_MAPBOX_TOKEN` | Token **public** Mapbox (`pk.…`). Vide = carte simplifiée sans fond | `pk.eyJ…` |
| `VITE_MAPBOX_STYLE` | Style Mapbox (facultatif) | `mapbox://styles/mapbox/light-v11` |
| `VITE_UMAMI_ID` | Mesure d'audience : identifiant du site dans Umami (public). Vide = aucune mesure et pas de bandeau cookies ; voir `deploy/README.md`, section 7 | — |
| `EMAIL_CONTACT` | Adresse de contact des pages publiques (Contact, Confidentialité). Sans préfixe `VITE_` : codée au build et affichée seulement au clic (anti-spam). Vide = « bientôt » | `contact@exemple.sn` |
| `VITE_LIEN_LINKEDIN`, `VITE_LIEN_FACEBOOK`, `VITE_LIEN_X`, `VITE_LIEN_YOUTUBE` | Réseaux sociaux du pied de page. Vide = affiché « bientôt » | `https://…` |

`VITE_URL_SITE` (adresse publique, ex. `https://assaman-suuf.com`) sert aux aperçus de partage et au plan du site (`sitemap.xml` et `robots.txt`, écrits au build ; liste des pages : `src/lib/pages.ts`) ; en production elle est déduite de `DOMAINE`. Toute nouvelle page passe par `PageSite` (ou `useMeta` de `src/lib/meta.ts`) avec une `description` de 120 à 160 caractères.

Les variables `VITE_*` sont **lisibles dans le navigateur** : n'y mettre aucun secret (ni mot de passe Snowflake, ni clé privée). Le `MAPBOX_TOKEN` du `.env` racine n'est pas lu par Vite : le recopier dans `app/.env.local` sous le nom `VITE_MAPBOX_TOKEN`.

### Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement avec rechargement instantané |
| `npm run lint` | ESLint (règles TypeScript) |
| `npm run typecheck` | Vérification des types (`tsc`), sans build |
| `npm run build` | Vérification des types puis build de production dans `dist/` (service worker PWA compris) |
| `npm run preview` | Sert `dist/` sur `http://localhost:4173` (pour tester la PWA et le hors ligne) |
| `npm run icons` | Régénère les icônes PNG depuis le dessin de `public/favicon.svg` (Python + Pillow) |
| `npm run images` | Compresse les PNG de `public/` (palette de 256 couleurs, sans bande visible) ; à relancer après tout nouveau PNG |

Le job `front` du CI (`.github/workflows/ci.yml`) lance `lint` et `build` (donc la vérification des types) à chaque push.

---

## 2. Structure

```text
app/
├── public/                 logo (logo.svg, favicon.svg), icônes PWA, geo/ (contours GADM et zones)
├── src/
│   ├── pages/
│   │   ├── Landing.tsx     la landing : globe, récit (zones, ciel, terre, décision), deux portes, sources
│   │   ├── Scene.tsx       la scène : carte plein écran + dock + fenêtre de résultats
│   │   └── site/           pages du site : À propos, Méthode, Données, Contact, Mentions légales, Politique de confidentialité, Conditions générales, page introuvable
│   ├── consentement/       bandeau cookies et choix du visiteur (mesure d'audience facultative)
│   ├── landing/            en-tête « île », pied de page, portes, bandeau des sources de données
│   ├── scene/              moteur de carte (Carte.tsx), dock, fenêtre, briques d'interface (ui.tsx), couleurs
│   │   └── modes/          une fonctionnalité du dock par fichier
│   ├── api/
│   │   ├── index.ts        SEUL point d'entrée des données (une fonction typée par route de l'API)
│   │   ├── client.ts       fetch + délai + erreurs → messages lisibles
│   │   └── mock/           profils d'entrée, référentiel des intrants, stocks de démonstration (Répartir un stock)
│   ├── auth/               session locale du profil choisi, route protégée de la scène
│   ├── hooks/              requêtes TanStack Query (marts et prévisions)
│   ├── lib/                formatage (NULL → « non disponible », jamais 0), mode léger
│   └── types/              types des marts et des prévisions
└── vite.config.ts          PWA, découpage des bundles, cache hors ligne
```

### Les pages
| Adresse | Page |
|---|---|
| `/` | Landing (visiteur) ou scène (après le choix d'une porte) |
| `/a-propos` | Le défi, ce que fait la plateforme, nos principes, l'équipe |
| `/methode` | Les modèles d'IA et leur fiabilité mesurée |
| `/donnees` | Les sources, leur préparation, les limites, les licences |
| `/contact` | Adresse (`EMAIL_CONTACT`, affichée au clic) et réseaux (`config.reseaux`) |
| `/mentions-legales` | Éditeur, portée des estimations, crédits |
| `/conditions-generales` | Conditions générales d'utilisation : accès, estimations indicatives, usage, contenus, responsabilité |
| `/confidentialite` | Politique de confidentialité : données traitées, stockage local, services tiers, droits |

### Entrer dans la scène
Pas de compte ni de mot de passe : chaque porte ouvre un **profil** (`src/api/mock/comptes.ts`), sans nom de personne. La session reste dans le navigateur ; l'API n'a pas de comptes.

### Les fonctionnalités du dock
| Profil | Boutons |
|---|---|
| Agriculteur | Ma parcelle, La saison qui vient, Quand semer, Quelle culture, Mes besoins |
| ONG et services de l'État | Préparer la campagne, La saison qui vient, Alerte récolte, Vulnérabilité, Besoins du pays, Répartir un stock |

Partout : l'année se **tape** à partir de 2026 (prévision) ou se **choisit** dans la liste des années passées (vérification). Le détail de chaque résultat est replié derrière « Voir le détail ».

Règles du contrat de données appliquées dans l'interface :

- une valeur NULL s'affiche « non disponible » ou « dose à saisir », **jamais 0** ;
- produits (NPK, urée, DAP) et éléments (N, P₂O₅, K₂O) ne sont jamais affichés dans un même total ;
- vulnérabilité affichée comme **relative et indicative** ;
- chaque prévision dit d'où elle vient (océan ou tendance) et sa fiabilité.

### Les deux mascottes (scène)
Chaque fenêtre de résultats a deux mascottes : le garçon **FR** lit l'essentiel en français (synthèse du navigateur, `src/scene/lecture.ts`), la fille **WLF** le lit en wolof (texte préparé dans `aEcouterWo`, voix du Space Hugging Face). Détail : [`voix/README.md`](../voix/README.md).

### Bandeau des sources (landing)
`src/landing/Sources.tsx` : les sources défilent (pause au survol, arrêt si « réduire les animations »). Chaque source est une signature typographique. Pour afficher un logo officiel, déposer le fichier dans `public/logos/` et renseigner `logo` dans la liste, **avec l'accord de l'organisme** (les logos sont des marques).

### Carte et contours GADM

Sans contours, chaque département est un point (chef-lieu approximatif du référentiel d'exemple). Dès que le fichier `app/public/geo/departements.geojson` existe (GADM 4.1 niveau 2 simplifié, propriété `GID_2` = `code_departement`), la carte passe seule en aplats colorés par département et affiche la citation « GADM, version 4.1 » (licence non commerciale).

Simplification conseillée (garde un fichier léger, < 300 Ko) :

```bash
npx mapshaper gadm41_SEN_2.json -simplify 8% keep-shapes -filter-fields GID_2,NAME_2 -o format=geojson precision=0.0001 app/public/geo/departements.geojson
```

Avec la vraie API, les coordonnées viendront de `/referentiels` (`dim_geographie.latitude` / `longitude` quand `geo_departements_charge` sera activé).

### PWA et fluidité

- installation sur l'écran d'accueil (Android, iOS, ordinateur), thème vert, icônes dans `public/` ;
- l'app et les données déjà consultées restent disponibles **hors ligne** (réseau d'abord, cache si la connexion tombe : utile sur le terrain) ; un bandeau signale le mode hors ligne ;
- Mapbox (~525 Ko compressés) n'est téléchargé qu'à l'ouverture d'une carte, puis mis en cache ;
- chaque écran est un petit fichier chargé à la demande ; les données sont mises en cache 1 h et préchargées au survol du menu ;
- squelettes de chargement au lieu d'écrans blancs ; l'écran précédent reste affiché pendant le changement d'année ou de département ;
- une nouvelle version déployée est **proposée** (bouton « Mettre à jour »), jamais imposée pendant une saisie.

---

## 3. Contrat d'API attendu (pour l'équipe API)

Le front appelle uniquement les routes ci-dessous (`src/api/index.ts`) ; les formats exacts sont les types de `src/types/`. Les réponses reprennent **les noms de colonnes des marts, en minuscules**, sans clé md5. Le faux serveur `src/api/mock/serveur.ts` sert de référence exécutable des formats.

| Méthode et route | Accès | Source | Réponse |
|---|---|---|---|
| `POST /auth/login` `{email, password}` | public | PostgreSQL | `{access_token, token_type: "bearer", user}` |
| `POST /auth/register` `{nom, email, password, code_departement}` | public | PostgreSQL | idem ; crée un compte `PRODUCTEUR` uniquement |
| `GET /auth/me` | connecté | PostgreSQL | `user` |
| `GET /referentiels` | public | `dim_geographie`, `dim_zone_agroecologique`, `dim_culture`, `dim_intrant`, `dim_variete` | `{departements, zones, cultures, intrants, varietes, campagnes}` |
| `GET /carte?campagne=2025` | connecté | `MART_CARTE_AGROCLIMAT` | lignes de la campagne (45) |
| `GET /carte/{code_departement}/historique` | connecté | `MART_CARTE_AGROCLIMAT` | toutes les campagnes du département |
| `GET /suivi/{code_departement}?annee=2025` | connecté | `MART_SUIVI_DECADAIRE` | 36 décades (liste vide pour Guédiawaye) |
| `GET /choix-cultures/{code_departement}` | connecté | `MART_CHOIX_CULTURES` | options du département |
| `GET /varietes/adequation` | connecté | `MART_CHOIX_CULTURES` (`type_option = 'VARIETE'`) | 90 lignes (45 départements × variétés évaluées) |
| `GET /besoins?code_departement=&culture=` | connecté | `MART_BESOINS` | lignes filtrées (filtres facultatifs) |
| `GET /vulnerabilite` | connecté | `MART_VULNERABILITE_DEPARTEMENT` | 45 lignes |
| `GET /agrodistrib/territoires?culture=` | ONG, État, admin | `MART_TERRITOIRES_AGRODISTRIB` | lignes filtrées |
| `GET` / `PUT /organisations/moi/stocks` | ONG, État | `SALTIS.APP` | `[{code_intrant, quantite_t, campagne}]` |
| `GET` / `PUT /organisations/moi/offre-semences` | association de semenciers | `SALTIS.APP` | `[{variete, culture, quantite_t, campagne, zones_couvertes}]` |
| `GET /agrodistrib/scenarios` | ONG, État | `SALTIS.APP` | scénarios de l'organisation |
| `POST /agrodistrib/scenarios` | ONG, État | algorithme de répartition | scénario (voir ci-dessous) |
| `PUT /agrodistrib/scenarios/{id}/validation` `{quantites: {code_territoire: t}}` | ONG, État | `SALTIS.APP` | scénario validé |
| `DELETE /agrodistrib/scenarios/{id}` | ONG, État | `SALTIS.APP` | 204 |

Objet `user` : `{id, email, nom, role, organisation: {id, nom, type} | null, code_departement | null}` avec `role` ∈ `PRODUCTEUR`, `CONSEILLER`, `ORGANISATION`, `ADMIN` et `type` ∈ `ONG`, `ETAT`, `SEMENCIER`.

Paramètres d'un scénario (`POST`) : `{code_intrant, quantite_t, campagne, niveau_destination: ZONE|REGION|DEPARTEMENT, cultures: [..], poids_vulnerabilite: 0-100}`.
Réponse : `{id, statut: PROPOSE|VALIDE, campagne, code_intrant, nom_intrant, quantite_t, niveau_destination, methode, version_algorithme, parametres, besoin_total_t, total_propose_t, reste_non_reparti_t, nb_couples_sans_dose, propositions: [{niveau_destination, code_territoire, territoire, nb_departements, besoin_t, quantite_proposee_t, quantite_validee_t, taux_couverture_pct, vulnerabilite_moyenne}]}`.

Conventions :

- authentification par en-tête `Authorization: Bearer <jeton>` (JWT signé côté API, mots de passe hachés en bcrypt ou argon2) ; un jeton invalide ou expiré renvoie **401** (le front déconnecte alors l'utilisateur) ; un rôle insuffisant renvoie **403** ;
- erreurs au format FastAPI `{"detail": "message lisible"}` ;
- **CORS** : autoriser l'origine du front (`http://localhost:5173` en local, puis l'URL de production) ;
- les marts changent au plus une fois par jour : mettre les réponses en cache côté API (quelques minutes à une heure) réduit la latence et la consommation de l'entrepôt Snowflake.

L'algorithme de répartition du mode exemple (prorata du besoin pondéré par la vulnérabilité, plafonné au besoin, version `demo-0.1`) n'est qu'un substitut : l'algorithme réel est fourni par l'API ou le module ML.

---

## 4. Déploiement gratuit

Architecture cible :

```text
Navigateur (PWA) ──► Front statique (Vercel ou Cloudflare Pages)
                        │ HTTPS
                        ▼
                  API FastAPI (Render, offre gratuite) ──► PostgreSQL (Neon, gratuit) : comptes, organisations, stocks, scénarios
                        │                              └► Snowflake SALTIS.MARTS (lecture) et SALTIS.APP / SALTIS.ML
                        ▼
                  Modèle ML : calcul planifié (GitHub Actions) → SALTIS.ML.PREVISION_SAISONNIERE
                              démo interactive facultative : Hugging Face Spaces
```

Les conditions des offres gratuites changent souvent : vérifier les limites sur le site de chaque service avant la démo.

### 4.1 Front : Vercel (recommandé) ou Cloudflare Pages

**Vercel** (offre Hobby, gratuite, usage non commercial — adaptée au challenge) :

1. Sur vercel.com, *Add New → Project*, importer le dépôt GitHub.
2. **Root Directory** : `app`. Le reste est lu dans `app/vercel.json` (Vite, `npm run build`, dossier `dist`, réécritures SPA, cache long des fichiers `assets/`).
3. *Environment Variables* : `VITE_USE_MOCK=true` pour une démo sans API ; ensuite `VITE_USE_MOCK=false`, `VITE_API_URL=https://<api>.onrender.com`, `VITE_MAPBOX_TOKEN=pk.…`.
4. *Deploy*. Chaque push sur la branche de production redéploie ; chaque branche ou PR reçoit une URL de prévisualisation.

**Cloudflare Pages** (gratuit, bande passante illimitée, usage commercial permis) : *Workers & Pages → Create → Pages → Connect to Git*, préréglage **Vite** (ou commande `npm run build`, dossier `dist`), **Root directory** `app`, mêmes variables. Les fichiers `public/_redirects` (routes de l'app) et `public/_headers` (cache) sont pris en compte. Netlify accepte les mêmes fichiers.

**Mapbox** : l'offre gratuite couvre 50 000 chargements de carte par mois sur le web. Créer un token public dédié et le restreindre aux URL du front (`https://<projet>.vercel.app/*`, `http://localhost:5173/*`) dans *Account → Tokens*.

### 4.2 API FastAPI : Render (offre gratuite) + Neon (PostgreSQL)

Recommandations pour l'équipe API (rien n'est modifié dans `api/`) :

**Base PostgreSQL — Neon** (gratuit, sans limite de durée ; Render ne garde ses bases gratuites que 30 jours) :

1. neon.tech → *New project* (région Europe, la plus proche de Dakar).
2. Récupérer la chaîne de connexion (`postgresql://…?sslmode=require`) et en tirer `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.

**Service web — Render** (512 Mo de RAM, mise en veille après 15 min sans requête, réveil en ~1 min) :

1. render.com → *New → Web Service*, connecter le dépôt.
2. Réglages :
   - Root Directory : laisser vide (l'API importe `api.main`) ;
   - Runtime : Python 3 ;
   - Build Command : `pip install -r api/requirements.txt` (fichier à créer avec seulement les dépendances de l'API : `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `psycopg2-binary`, `python-dotenv`, `snowflake-connector-python`, et la bibliothèque JWT choisie ; le `requirements.txt` racine embarque dbt et xgboost, trop lourds pour 512 Mo) ;
   - Start Command : `uvicorn api.main:app --host 0.0.0.0 --port $PORT` ;
   - Instance Type : **Free** ; Health Check Path : `/docs` (ou une route `/sante`).
3. Variables d'environnement : `POSTGRES_*` (Neon), `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER` (`SVC_API`), clé privée de la paire de clés (prévue en C1) plutôt qu'un mot de passe, `SNOWFLAKE_ROLE`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, `JWT_SECRET` (long et aléatoire), `CORS_ORIGINS=https://<front>.vercel.app`.
4. Pour limiter les réveils lents pendant une démo : un ping de `/docs` toutes les 10 minutes (cron-job.org ou UptimeRobot, gratuits). Un seul service allumé en continu tient dans les 750 h gratuites par mois.

Alternatives gratuites : **Koyeb** (une instance gratuite, mise en veille si inactive) ou **Hugging Face Spaces** en Docker. Google Cloud Run a une offre gratuite généreuse mais exige un moyen de paiement.

Snowflake n'est pas gratuit au-delà de l'essai : entrepôt `XSMALL` avec `AUTO_SUSPEND = 60` et cache des réponses côté API pour consommer le moins de crédits possible.

### 4.3 Modèle ML (prévision de la pluie de saison)

La prévision saisonnière se calcule **une fois par campagne** (fin mai, quand les prédicteurs sont connus) : pas besoin d'un serveur de modèle allumé en permanence.

**Recommandé — calcul planifié avec GitHub Actions** (gratuit pour un dépôt public ; 2 000 minutes par mois pour un dépôt privé) :

1. Un script `ml/predire.py` lit `SALTIS.MARTS.MART_ML_PREVISION_PLUIE`, applique le modèle (fichier versionné, ex. `ml/modeles/pluie_v1.joblib`) et écrit `SALTIS.ML.PREVISION_SAISONNIERE` avec l'utilisateur `USER_ML` (voir [`ml/README.md`](../ml/README.md)).
2. Un workflow `.github/workflows/prevision.yml` le lance à la main (`workflow_dispatch`) et chaque année début juin (`schedule: cron`), avec les identifiants Snowflake en *secrets* GitHub.
3. L'API lit `SALTIS.ML.PREVISION_SAISONNIERE` comme un mart et l'expose (ex. `GET /previsions/{code_departement}?campagne=`) ; le front l'affichera à côté de l'historique, jamais à sa place.

**Facultatif — démo interactive sur Hugging Face Spaces** (CPU gratuit : 2 vCPU, 16 Go de RAM, mise en veille après 48 h sans visite) :

1. Déposer le modèle dans un dépôt de modèle Hugging Face.
2. Créer un Space **Docker** (ou Gradio) qui charge le modèle et expose `POST /predire` (FastAPI) ; les secrets Snowflake vont dans *Settings → Variables and secrets*.
3. Appeler ce Space depuis l'API, pas directement depuis le front (le front ne parle qu'à l'API).

### 4.4 Ordre de mise en ligne

1. Front en mode exemple sur Vercel (`VITE_USE_MOCK=true`) : démontrable tout de suite.
2. Base Neon + API sur Render, avec CORS vers l'URL Vercel ; tester `https://<api>.onrender.com/docs`.
3. Basculer le front : `VITE_USE_MOCK=false` et `VITE_API_URL`, puis redéployer.
4. Brancher la prévision ML quand `SALTIS.ML.PREVISION_SAISONNIERE` est alimentée.

---

## 5. Reste à faire

- Logos officiels des sources de données, avec l'accord des organismes (`src/landing/Sources.tsx`).
- Doses d'engrais validées (attendues de l'ISRA) : aujourd'hui « dose à saisir » pour la plupart des cultures.
- Prévision océan de 2027 : ajouter les indices de mars-mai 2027 dans `ml/entrees/indices_ocean.csv` fin mai 2027.

## Historique de la refonte (branche `dev/front-djigo`)

- Landing, scène, logo, modèles d'IA branchés (13/11/2026).
- 14/11/2026 : l'ancienne application (tableau de bord, pages par écran, connexion, inscription, administration, offre de semences, dossier `vitrine/`, pages publiques) est **supprimée**. Les pages du site sont réécrites (`src/pages/site/`), les profils de démonstration n'ont plus de noms de personnes, le bandeau des sources est ajouté à la landing.
