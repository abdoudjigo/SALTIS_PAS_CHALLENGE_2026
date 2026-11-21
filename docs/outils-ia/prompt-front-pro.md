# Brief — passe « professionnelle » du front Assaman & Suuf

Tu reprends le front d'une plateforme d'aide à la décision agricole au Sénégal. La structure existe et fonctionne. Ta mission est de la faire passer du stade « prototype réussi » au stade **produit qu'une institution présente à un ministre**. Tu travailles sur le design, la typographie et l'ergonomie, pas sur les données.

Le résultat ne doit pas ressembler à un site généré par une IA. Il doit donner l'impression d'avoir été dessiné par un studio qui connaît la cartographie et l'agriculture.

---

## 1. Lancer le projet et le regarder avant de toucher au code

Branche : `dev/front-djigo`. Ne change pas de branche, ne commite pas, ne pousse rien.

```bash
# à la racine du dépôt : l'API des données (Snowflake), port 8080, prête en ~15 s
python -m api            # ou venv/bin/python -m api

# dans app/
npm install
npm run dev              # http://localhost:5173
```

`app/.env.local` doit contenir au minimum :

```
VITE_API_URL=http://localhost:8080
VITE_AUTH_DEMO=true
VITE_DONNEES_DEMO=false
VITE_MAPBOX_TOKEN=pk.…   # token public, déjà présent chez Abdou
```

Pour entrer dans l'application, la landing propose deux portes : **Agriculteur** et **ONG et services de l'État**. Un clic suffit, avec des comptes de démonstration (mot de passe `demo2026`).

**Avant d'écrire une ligne**, fais le tour complet et prends des captures :
- grand écran (1440 × 900) ;
- téléphone (390 × 844, tactile) ;
- la landing du haut jusqu'au pied de page ;
- les 4 fonctionnalités agriculteur et les 4 fonctionnalités ONG.

Note ce qui fait amateur. Refais les mêmes captures à la fin pour comparer.

---

## 2. Ce qui existe (à garder)

| Partie | Fichiers |
|---|---|
| Landing claire, récit au défilement, deux portes | `app/src/pages/Landing.tsx`, `app/src/landing/` |
| Moteur de carte (globe, zones, volumes 3D, arcs, pluie) | `app/src/scene/Carte.tsx` |
| Scène après l'entrée, dock à gauche | `app/src/pages/Scene.tsx`, `app/src/scene/Dock.tsx` |
| Fenêtre de résultats (pop-up sur grand écran, tiroir à crans sur téléphone) | `app/src/scene/Fenetre.tsx`, `app/src/scene/crans.ts` |
| Briques des panneaux (titres, mesures, cartes repliables, légendes) | `app/src/scene/ui.tsx` |
| Les 7 fonctionnalités | `app/src/scene/modes/*.tsx` |
| Couleurs, polices, animations | `app/src/index.css` (bloc `@theme` et classes en fin de fichier) |

Garde intacts :
- le mouvement de la carte : globe qui descend sur les 6 zones, chapitres qui changent la carte, volumes 3D, arcs de répartition ;
- les deux profils et leurs fonctionnalités ;
- toute la logique de données : hooks, calculs, appels à l'API.

---

## 3. Les quatre chantiers

### 3.1 Landing : de la lumière, un bleu ciel « néon » maîtrisé

Aujourd'hui la landing est blanche et propre, mais plate. Ajoute de la profondeur avec des **dégradés bleu ciel lumineux**, comme un ciel de saison des pluies juste après l'orage.

- **Pars de la palette** (`--color-pluie-*`, `--color-brume`, `--color-vert-*`, `--color-terre-*`, `--color-soleil-*`). Si tu as besoin d'un bleu plus vif pour l'effet néon, ajoute **un ou deux tokens** dans `@theme`, nommés dans la langue du projet (ex. `--color-ciel-vif`), dérivés de `pluie-500`. N'écris jamais une couleur en dur dans un composant.
- **Où mettre les dégradés** :
  - un halo derrière le globe ;
  - un liseré lumineux sous l'en-tête ou au bord des cartes de récit ;
  - le fond de la section « Deux portes » ;
  - un reflet discret sur le bouton principal.
