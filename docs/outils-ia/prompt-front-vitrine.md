# Brief — Front vitrine « Assaman & Suuf »

## Pour toi, Ibrahima (à lire avant de coller le reste dans Claude)

- Ouvre Claude Code à la racine du dépôt, à jour avec `develop`.
- Choisis le modèle **Fable 5.2** (`/model`, puis Fable 5.2, identifiant `claude-fable-5-2`). C'est le plus puissant pour un travail visuel et créatif de cette ampleur.
- Colle tout ce qui suit la ligne « PROMPT ». Claude proposera d'abord un plan : relis-le, valide-le, puis avancez **un plan de l'histoire à la fois**, en regardant le résultat dans le navigateur, sur ordinateur et sur ton téléphone, à chaque étape.
- Tu n'as pas besoin d'être designer : ton rôle est de juger. « Est-ce que ça me fait quelque chose ? Est-ce que je comprends en 3 secondes ? » Si la réponse est non, dis-le à Claude tel quel.
- Vérifie le règlement du SALTIS PAS Challenge : s'il demande de déclarer les outils utilisés, déclare-le simplement.

---

## PROMPT

Tu es directeur artistique et développeur front senior. Tu es spécialisé en cartographie 3D interactive (Mapbox GL JS v3), en motion design web, en responsive et en performance. Tu construis le front vitrine d'**Assaman & Suuf**, une plateforme d'aide à la décision agricole au Sénégal, développée par l'équipe AKAI pour le SALTIS PAS Challenge 2026. « Assaman » veut dire le ciel et « Suuf » la terre en wolof : **le ciel et la terre**, c'est tout le projet.

### Le but

Le site sera déployé et vu par des responsables de grandes fondations et d'organisations internationales (Fondation Bill & Melinda Gates, bailleurs, ONG). Beaucoup l'ouvriront sur leur téléphone. Ils ont vu des centaines de démos. Ce site doit les **saisir dès la première seconde**, avant même l'inscription, puis les convaincre que tout ce qui est beau est **vrai** : chaque image de carte reflète nos données réelles.

Le back est terminé et solide. **Le front doit maintenant porter le projet.** Pas de jargon technique à l'écran : les images, les cartes et le mouvement doivent tout dire.

### L'histoire, plan par plan

**Plan 1 — La landing page (avant inscription) : le choc.**
- Plein écran, nuit étoilée. **Un globe terrestre 3D** tourne lentement dans l'espace, avec une atmosphère lumineuse sur le bord et un halo.
- Sur le globe, **les vents de la planète circulent** en particules lumineuses fluides, comme un souffle vivant (référence d'ambiance : la vitrine 3D de mapbox.com et les couches de vent animées de Mapbox).
- Le globe ralentit et se tourne de lui-même vers l'**Afrique de l'Ouest**. Le Sénégal s'éclaire doucement.
- Au premier plan, la **transition ciel → terre** : la pluie se met à tomber, touche le sol en bas de l'écran, et **des pousses sortent de terre et fleurissent** (mil, arachide…), en vectoriel, élégant, pas de dessin animé.
- Une phrase courte, grande, en français : quelque chose comme « Le ciel et la terre, enfin réunis pour chaque champ du Sénégal », puis deux boutons, « Découvrir » et « Se connecter ».
- Quand la souris bouge, ou quand le téléphone s'incline, le globe réagit légèrement (parallaxe) et les particules s'écartent un peu.

**Plan 2 — L'inscription et la connexion.** (le fonctionnement existant et ce qu'il faut garder sont détaillés plus bas, section « Connexion et inscription »)
- Depuis la landing, « Se connecter » et « Créer un compte » ouvrent leur formulaire **sans quitter le décor** : la caméra du globe recule ou se décale, le formulaire apparaît par-dessus, ciel en haut, terre en bas, pluie fine, plantes qui poussent.
- Le formulaire flotte en verre dépoli, très lisible. Sur téléphone, il occupe la largeur de l'écran, et le décor reste visible au-dessus et en dessous.
- **Connexion** : email, mot de passe (avec le bouton pour l'afficher ou le masquer), message d'erreur clair dans le décor (« Email ou mot de passe incorrect »), bouton qui montre l'attente (la pluie s'intensifie au lieu d'un rond qui tourne).
- **Inscription d'un producteur** : nom, email, mot de passe (8 caractères minimum), **département de ses champs**. Le choix du département est le moment fort : une petite carte du Sénégal où l'on touche son département, qui s'allume, avec la liste déroulante accessible juste en dessous comme alternative (clavier, lecteur d'écran, petit téléphone).
- **Réussite** : le formulaire se dissout en gouttes, et l'on enchaîne directement sur le plan 3. Pour un producteur, la plongée se termine **sur son propre département**.
- Pendant la saisie, on **précharge en silence** la carte et les données de l'étape suivante, pour que la transition soit instantanée.

