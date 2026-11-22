# Front — Assaman & Suuf

Application web (PWA installable) de la plateforme. Une **landing** présente le projet ; deux portes (**Agriculteur**, **ONG et services de l'État**) ouvrent la **scène** : une carte plein écran du Sénégal, pilotée par un dock de fonctionnalités, nourrie par l'API (`python -m api`) et les modèles d'IA (`ml/`). Cahier des charges : [`docs/projet/v1-cahier-des-charges.md`](../docs/projet/v1-cahier-des-charges.md).

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
│   ├── export/             exports PDF (fiche département, dossier national, dossier ONG)
│   ├── consentement/       bandeau cookies et choix du visiteur (mesure d'audience facultative)
│   ├── landing/            en-tête « île », pied de page, portes, bandeau des sources de données
│   ├── scene/              la scène de la carte
│   │   ├── cadre.ts        contrat entre la scène et ses fonctionnalités (ce que chaque écran reçoit et renvoie)
│   │   ├── previsions.tsx  choix de l'année et lecture des prévisions, partagés par les écrans
│   │   ├── modes/          une fonctionnalité du dock par fichier (12 écrans)
│   │   ├── carte/          moteur de carte (Carte.tsx), garde sans WebGL, couleurs, contours, crans du tiroir
│   │   ├── interface/      fenêtre de résultats, dock, fiche réponse, briques d'interface (ui.tsx), courbe de cumul
│   │   ├── regles/         calculs sans affichage : conseils, répartition, besoins, fiabilité, Cadre harmonisé
│   │   ├── voix/           mascottes FR et WLF, lecture à voix haute, textes wolof
│   │   └── ong/            dossier de l'ONG (stock, prix), registre de l'export, formulaire d'avis
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
Chaque fenêtre de résultats a deux mascottes : le garçon **FR** lit l'essentiel en français (synthèse du navigateur, `src/scene/voix/lecture.ts`), la fille **WLF** le lit en wolof (texte préparé dans `aEcouterWo`, voix du Space Hugging Face). Détail : [`voix/README.md`](../voix/README.md).

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
- l'app et les données déjà consultées restent disponibles **hors ligne** : les réponses `GET /api/v1/…` sont gardées 7 jours (réseau d'abord, cache si la connexion tombe ou au-delà de 6 s). La voix, l'avis et l'état du système demandent le réseau. Règle : `motifApi` dans `vite.config.ts` ; test : charger un écran, couper l'API, recharger ;
- Mapbox (~525 Ko compressés) n'est téléchargé qu'à l'ouverture d'une carte, puis mis en cache ;
- chaque écran est un petit fichier chargé à la demande ; les données sont mises en cache 1 h et préchargées au survol du menu ;
- squelettes de chargement au lieu d'écrans blancs ; l'écran précédent reste affiché pendant le changement d'année ou de département ;
- une nouvelle version déployée s'installe en arrière-plan et s'active quand tous les onglets du site sont fermés (un bouton « Mettre à jour » reste à ajouter : audit, constat FE-05).

---

## 3. Contrat d'API

Le front appelle uniquement les fonctions de `src/api/index.ts`, qui interrogent l'API sous `/api/v1` (réponses `{meta, donnees}`, colonnes des marts en minuscules, valeur inconnue = `null`, jamais 0).

- Routes, paramètres et formats : [`docs/technique/guide-api.md`](../docs/technique/guide-api.md) et [`api/README.md`](../api/README.md) ; en local, la documentation interactive est sur `http://localhost:8080/docs`.
- Colonnes des marts : [`docs/technique/contrat-donnees.md`](../docs/technique/contrat-donnees.md).
- Types côté front : `src/types/` ; le faux serveur `src/api/mock/` (données d'exemple, `VITE_DONNEES_DEMO=true`) suit les mêmes formats.
- L'API n'a pas de comptes : l'entrée par profil (agriculteur, ou ONG et services de l'État) reste dans le navigateur (`src/auth/`, `src/api/mock/comptes.ts`).

## 4. Déploiement

Le site est servi en production par **Caddy** sur le VPS, avec l'API, Redis et Umami : voir [`deploy/README.md`](../deploy/README.md) (Docker Compose, HTTPS automatique, variables du build).

`vercel.json` et `public/_redirects` restent dans le dépôt pour une prévisualisation éventuelle du front seul ; ils ne servent pas en production.

**Mapbox** : l'offre gratuite couvre 50 000 chargements de carte par mois sur le web. Utiliser un jeton public (`pk.…`) dédié, restreint au domaine du site et à `http://localhost:5173/*` (*Account → Tokens*).

---

## 5. Reste à faire

- Logos officiels des sources de données, avec l'accord des organismes (`src/landing/Sources.tsx`).
- Doses d'engrais validées (attendues de l'ISRA) : aujourd'hui « dose à saisir » pour la plupart des cultures.
- Prévision océan de 2027 : ajouter les indices de mars-mai 2027 dans `ml/entrees/indices_ocean.csv` fin mai 2027.

## Historique de la refonte (branche `dev/front-djigo`)

- Landing, scène, logo, modèles d'IA branchés (13/11/2026).
- 14/11/2026 : l'ancienne application (tableau de bord, pages par écran, connexion, inscription, administration, offre de semences, dossier `vitrine/`, pages publiques) est **supprimée**. Les pages du site sont réécrites (`src/pages/site/`), les profils de démonstration n'ont plus de noms de personnes, le bandeau des sources est ajouté à la landing.