- **Dosage** : la lueur se remarque au deuxième regard, pas au premier. Pas de fond entièrement dégradé, pas d'arc-en-ciel, pas de violet.
- Le texte reste lisible partout (contraste AA au minimum).

### 3.2 Pied de page : le refaire entièrement

Le pied de page actuel est une simple liste de liens sur fond crème. Il fait gabarit.

Je veux un vrai pied de page institutionnel :
- **un fond qui termine la page**, par exemple un vert très profond (`vert-900`) ou un bleu nuit, avec une transition travaillée depuis la section précédente ;
- la marque, une phrase de mission, puis les colonnes de liens bien alignées ;
- **les sources et les crédits mis en forme comme un bloc à part**. Ils sont obligatoires : CHIRPS, SoilGrids, DAPSA, NASA POWER, et la citation exacte « GADM, version 4.1, https://gadm.org » ;
- la mention « Estimations indicatives, pas des garanties » ;
- l'équipe AKAI et le SALTIS PAS Challenge 2026 ;
- les réseaux sociaux : `config.reseaux`, avec « bientôt » quand un lien est vide ;
- lisible et aéré sur téléphone.

### 3.3 Typographie : un vrai couple de polices

Aujourd'hui : Fraunces pour les titres, Inter pour le texte. Le résultat est correct mais générique, et Fraunces en italique fait « template ».

- **Propose un couple de polices** qui évoque à la fois l'institution sérieuse et la terre. Justifie ton choix en deux lignes.
- **Contraintes** :
  - polices auto-hébergées par `@fontsource` (pas de Google Fonts à l'exécution, l'app est une PWA qui doit marcher hors ligne) ;
  - accents français parfaits ;
  - chiffres tabulaires pour les données ;
  - poids raisonnable : on vise des connexions lentes.
- **Pose une échelle typographique** dans `@theme` (tailles, interlignes, approches) et applique-la partout : landing, scène, pied de page. Plus de tailles inventées au cas par cas (`text-[15px]`, `text-[11px]`…) quand une taille de l'échelle convient.

### 3.4 La fenêtre de résultats : trois fois plus professionnelle

C'est le chantier principal. Après l'entrée, quand on choisit une fonctionnalité, les résultats s'affichent dans une fenêtre sombre à droite (un tiroir sur téléphone). Elle marche, mais :
- elle est dense et lourde : trop de texte gris, trop de petites cartes empilées, tout au même niveau ;
- elle cache une bonne part de la carte, alors que **la carte est le produit** ;
- on ne sait pas où regarder en premier.

Ce que je veux :

1. **Une hiérarchie en trois niveaux** :
   - **la réponse** : une phrase et un, deux ou trois chiffres clés, lisibles en deux secondes. Par exemple, pour la parcelle : « Kaolack · sol limoneux, légèrement acide · 5 cultures adaptées » ;
   - **le détail** : les mesures, par groupes ;
   - **les notes de méthode** : repliées par défaut, accessibles d'un clic. Ce sont les phrases sur la source, l'indicatif, le « à valider ».
2. **Elle ne gêne pas la carte** :
   - plus étroite et plus légère sur grand écran ;
   - elle se fait discrète (plus transparente ou repliée) pendant qu'on manipule la carte, puis revient ;
   - elle ne recouvre jamais la légende ni l'infobulle ;
   - la carte se recadre toujours dans l'espace laissé libre (voir `marge` dans `Scene.tsx`).
3. **Un style de produit cartographique haut de gamme** : pense à un tableau de bord de salle de crise ou à un outil d'analyse géospatiale.
   - Grille stricte, alignements nets, chiffres en grand et unités en petit.
   - Peu de bordures et peu de cartes dans les cartes : l'espace et la typographie font la structure.
   - Des micro-graphiques quand ils disent mieux qu'un nombre : barres, jauges, petite courbe de cumul de pluie.
   - Choisis une base, sombre ou claire, et applique-la avec cohérence.