**Plan 2 bis — Le mot de bienvenue : la mascotte.**
- Juste après la connexion ou l'inscription, avant la plongée, **un agriculteur sénégalais** apparaît et souhaite la bienvenue sur la plateforme. Il n'a rien d'un personnage de dessin animé. Il est **crédible et digne** : tenue de travail, chapeau de paille, une houe ou une poignée d'épis de mil, regard chaleureux. On doit croire qu'il existe.
- Il est **animé** : il lève la main, sourit, puis désigne le globe derrière lui comme pour dire « suivez-moi ». Le mouvement est léger, en boucle courte, fluide sur téléphone.
- **Sa bulle de texte est personnalisée** avec les vraies informations du compte (`user.nom`, rôle, département) :
  - producteur : « Dalal ak jàmm, Awa ! Bienvenue sur Assaman & Suuf. Allons voir ce que le ciel prépare pour vos champs de Kaolack. » ;
  - organisation : « Bienvenue, Fatou. Voyons ensemble où vos intrants seront les plus utiles cette campagne. » ;
  - conseiller et administrateur : un message adapté au même ton.

  « Dalal ak jàmm » veut dire « bienvenue » en wolof. Le reste est en français. Fais vérifier l'orthographe wolof par l'équipe.
- Le texte s'écrit progressivement, comme une voix. Un bouton « Commencer » lance la plongée (plan 3), et un lien discret « Passer » permet de sauter l'accueil.
- **Version longue à la première connexion**, version courte (une ligne, quelques secondes) aux connexions suivantes. Elle ne se rejoue pas à chaque rechargement de page.
- La mascotte peut revenir avec parcimonie comme **guide** : un conseil dans un état vide, un encouragement quand la saison est bonne, une explication au premier passage sur un écran. Jamais de manière envahissante.
- **Comment la produire** : propose les options avec leurs avantages et leur poids, et fais valider avant de choisir :
  - illustration vectorielle animée (Rive ou Lottie) dessinée pour le projet ;
  - personnage 3D léger ;
  - vidéo courte d'un vrai agriculteur filmé avec son accord écrit (droit à l'image).

  Pas de visage généré qui sonne faux, pas de banque d'images. Prévois aussi une **agricultrice** : au Sénégal, une grande part du travail agricole est faite par des femmes, et c'est un message fort pour ce public. On peut alterner, ou choisir selon le profil.
- Respecte « réduire les animations » : la mascotte apparaît alors immobile, avec son texte.

**Plan 3 — L'arrivée : de l'Afrique au Sénégal.**
- À la connexion, pas de changement de page brutal : la caméra **plonge** depuis le globe. Cette plongée se joue **à l'arrivée après une connexion ou une inscription**, pas à chaque rechargement de page (un utilisateur déjà connecté qui revient arrive directement sur la carte, avec un bouton pour rejouer la plongée). La caméra traverse l'atmosphère, survole l'Afrique de l'Ouest et se pose sur le **Sénégal en 3D** (relief exagéré, le pays est plat), lumière rasante.
- Les **6 zones agroécologiques** s'allument l'une après l'autre avec leur nom.
- Les **45 départements** se lèvent en volumes 3D : la hauteur est la pluie de la saison et la couleur le risque de la saison (normal, sécheresse, excès de pluie, les deux). Ce sont les **vraies données**.

