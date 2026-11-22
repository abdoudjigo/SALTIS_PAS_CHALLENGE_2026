# 03 · Frontend — Assaman & Suuf

> Audit du 21/11/2026, branche `dev/all-recup` (commit `51e448d`). Lecture seule. Prérequis : `01-cartographie.md`.
> Préfixe des constats : `FE`. Grille locale (module 13) : réseau 3G instable, Android d'entrée de gamme, 360 px, coût des données, lecteurs peu à l'aise avec l'écrit.
> Le build a été fait dans le dossier temporaire de l'auditeur avec les réglages de prod (`VITE_API_URL=""`, `VITE_AUTH_DEMO=true`, `VITE_DONNEES_DEMO=false`). `app/dist` n'a pas été touché.

---

## 1. Note globale : **3 / 5**

| Domaine | Note | En bref |
|---|---|---|
| Code | 4 | TS `strict`, 1 seul cast forcé, ESLint et typecheck propres, routes chargées à la demande. Quelques composants trop gros. |
| Performance | 3 | Landing légère (≈ 227 Ko compressés). Mais le service worker télécharge ≈ 866 Ko de plus en arrière-plan, et la carte Mapbox pèse 525 Ko compressés et exige WebGL. |
| UX et robustesse | 2 | **Le cache hors ligne des données ne marche pas** (FE-01). Aucun écran n'affiche d'erreur réseau. Mises à jour de l'appli bloquées. Pas de choix du lieu sans carte ni GPS. |
| Accessibilité | 3 | Libellés et rôles ARIA présents, `lang="wo"` sur le titre wolof, `prefers-reduced-motion` pris en compte. Contrastes et clavier non mesurés par un outil (axe et Lighthouse non lancés). |
| Sécurité côté client | 4 | Le build refuse les jetons secrets. Pas de `dangerouslySetInnerHTML`. `innerHTML` seulement sur du texte fixe. Fausse session en `localStorage` (FE-07). |
| SEO | 4 | Pages publiques pré-rendues avec leurs balises, Open Graph, `robots.txt`, `sitemap.xml`. Pas de données structurées. |

---

## 2. Mesures relevées