4. **Une interaction soignée** :
   - le département touché sur la carte met la fenêtre à jour avec une transition courte ;
   - `Échap` réduit la fenêtre ;
   - le focus clavier est visible ;
   - le défilement interne ne fait pas défiler la carte ;
   - les états de chargement sont des squelettes, pas du texte « Chargement… ».
5. **Sur téléphone**, garde le tiroir à trois crans, mais rends-le aussi propre que sur grand écran. Au cran replié, la réponse en une ligne reste visible ; le détail n'apparaît qu'en tirant.

Applique ce modèle aux 7 fonctionnalités : ma parcelle, que semer, le ciel, mes besoins, vulnérabilité, besoins, répartir un stock. Factorise dans `ui.tsx` plutôt que de copier.

---

## 4. Règles

1. **Pas de rendu IA générique.** Interdits :
   - dégradés violet-rose ;
   - émojis ;
   - verre dépoli partout ;
   - toutes les cartes en `rounded-2xl` avec la même ombre ;
   - icônes décoratives sans fonction ;
   - textes creux du type « Révolutionnez votre agriculture ».
   Chaque choix doit avoir une raison.
2. **Les règles des données ne bougent pas** :
   - une valeur absente s'affiche « non disponible » ou « dose à saisir », **jamais 0** ;
   - la vulnérabilité reste marquée « relative et indicative » ;
   - les doses non validées gardent leur statut ;
   - ces mentions peuvent être repliées, jamais supprimées.
3. **Ne touche pas** :
   - à la logique des hooks (`src/hooks/`), à `src/api/` ;
   - au calcul de répartition (`src/scene/repartition.ts`) ;
   - à l'authentification (`src/auth/`) ;
   - aux types des marts.
4. **Couleurs** : uniquement par les tokens de `@theme`. Les couleurs des cartes (échelles de `src/scene/couleurs.ts`) peuvent être affinées, mais doivent rester dans la palette « Ciel & Terre » : vert culture, ocre terre, bleu pluie, jaune soleil.
5. **Accessibilité** :
   - contraste AA ;
   - cibles tactiles de 44 px au minimum ;
   - `prefers-reduced-motion` respecté (les lueurs et animations se calment) ;
   - textes en français correct, avec accents.
6. **Performance** :
   - pas de nouvelle bibliothèque lourde (pas de framer-motion ni de bibliothèque d'interface complète) : CSS et React suffisent ;
   - le mode léger (`src/vitrine/modeRendu.ts`) doit continuer de marcher.
7. **Responsive**, testé à 360, 390, 768, 1024 et 1440 px de large, sans défilement horizontal.
8. Tout le code et les commentaires restent **en français**, comme le reste du projet.

---

## 5. Méthode

1. Tour complet et captures « avant » (section 1).
2. Propose en quelques lignes ta direction visuelle :
   - le couple de polices ;
   - les nouveaux tokens ;
   - le principe de la fenêtre de résultats (base claire ou sombre, largeur, comportement) ;
   - le principe du pied de page.
3. Applique dans cet ordre :
   1. tokens et typographie ;
   2. fenêtre de résultats et briques de `ui.tsx` ;
   3. les 7 fonctionnalités ;
   4. landing (dégradés) ;
   5. pied de page.
4. À chaque étape : `npx tsc -p .`, `npx eslint .`, puis captures grand écran et téléphone.
5. À la fin : `npm run build`, captures « après » des mêmes écrans qu'au départ.

## 6. Ce que tu rends

- La liste des fichiers modifiés et créés.
- Les captures avant / après, au moins :
  - le hero ;
  - un chapitre du récit ;
  - le pied de page ;
  - « Ma parcelle » ;
  - « Répartir un stock » ;
  - le tiroir sur téléphone.
- Tes choix (polices, tokens, fenêtre), en quelques lignes chacun.
- Ce que tu n'as pas pu faire, et pourquoi.