**Plan 4 — Le film de la saison.**
- Une ligne de temps élégante en bas de l'écran. On appuie sur « Lecture » : les **36 décades** de l'année défilent (une décade = 10 jours).
- Les volumes montent au fil de la pluie cumulée. Ceux qui prennent du retard par rapport à la normale virent progressivement à l'ocre puis au rouge.
- Une phrase s'affiche au bon moment, par exemple « Kolda : saison en retard de 70 mm ».
- C'est le moment le plus fort : la saison réelle qui se rejoue sous les yeux.

**Plan 5 — La plongée sur un département.**
- Clic, ou toucher, sur un département : la caméra descend au ras du relief, et une fiche s'ouvre en verre dépoli (sur téléphone, un panneau qui monte depuis le bas).
- Elle montre la pluie de la saison comparée à la normale, les cultures et les cycles conseillés (« Maïs : cycle court adapté »), les besoins en intrants et la vulnérabilité.
- Peu de chiffres, de grandes phrases, le détail au clic.

**Plan 6 — AgroDistrib.**
- Pour une organisation (ONG, service de l'État) : un stock (par exemple 500 t d'urée) part en **flux lumineux animés** vers les territoires prioritaires selon leurs besoins et leur vulnérabilité.

### Ce que tu dois savoir du projet