| Mesure | Valeur | Commande / source |
|---|---|---|
| Typecheck | 0 erreur | `npm run typecheck` |
| ESLint | 0 erreur, 0 avertissement (18 `eslint-disable` dans le code) | `npx eslint .` ; `grep -rn eslint-disable src` |
| `any`, `@ts-ignore`, `as unknown as` | 1 (`src/pages/Scene.tsx:35`) | `grep -rEn` |
| Vulnérabilités, dépendances de prod | **0** | `npm audit --omit=dev` |
| Vulnérabilités, dépendances de dev | 10 modérées (`glob`, `minimatch`) ; `eslint 9.39.5` plus maintenu | `npm audit`, avertissement `npm ci` |
| **1re visite de la landing** (HTML + JS + CSS) | **≈ 130 Ko gzip** | `gzip -9` sur les fichiers de `index.html` (`modulepreload`) |
| Polices (2 familles variables, latin) | ≈ 97 Ko | `stat` sur les `.woff2` préchargés |
| **Précache du service worker** (téléchargé en arrière-plan après la 1re visite) | **74 fichiers, 2,1 Mo bruts, ≈ 866 Ko gzip** | `sw.js` ; somme `gzip -6` |
| Dont jsPDF + html2canvas (export PDF des ONG) | 399 + 199 Ko bruts (≈ 176 Ko gzip) | sortie de `vite build` |
| Dont Recharts (`charts`) | 363 Ko bruts (105 Ko gzip) | idem |
| Dont faux serveur `serveur-*.js` (démo) | 34 Ko bruts (12,5 Ko gzip) | idem |
| Mapbox GL (hors précache, à l'ouverture de la carte) | 1,88 Mo bruts, **525 Ko gzip**, plus les tuiles | idem |
| Contours GeoJSON (`/geo`) | 316 Ko bruts | `ls -la dist/geo` |
| Prod, 360 px : défilement horizontal | aucun (`scrollWidth = 360`) | navigateur intégré, `https://assaman-suuf.tech/` |
| Prod, 360 px : boutons et liens sans nom accessible | 0 | script dans la page |
| Prod : 1re requête de la carte (agriculteur) | 43 requêtes, 26 Ko de données d'API | `performance.getEntriesByType('resource')` |
| Lighthouse / Core Web Vitals | **non mesurés** | `npx` refusé par le contrôle des permissions ; le navigateur d'audit n'a pas WebGL → À vérifier sur un vrai téléphone |

---

## 3. Constats

### [FE-01] Le cache hors ligne des données d'API ne fonctionne pas (variable `apiUrl` absente du service worker)
- **Suivi (22/11/2026, après l'audit)** : ✅ Corrigé — la règle de cache est une expression régulière calculée au build (`motifApi`, `app/vite.config.ts`), sans variable extérieure : dans `sw.js` de prod, `/\/api\/v1\/(?!voix\/|avis|systeme\/)/` en `NetworkFirst` (7 jours, délai réseau 6 s), plus aucune occurrence de `apiUrl`. Testé avec une API locale (données des tests) : 9 réponses gardées en cache ; API arrêtée et page rechargée, `/referentiels/departements` et `/vulnerabilite` sont servis depuis le cache (200), une requête jamais vue et `/systeme/sante` échouent normalement ; plus de `ReferenceError`. **Reste** : afficher l'état hors ligne à l'écran (FE-03) ; activer les nouvelles versions (FE-05).
- Sévérité : 🟠 Élevé   Statut : Constaté (dans le build du dépôt **et** dans `https://assaman-suuf.tech/sw.js`)
- Où : `app/vite.config.ts:157` (`const apiUrl = …`) et `:216-217` (`url.href.startsWith(apiUrl)`)
- Constat : la règle Workbox « données de l'API : réseau d'abord, cache si hors ligne » est une fonction recopiée telle quelle dans `sw.js`. La variable `apiUrl`, qui existe dans `vite.config.ts`, n'existe pas dans le service worker : la fonction lève `ReferenceError` à chaque requête GET qui l'atteint. Workbox n'attrape pas cette erreur (`node_modules/workbox-routing/Router.js:259-265`). Le navigateur passe alors directement au réseau, et **aucune réponse d'API n'est jamais mise en cache**. De plus, en prod, `VITE_API_URL` est vide : `apiUrl` vaudrait `http://localhost:8080`, ce qui ne correspondrait de toute façon jamais.
- Preuve : `grep -o apiUrl dist/sw.js` → 1 occurrence (l'usage), 0 définition. Le `sw.js` de prod contient `s.href.startsWith(apiUrl)`.
- Impact : le contexte annonce une PWA utilisable « réseau mobile lent ou coupé ». En réalité, sans réseau, la carte et les fiches n'ont aucune donnée : seul l'habillage s'affiche. Dans un champ en zone mal couverte, l'agriculteur perd tout ce qu'il a consulté la veille. Les requêtes de tuiles Mapbox lèvent aussi l'erreur, ce qui pollue la console.
- Recommandation : écrire la règle sans variable extérieure, par exemple `urlPattern: ({ url, request, sameOrigin }) => sameOrigin && request.method === 'GET' && url.pathname.startsWith('/api/v1/') && !url.pathname.startsWith('/api/v1/voix')`. Pour un `VITE_API_URL` différent, injecter la valeur en chaîne littérale. Tester : DevTools → Application → Service Workers → Offline, recharger un écran déjà vu. Ajouter ce test au module 09.
- Effort : S

### [FE-02] Sans WebGL et sans GPS, l'agriculteur ne peut pas choisir son lieu autrement qu'en tapant latitude et longitude
- **Suivi (22/11/2026, après l'audit)** : ✅ Corrigé — nouveau composant `scene/interface/ChoixDepartement.tsx` : liste native région → département (14 régions, 45 départements), utilisable sur tout téléphone, au clavier et au lecteur d'écran. Visible dans « Ma parcelle » juste sous « Me localiser » (et pour changer de champ), et à la place de la carte quand WebGL manque (`GardeCarte`, prop `choix`), pour tous les autres écrans. Un département choisi sans GPS cadre le département, sans repère de parcelle ; « Revoir le pays » efface aussi ce choix. Vérifié à 375 px, dans un navigateur sans WebGL : Ma parcelle → Kolda (« 8 cultures y réussissent »), puis La saison qui vient → Podor, sans erreur. Un plantage trouvé pendant le test (lecture de `position[1]` sans position) a été corrigé.
- Sévérité : 🟠 Élevé   Statut : Constaté (navigateur sans WebGL) / Probable (part des téléphones concernés)
- Où : `app/src/scene/GardeCarte.tsx` (message « La carte 3D ne peut pas s'afficher sur cet appareil ») ; `app/src/scene/modes/Parcelle.tsx:133-153` (géolocalisation, sinon saisie de coordonnées en degrés décimaux)
- Constat : quand WebGL manque, la carte est remplacée par un message. C'est bien géré, sans plantage. Mais le seul moyen de désigner son champ devient « Me localiser » (GPS) ou une saisie de latitude et longitude. Il n'existe aucune liste région → département dans les écrans (`grep "<select"` : seulement l'année et le formulaire d'avis).
- Preuve : sur `https://assaman-suuf.tech/` à 360 px, dans le navigateur d'audit : `webgl: false, webgl2: false`, message de garde affiché, aucun `select` dans la page. Mapbox GL v3 exige WebGL.
- Impact (grille locale) : un vieil Android, un navigateur intégré (WhatsApp, Facebook) qui coupe l'accélération, un GPS lent sous un abri ou une autorisation refusée suffisent : l'agriculteur reste bloqué au premier écran. Personne ne connaît ses coordonnées en degrés décimaux. Devant le jury, un vidéoprojecteur ou un ordinateur sans accélération graphique produit le même blocage.
- Recommandation : ajouter partout un sélecteur « Ma région → mon département » (45 entrées, déjà dans `/referentiels/departements`), toujours visible quand la carte est absente, et mémoriser le choix. Garder la saisie de coordonnées en option avancée.
- Effort : S

### [FE-03] Aucun écran n'affiche d'erreur : une panne réseau ressemble à « donnée non disponible »
- **Suivi (22/11/2026, après l'audit)** : ✅ Corrigé — composant commun `scene/interface/EtatReseau.tsx`, en tête de la fenêtre de résultats de **tous** les écrans : « Vous êtes hors ligne » (les données déjà consultées restent affichées) ou « Le serveur ne répond pas » avec un bouton **Réessayer**, qui relance seulement les requêtes en échec. Une absence de donnée (404, 422) n'est pas comptée comme une panne. Précision sur le constat initial : les écrans qui lisent des **prévisions** affichaient déjà un message d'erreur, via `etatPrevision` et `Attente`. Ma recherche de `isError` ne pouvait pas le voir. Les 6 écrans fondés sur les marts (BesoinsPays, ContreSaison, Exporter, Potentiel, Repartir, une partie de Semer) n'avaient en revanche rien. Vérifié avec une API locale : API coupée → bandeau et « Réessayer » ; API relancée puis « Réessayer » → bandeau disparu et données rechargées ; hors ligne simulé → « Vous êtes hors ligne », puis disparition au retour du réseau.
- Sévérité : 🟠 Élevé   Statut : Constaté
- Où : `app/src/scene/modes/*.tsx` (12 écrans) ; `app/src/main.tsx:11-23` ; `app/src/api/client.ts:80-81`
- Constat : aucun des 12 écrans ne lit `isError` ou `error` de TanStack Query (`grep -rlE "isError|\berror\b" scene/modes` → 0 fichier). Il n'y a ni `QueryCache.onError` global, ni `ErrorBoundary` en dehors de la carte (`GardeCarte.tsx:31`). Le client prépare pourtant de bons messages (« Vous êtes hors ligne. », « Le serveur ne répond pas. Réessayez dans un instant. »), mais ils ne sont jamais montrés. Après 2 tentatives, `data` reste `undefined` et les écrans affichent « — » ou « non disponible ».
- Impact : l'utilisateur ne distingue pas « le réseau a coupé » de « cette information n'existe pas pour mon département ». Cela contredit la règle d'honnêteté du cahier des charges : il conclut à tort que la plateforme n'a pas de données, et il n'a aucun bouton pour réessayer. Pendant la démo, une coupure Wi-Fi passerait pour des trous dans les données.
- Recommandation : un composant commun `<EtatRequete>` (chargement, erreur réseau avec « Réessayer », vide), branché dans `FicheReponse` ou `Fenetre`, plus un bandeau global « hors ligne » (`navigator.onLine` et événements `online`/`offline`). Garder « non disponible » pour les seules valeurs `null` renvoyées par l'API.
- Effort : S

### [FE-04] Le service worker télécharge ≈ 866 Ko en arrière-plan, dont les exports PDF que l'agriculteur n'utilise pas
- Sévérité : 🟡 Moyen (🟠 si les mises en ligne sont fréquentes)   Statut : Constaté
- Où : `app/vite.config.ts:195-197` (`globPatterns: ['**/*.{js,css,html,svg,png,woff2}']`, seuls Mapbox et les polices non latines sont exclus)
- Constat : après la 1re visite de la landing (≈ 227 Ko avec les polices), le service worker précharge tout le reste sans rien demander : jsPDF, html2canvas, Recharts, le faux serveur, tous les écrans. Cela fait 74 fichiers et ≈ 866 Ko compressés. Chaque nouvelle mise en ligne change les noms de fichiers, et les blocs modifiés sont retéléchargés.
- Impact (grille locale) : le forfait data est payé par l'utilisateur, et l'objectif est moins de 500 Ko. Un agriculteur qui ne fait que regarder la landing paie près d'1 Mo, dont 176 Ko de génération PDF réservée aux ONG.
- Recommandation : exclure du précache `jspdf*`, `html2canvas*`, `charts*`, `serveur*`, `purify*` et les écrans ONG (`globIgnores`), et les mettre en `CacheFirst` à la première utilisation. Envisager de ne pas précacher du tout quand `navigator.connection.saveData` est actif.
- Effort : S

### [FE-05] Une nouvelle version du site n'est jamais proposée : les téléphones restent sur l'ancienne
- Sévérité : 🟡 Moyen   Statut : Constaté
- Où : `app/vite.config.ts:175` (`registerType: 'prompt'`) ; `dist/registerSW.js` (simple `register('/sw.js')`) ; aucune utilisation de `virtual:pwa-register` dans `src/`
- Constat : en mode `prompt`, le nouveau service worker attend un message `SKIP_WAITING` (présent dans `sw.js`). Aucun code du site ne l'envoie et aucune invite « Nouvelle version disponible » n'existe. La nouvelle version ne s'active qu'une fois **tous** les onglets ou l'appli installée fermés.
- Impact : sur Android, une PWA installée ou un onglet Chrome reste ouvert des jours. Les correctifs (FE-01 par exemple) et les nouveaux textes n'arrivent pas, et l'équipe ne sait pas quelle version voient les utilisateurs. Combiné à ARC-03, ce sont des chiffres anciens à deux niveaux.
- Recommandation : passer en `registerType: 'autoUpdate'`. À défaut, brancher `useRegisterSW` (`virtual:pwa-register/react`) avec un bandeau « Nouvelle version — Mettre à jour ».
- Effort : S

### [FE-06] Carte 3D lourde pour un téléphone d'entrée de gamme, sans mode léger
- Sévérité : 🟡 Moyen   Statut : Probable (non mesuré sur appareil réel)
- Où : `app/src/scene/Carte.tsx` (675 l. : relief, inclinaison, arcs, animation de pluie l. 629, transitions d'opacité l. 482-496) ; bloc `mapbox` (525 Ko gzip)
- Constat : la carte charge Mapbox GL v3 (WebGL), anime caméra, relief, extrusions et arcs. Rien ne détecte un appareil faible (`navigator.deviceMemory`, `hardwareConcurrency`, `saveData`) pour passer en 2D sans animation. `prefers-reduced-motion` est pris en compte à 8 endroits, c'est un bon point, mais peu d'utilisateurs l'activent.
- Impact (grille locale) : sur un Android de 2 Go, l'ouverture de la carte peut prendre plusieurs secondes, avec batterie et chauffe. C'est l'écran principal des deux profils.
- Recommandation : mesurer d'abord (Lighthouse mobile bridé et un vrai téléphone de 2 Go). Puis un « mode léger » automatique : 2D, pas de relief ni d'animation, et fond de carte simplifié, ou pas de fond (`VITE_MAPBOX_TOKEN` vide gère déjà ce cas).
- Effort : M

### [FE-07] Fausse session visible : bouton « Se déconnecter » pour un site « sans compte »
- Sévérité : 🟡 Moyen   Statut : Constaté
- Où : `app/src/pages/Scene.tsx:116,251` ; `app/src/auth/session.ts:5,31` ; `app/src/landing/entrer.ts:10`
- Constat : l'agriculteur voit un bouton « Se déconnecter ». Une « session » (`access_token`, `user`, rôle) est stockée dans `localStorage['assaman.session']` et revalidée à chaque ouverture par le faux serveur chargé en prod. Voir ARC-06 pour la cause.
- Impact : vocabulaire de compte incohérent avec la page Confidentialité (« pas de compte ») et avec la promesse de simplicité. Une « déconnexion » vide aussi le dossier de l'ONG (`AuthContext.tsx:37-42`) : un clic par erreur efface les saisies.
- Recommandation : remplacer par « Changer de profil » (profil gardé en `localStorage`, sans jeton). Ne vider les saisies qu'après confirmation.
- Effort : S

### [FE-08] Composants trop gros qui mêlent données, règles et rendu
- Sévérité : 🟡 Moyen   Statut : Constaté
- Où : `scene/Carte.tsx` (675 l.), `pages/Landing.tsx` (443 l.), `scene/ui.tsx` (371 l.), `scene/modes/Parcelle.tsx` (344 l.), `pages/Scene.tsx` (272 l.)
- Constat : `Parcelle.tsx` appelle 5 à 6 hooks de données, calcule la culture conseillée, la fenêtre de semis et les sacs d'engrais, puis construit les phrases et le rendu (l. 90-175). `ui.tsx` regroupe tous les composants partagés de la scène.
- Impact : les règles de conseil, qui sont des chiffres montrés aux agriculteurs, ne sont pas testables isolément. Il n'existe aucun test front (module 09).
- Recommandation : sortir les règles dans des fonctions pures (`parcelle/regles.ts`) testées avec Vitest. Découper `Carte.tsx` (couches, caméra, animations) et `ui.tsx`. Voir l'arborescence cible du module 02.
- Effort : M

### [FE-09] Outillage de dev à jour à moitié
- Sévérité : 🔵 Faible   Statut : Constaté
- Où : `app/package.json` ; sortie de `npm ci` et `npm audit`
- Constat : `eslint 9.39.5` n'est plus maintenu (avertissement de `npm ci`). 10 vulnérabilités modérées dans les outils de dev (`glob`, `minimatch`), **aucune** dans les dépendances livrées. Aucune règle d'accessibilité (`eslint-plugin-jsx-a11y`) ni de frontières d'import.
- Recommandation : passer à ESLint 10 et `typescript-eslint` récent, ajouter `jsx-a11y`, et lancer `npm audit --omit=dev` en CI (module 08).
- Effort : S

### [FE-10] Accessibilité et Core Web Vitals non mesurés par un outil
- Sévérité : 🔵 Faible   Statut : À vérifier
- Où : —
- Constat : axe et Lighthouse n'ont pas pu être lancés (`npx` refusé par le contrôle des permissions ; pas de WebGL dans le navigateur d'audit). Contrôles manuels sur la landing de prod à 360 px : titres hiérarchisés (un `h1`, puis des `h2`), `lang="fr"`, `lang="wo"` sur le titre wolof (`Landing.tsx:262`), `alt` sur tous les logos (chargés en `lazy`), aucun bouton sans nom. Les dialogues ont `role="dialog"` et `aria-modal` (`Landing.tsx:429`, `AvisOng.tsx:79`). Le calcul de contraste par script a donné des faux positifs (textes sur fond dégradé) ; la capture d'écran ne montre pas de problème évident.
- Recommandation : lancer `npx @axe-core/cli` et `npx lighthouse --form-factor=mobile` (profil 3G bridé) sur la landing et sur la carte, depuis un poste autorisé, et sur un Android d'entrée de gamme réel. Vérifier en priorité le piège du focus dans les dialogues et la navigation clavier sur la carte.
- Effort : S

### [FE-11] (Constat ajouté le 22/11/2026) Le build de prod du code actuel appelait l'API sur `http://localhost:8080`
- Sévérité : 🔴 Critique (au prochain déploiement)   Statut : Constaté puis ✅ corrigé le 22/11/2026
- Où : `app/vite.config.ts:154` (retire du shell toute variable `VITE_*` vide, boucle ajoutée par le commit `80d3d88`, après la version en prod `3922c9e`) ; `deploy/Dockerfile.web` (`ENV VITE_API_URL=""` = même origine) ; `app/src/config.ts:6` (repli `?? 'http://localhost:8080'`)
- Constat : la boucle retire `VITE_API_URL=""`. Le front compilé n'a donc plus cette variable et retombe sur `http://localhost:8080`.
- Preuve : build fait comme en prod, objet d'environnement compilé sans `VITE_API_URL`, et `apiUrl:(e.VITE_API_URL??"http://localhost:8080")`.
- Impact : le site en ligne n'est pas touché aujourd'hui (il date d'avant la boucle). Mais au prochain déploiement de `main`, toutes les requêtes de données seraient parties vers la machine du visiteur (bloquées en plus par la CSP) : plus aucune donnée à l'écran.
- Correction : en production, `VITE_API_URL` vide ou absente = même origine, dans `src/config.ts` (`env.PROD ? ''`) et dans `vite.config.ts`. Vérifié : le build de prod utilise la même origine.
- Effort : S

---

## 4. Points solides relevés

- **Discipline sur les valeurs inconnues.** `lib/format.ts:1,18-19` renvoie « — » pour `null`, `undefined` ou `NaN`, jamais 0. Les `?? 0` restants (32) servent à trier ou à compter, pas à afficher, d'après les 20 premiers relus. Une exception mineure : `Repartir.tsx:109` additionne un budget en comptant 0 pour une part sans prix.
- **Secrets.** `vite.config.ts:13-19` refuse de construire si une variable `VITE_*` ressemble à un secret (`sk.…`). L'adresse de contact est codée au build et décodée au clic (`vite.config.ts:162`).
- **Chargement.** Chaque page et chaque écran est un fichier séparé (`App.tsx:8-17`, 70 blocs). Mapbox n'est ni préchargé ni importé par la landing. Les polices sont auto-hébergées et limitées au latin.
- **SEO.** HTML pré-rendu par page publique, avec `title`, `description` et Open Graph (`dist/a-propos.html`). `robots.txt` exclut `/api/`. `sitemap.xml` est généré quand `VITE_URL_SITE` est défini (`vite.config.ts:123-141`).
- **Voix.** La lecture en français passe par la synthèse du navigateur (`scene/lecture.ts:24`), gratuite et hors ligne. Seule la voix wolof sollicite le serveur.

---

## 5. Top 5 des gains rapides (effort S, impact visible)

| # | Action | Constat | Gain |
|---|---|---|---|
| 1 | Réécrire la règle Workbox de l'API sans variable extérieure, puis tester en mode avion | FE-01 | La promesse « hors ligne » devient vraie |
| 2 | Sélecteur région → département quand la carte ou le GPS manquent | FE-02 | Personne n'est bloqué au premier écran, y compris pendant la démo |
| 3 | Composant commun d'erreur avec « Réessayer » et bandeau hors ligne | FE-03 | Une coupure n'est plus confondue avec une absence de données |
| 4 | `registerType: 'autoUpdate'` (ou bandeau de mise à jour) | FE-05 | Les correctifs arrivent sur les téléphones |
| 5 | Exclure jsPDF, html2canvas, Recharts et le faux serveur du précache | FE-04 | Environ 300 Ko gzip économisés par visiteur et par mise en ligne |

---

## Résumé

- **3/5.** Code propre (TS strict, lint et typecheck sans erreur, 0 vulnérabilité en prod) et landing légère (≈ 227 Ko). Pages pré-rendues, bon SEO, règle « jamais 0 » respectée.
- 🟠 FE-01 : le cache hors ligne des données d'API est cassé, en prod aussi (`apiUrl` indéfinie dans `sw.js`). Sans réseau, la PWA n'a aucune donnée.
- 🟠 FE-02 : sans WebGL ni GPS, le seul moyen de choisir son lieu est de taper latitude et longitude. 🟠 FE-03 : aucune erreur réseau n'est affichée, une panne ressemble à « non disponible ».
- 🟡 Le précache coûte ≈ 866 Ko en arrière-plan (PDF et graphiques compris). Les nouvelles versions ne s'activent pas. Carte 3D sans mode léger. Fausse session visible (« Se déconnecter »).
- À vérifier : Lighthouse, axe et un vrai Android de 2 Go (`npx` refusé, pas de WebGL dans le navigateur d'audit).