- **Lis d'abord**, sans rien modifier :
  - `app/README.md` (le front existant) ;
  - `app/src/App.tsx`, `app/src/auth/`, `app/src/pages/Connexion.tsx`, `Inscription.tsx` et `AuthLayout.tsx` (la connexion et l'inscription, détaillées plus bas) ;
  - `api/README.md` (les routes expliquées) ;
  - `docs/technique/contrat-donnees.md` (les colonnes) ;
  - `docs/technique/guide-api.md`.
- **Front existant** : React 19, Vite, TypeScript strict, Tailwind CSS 4 (thème « Ciel & Terre »), Mapbox GL 3 via react-map-gl, TanStack Query, Recharts, PWA, React Router 7. Il tourne aujourd'hui sur des données d'exemple (`VITE_USE_MOCK=true`). Garde cette base, enrichis-la, ne la jette pas.
- **API réelle** : `python -m api` à la racine, sur `http://localhost:8080`, documentation sur `/docs`.
  - Toutes les routes sont sous `/api/v1` : référentiels, carte agroclimatique par campagne ou par département, suivi décadaire, choix des cultures, besoins, AgroDistrib, vulnérabilité.
  - Les réponses sont précalculées et très rapides.
  - **Attention** : les routes appelées par `app/src/api/index.ts` (`/carte`, `/suivi`…) ne correspondent pas encore à celles de l'API. Propose comment aligner le client du front sur l'API réelle, et n'aligne qu'après validation.
- **Géographie disponible** :
  - latitude et longitude des 45 départements, dans la carte agroclimatique et le référentiel des départements ;
  - contours des 6 zones : `app/public/geo/zones_agroecologiques.geojson` (jointure sur le nom de zone, en majuscules) ;
  - contours des départements (GADM 4.1) **pas encore disponibles**. Tant qu'ils manquent, utilise des colonnes ou des points 3D sur les coordonnées. Prévois qu'un GeoJSON simplifié des départements les remplacera sans tout refaire.
- **Il n'existe pas encore de landing page** : aujourd'hui, `/` est une route protégée (l'accueil de l'application). Un visiteur non connecté est renvoyé directement sur `/connexion`. La landing est donc à créer comme **page publique**. Propose comment l'organiser dans `src/App.tsx` (par exemple : `/` affiche la landing aux visiteurs et l'accueil de l'application aux utilisateurs connectés), sans casser les liens existants ni la redirection après connexion.
- **Le vent mondial** est un décor de contexte (prévisions mondiales fournies par Mapbox), pas une donnée du projet. Il vit sur le globe. Dès qu'on est au Sénégal, ce sont nos données qui parlent.

### Connexion et inscription : ce qui existe, ce qu'il faut garder

Le **fond** de l'authentification est déjà bien construit. Tu refais **l'apparence et la mise en scène**, pas la mécanique. Lis ces fichiers avant de proposer quoi que ce soit.

**Les fichiers**

| Fichier | Rôle |
|---|---|
| `src/types/auth.ts` | Les types : `Role` (`PRODUCTEUR`, `CONSEILLER`, `ORGANISATION`, `ADMIN`), `TypeOrganisation` (`ONG`, `ETAT`, `SEMENCIER`), `Utilisateur` (id, email, nom, rôle, organisation, `code_departement`), `Session` (`access_token`, `token_type: 'bearer'`, `user`), `DonneesInscription` (nom, email, password, `code_departement`) |
| `src/auth/session.ts` | Stocke la session (jeton + utilisateur) dans `localStorage` sous la clé `assaman.session`, avec un repli en mémoire en navigation privée. Prévient les abonnés à chaque changement. **Seul endroit qui touche au stockage de la session** : si l'API passe un jour à un cookie httpOnly, seuls ce fichier et `src/api/client.ts` changent |
| `src/auth/AuthContext.tsx` | Fournit `user`, `estConnecte`, `login`, `register` et `logout` à toute l'application (`useAuth()`). À l'ouverture, revalide le profil avec `GET /auth/me` (rôle modifié, compte désactivé). À la déconnexion, **vide le cache des données** (TanStack Query) pour qu'aucune donnée d'un compte ne reste visible pour le suivant |
| `src/auth/RouteProtegee.tsx` | Garde des routes : non connecté → redirection vers `/connexion` en mémorisant la page demandée (`state.depuis`) ; connecté sans le droit → écran « Accès réservé » |
| `src/auth/roles.ts` | Libellés des rôles et table `ACCES` (qui voit quoi) : AgroDistrib pour les ONG, les services de l'État et l'admin ; offre de semences pour les semenciers et l'admin (si `VITE_ACTIVER_SEMENCIERS=true`) ; administration pour l'admin. Tout le reste est ouvert à tout utilisateur connecté |
| `src/api/client.ts` | Ajoute `Authorization: Bearer <jeton>` à chaque appel. Sur une réponse **401**, efface la session (retour à la connexion) avec le message « Session expirée, reconnectez-vous ». Transforme les erreurs en messages lisibles |
| `src/api/index.ts` | `api.login`, `api.register`, `api.moi` : les trois appels d'authentification |
| `src/pages/Connexion.tsx` | Formulaire email et mot de passe. Après la connexion, renvoie vers la page demandée avant la redirection (`state.depuis`), sinon vers `/`. En mode exemple, affiche des **boutons de comptes de démonstration** (connexion en un clic) |
| `src/pages/Inscription.tsx` | **Inscription libre réservée aux producteurs** : nom, email, département (liste tirée des référentiels), mot de passe de 8 caractères minimum. Les comptes d'organisation (ONG, État) et de conseiller sont créés par un administrateur : le dire clairement sur l'écran |
| `src/pages/AuthLayout.tsx` | Mise en page actuelle des deux écrans. **Le panneau visuel est masqué sur téléphone** (`hidden lg:flex`) : c'est exactement ce qu'il faut changer, le décor doit exister sur téléphone aussi |
| `src/api/mock/comptes.ts`, `src/api/mock/serveur.ts` | Mode exemple : 6 comptes de démonstration (mot de passe `demo2026`), inscription enregistrée dans le navigateur, erreurs réalistes (400 identifiants faux, 409 email déjà utilisé, 422 champs manquants), jeton factice `demo-<id>` |

**Le contrat attendu de l'API d'authentification**

- `POST /auth/login`, corps `{ email, password }` → `Session`.
- `POST /auth/register`, corps `{ nom, email, password, code_departement }` → `Session`, avec le rôle `PRODUCTEUR`.
- `GET /auth/me`, avec le jeton → `Utilisateur`.
- Erreurs au format FastAPI `{ detail: "..." }`.

**Important : ce back n'existe pas encore.** L'authentification relève de la base de l'application (PostgreSQL), pas de Snowflake. Elle sera mise en place plus tard. **Le front doit être prêt dès maintenant** : il respecte ce contrat et fonctionne en mode exemple. Le jour où le back sera branché, seuls quelques réglages devront changer, pas les écrans. L'API actuelle (`api/`) n'expose que les données des marts : elle n'a **aucune route `/auth`**. Le format d'erreur de nos routes de données est `{ "erreur": { "code", "message", "aide" } }`, que `client.ts` ne lit pas encore. Conséquences :
1. **N'invente pas de back d'authentification** et ne modifie pas `api/`. Signale-le dans ton rapport.
2. Aujourd'hui, `VITE_USE_MOCK` bascule **tout** d'un coup (authentification et données). Pour le site déployé, on veut des **vraies données** avec des **comptes de démonstration** tant que le back d'authentification n'existe pas. Propose une solution propre, par exemple deux réglages distincts (authentification d'exemple, données réelles), et fais-la valider avant de l'appliquer.
3. Fais lire à `client.ts` les deux formats d'erreur (`detail` de FastAPI et `erreur.message` de notre API), pour que l'utilisateur voie toujours une phrase claire, jamais « Erreur 404 ».

**Ce qu'il faut garder, quel que soit le nouveau design**

- Toute la mécanique ci-dessus : `useAuth`, `RouteProtegee`, `sessionStore`, la table `ACCES`, la revalidation par `/auth/me`, le vidage du cache à la déconnexion, la redirection vers la page demandée après la connexion, la déconnexion automatique sur 401.
- Les **boutons de comptes de démonstration**, mais mis en scène :
  - par exemple « Entrer comme… » avec un producteur de Kaolack, une ONG, un service de l'État, un conseiller ;
  - un clic suffit ;
  - c'est ce que les visiteurs du site déployé utiliseront le plus ;
  - n'affiche pas le profil semencier si `VITE_ACTIVER_SEMENCIERS=false`.
- Les bons attributs de formulaire :
  - de vrais `<label>` ;
  - `autocomplete` (`email`, `current-password`, `new-password`, `name`) pour que les gestionnaires de mots de passe et le remplissage automatique du téléphone fonctionnent ;
  - `type="email"` pour le bon clavier sur téléphone ;
  - messages d'erreur annoncés aux lecteurs d'écran (`role="alert"`).
- La règle des 8 caractères minimum, vérifiée avant l'envoi avec un message clair.
- Un utilisateur déjà connecté qui ouvre `/connexion` ou `/inscription` est renvoyé vers l'application.

**Sécurité**

- **Le mot de passe ne quitte jamais le formulaire** autrement que dans l'appel `login` ou `register` : ni dans `localStorage`, ni dans l'URL, ni dans les journaux de la console.
- Aucun jeton dans l'URL.
- Aucune information sensible dans les messages d'erreur. Par exemple, « Email ou mot de passe incorrect », sans préciser lequel des deux.
- Le profil chargé après connexion ne sert qu'à l'affichage. Les vrais contrôles d'accès seront faits par le back.

**Après la connexion, selon le profil**

- **Producteur** : la plongée se termine sur **son département** (`code_departement`), et la fiche s'ouvre sur ses cultures.
- **Conseiller** : même chose sur son département de rattachement s'il en a un, sinon vue du Sénégal.
- **Organisation (ONG, État)** : vue du Sénégal, puis mise en avant d'AgroDistrib.
- **Administrateur** : vue du Sénégal, avec accès à l'administration.

La déconnexion (dans la barre de l'application) ramène sur la landing, avec une transition douce inverse : la caméra remonte vers le globe.

### Règles non négociables

1. **Vérité des données.**
   - Une valeur absente s'affiche « non disponible » ou « dose à saisir », **jamais 0**.
   - La vulnérabilité est « relative et indicative » : écris-le avec élégance (un petit badge), ne le cache pas.
   - Les doses non validées portent un badge « à confirmer avec l'ISRA ».
   - Ces experts repèrent tout de suite une démo qui triche, et l'honnêteté fait partie du « waouh ».
2. **Chaque effet répond à une question.** Pluie et fleurs : « le projet parle d'eau et de récoltes ». Film de la saison : « voici le retard, en direct ». Un effet qui ne raconte rien, on l'enlève.
3. **Fluidité : 60 images par seconde visées.**
   - Charge en différé tout ce qui est lourd (carte, 3D), et fais apparaître la landing en moins de 2 secondes.
   - Limite le nombre de particules, plafonne la résolution sur les écrans très denses, mets en pause les animations quand l'onglet est caché.
   - Mesure, ne suppose pas.
4. **Deux modes.**
   - **Vitrine** : tout est activé.
   - **Léger** : carte 2D, mêmes données. Il s'active automatiquement si l'appareil est faible, si la connexion est lente ou si l'utilisateur préfère réduire les animations.
   - Spectaculaire sur grand écran, utilisable sur un téléphone au champ.
5. **Accessibilité.**
   - Contrastes lisibles, navigation au clavier.
   - Respect de « réduire les animations » : on garde un rendu beau mais calme.
   - Textes en français clair.
6. **Original.** Inspire-toi de l'ambiance de mapbox.com, mais ne copie ni leurs textes, ni leurs visuels, ni leur marque. L'identité est la nôtre : ciel et terre, couleurs du Sahel (ocre, vert mil, bleu pluie, or du soir).
7. **Secrets.**
   - Le token Mapbox est un token **public** (`pk.…`) dans `app/.env.local`, restreint au domaine du site.
   - Aucun mot de passe ni aucune clé privée dans le front.
8. **Périmètre.**
   - Tu travailles **uniquement dans `app/`**. Ne modifie ni `api/`, ni `dbt/`, ni `docs/technique/etat-modelisation.md`.
   - S'il manque une donnée ou une route, écris-le dans ton rapport au lieu de l'inventer.
   - Ne commite pas et ne pousse pas sans qu'on te le demande.
9. **Vérifie avant d'utiliser.** Pour chaque fonction de Mapbox (globe, atmosphère, relief, particules de vent, extrusions, caméra), vérifie dans la documentation à jour de Mapbox qu'elle existe dans la version installée, et ses conditions d'usage (quotas, compte gratuit). Si une fonction n'est pas disponible, propose l'alternative la plus proche.
10. **Responsive, pensé pour le téléphone d'abord.** Beaucoup ouvriront le lien sur leur téléphone, souvent à la verticale, parfois avec une connexion moyenne. Chaque plan de l'histoire doit être conçu pour le téléphone **en même temps** que pour le grand écran, pas adapté après coup.
    - **Landing sur téléphone** :
      - le globe reste le héros, cadré pour l'écran vertical ;
      - moins de particules, pluie et fleurs plus sobres ;
      - texte lisible sans zoomer, boutons faciles à toucher au pouce, au moins 44 px.
    - **Carte sur téléphone** :
      - gestes naturels : pincer pour zoomer, glisser, incliner à deux doigts ;
      - la fiche d'un département monte en panneau depuis le bas de l'écran (comme les applications de cartes), au lieu d'une fenêtre qui couvre tout ;
      - la ligne de temps du film de la saison se manipule au pouce.
    - **Aucun défilement horizontal**, aucun texte coupé, aucun élément caché sous l'encoche ou la barre du navigateur.
    - **Tester sur les formats réels**, à chaque étape et dans les deux orientations :
      - petit téléphone (environ 360 px de large) ;
      - grand téléphone ;
      - tablette ;
      - portable ;
      - grand écran.

      Mesurer aussi le chargement en simulant une connexion 4G moyenne. La landing doit être belle et fluide sur un téléphone Android de milieu de gamme, pas seulement sur un ordinateur puissant.
11. **Un travail d'artisan, pas un rendu générique.** Le site doit donner l'impression d'avoir été dessiné et construit avec soin par une équipe qui connaît le Sénégal. Il ne doit pas ressembler à un modèle tout fait.
    - **À bannir** : les dégradés violets et bleus passe-partout, les grilles de cartes identiques, les icônes génériques ou les émojis en guise d'illustration, les textes vagues (« Révolutionnez votre agriculture »), les ombres et coins arrondis partout de la même façon, les images de stock.
    - **À rechercher** :
      - une identité propre : couleurs du Sahel, typographies choisies avec intention (une pour les titres, une pour le texte) ;
      - des mises en page qui osent l'asymétrie et le vide ;
      - des détails soignés : micro-animations au survol et au toucher, transitions qui ont un rythme, états de chargement qui font partie du décor (la pluie qui commence au lieu d'un rond qui tourne) ;
      - des textes écrits pour de vraies personnes : un producteur de Kaolack, une responsable d'ONG.
    - **Des contenus vrais** : de vrais noms de départements et de cultures, de vraies valeurs de l'API. Jamais de « Lorem ipsum » ni de chiffres inventés à l'écran.
    - **Un code propre et cohérent**, comme celui d'un développeur front expérimenté :
      - composants bien nommés, en français comme le reste du projet ;
      - pas de commentaires qui paraphrasent le code ;
      - pas de fichiers ou de dépendances inutiles ;
      - le style du code existant de `app/` respecté.

### Méthode de travail

1. **D'abord, sans rien écrire** :
   - lis les documents listés et le front existant ;
   - rends un plan court : l'architecture des écrans, les bibliothèques à ajouter (pourquoi chacune, son poids), l'ordre de construction, les risques ;
   - joins une **direction artistique en mots** : palette, typographies, rythme des mouvements, durée de chaque transition, et comment chaque plan se comporte sur téléphone.

   Attends la validation.
2. **Construis un plan de l'histoire à la fois**, dans cet ordre :
   1. landing (globe, vent, pluie, fleurs), en page publique ;
   2. connexion, inscription et comptes de démonstration, dans le même décor, avec la mécanique existante conservée. Teste ces parcours à chaque étape :
      - connexion réussie ;
      - mauvais mot de passe ;
      - email déjà utilisé à l'inscription ;
      - mot de passe trop court ;
      - retour vers la page demandée après la connexion ;
      - déconnexion, puis vérification que le cache est vidé ;
      - session expirée ;
      - accès refusé à AgroDistrib pour un producteur ;
   3. mot de bienvenue avec la mascotte : version longue à la première connexion, version courte ensuite, texte selon le profil ;
   4. plongée Afrique → Sénégal avec les vraies données ;
   5. film de la saison ;
   6. fiche département ;
   7. AgroDistrib.
3. **À la fin de chaque plan** :
   - lance le front et décris ce qu'on voit ;
   - joins une vérification sur téléphone (petit et grand format, vertical et horizontal) : ce qu'on voit, ce qui a été adapté, la fluidité mesurée ;
   - donne le temps de chargement et la fluidité mesurés sur ordinateur, les fichiers touchés, ce qui reste à régler ;
   - donne les commandes exactes pour lancer et voir le résultat ;
   - attends la validation avant de passer au plan suivant.
4. **Le lint, la vérification des types et le build** du front doivent passer à chaque étape (le CI les vérifie).

### La barre à atteindre

Une personne qui n'a jamais entendu parler du projet ouvre le lien, sur son ordinateur ou son téléphone. En 5 secondes, elle doit ressentir quelque chose. En 30 secondes, elle doit avoir compris que cette plateforme relie la pluie du ciel à chaque champ du Sénégal. En 2 minutes, elle doit avoir vu un vrai département, une vraie saison et un vrai conseil. Si ce n'est pas encore le cas, ce n'est pas fini.
