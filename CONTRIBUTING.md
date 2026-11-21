# Contribuer

## Workflow Git
- `main` = version stable (démo, production). `develop` = intégration.
- Une branche par tâche, partie de `develop` : `dev/<prénom>-<sujet>` (ex. `dev/aby-doses-isra`).
- Jamais de push direct sur `main` : Pull Request vers `develop`, puis de `develop` vers `main`, avec **1 relecture** et le CI au vert (`ci-status`).
- Avant d'ouvrir la PR : `make verifier` (ruff, tests Python, lint et build du front).
- Commits courts, préfixés : `feat:`, `fix:`, `docs:`, `data:`, `refactor:`, `test:`, `chore:` (portée facultative : `feat(app): …`).

## Ce qui ne va jamais dans Git
- Aucun secret : mots de passe, jetons, clés (`.env` est ignoré ; `.env.example` ne contient que des noms de variables et des exemples).
- Aucune donnée lourde ni brute : `data/raw/`, `data/modules/`, `dataset/`, `ml/donnees/` sont ignorés.
- Aucune donnée personnelle réelle (noms, téléphones, positions de parcelles) dans le code, les tests ou la documentation.

## Organisation et conventions
- **Un dossier = une partie du système** : `api/`, `app/`, `dbt/`, `ml/`, `ingestion/`, `snowflake/`, `voix/`, `deploy/`, `docs/` (voir la section « Structure du dépôt » du `README.md`). Chaque dossier a son `README.md`, mis à jour avec le code.
- **Langue** : le français partout (noms de fichiers, variables, commentaires, documentation), comme le reste du dépôt.
- **Nommage** :
  - Python : `snake_case.py` ;
  - SQL dbt : `stg_*`, `int_*`, `dim_*`, `fact_*`, `mart_*` ;
  - front : composants React en `PascalCase.tsx`, logique en `camelCase.ts`.
- **Front (`app/src/`)** :
  - écrans de la carte dans `scene/modes/` ; règles de calcul dans `scene/regles/`, en `.ts` sans affichage (testables) ; carte dans `scene/carte/`, interface commune dans `scene/interface/`, voix dans `scene/voix/` (détail : `app/README.md`, section 2) ;
  - appels d'API seulement par `src/api/index.ts` ;
  - types des réponses dans `src/types/`.
- **Valeurs inconnues** : `null`, jamais 0, en base comme à l'écran (`docs/technique/contrat-donnees.md`).
- **Snowflake** : un script qui modifie Snowflake (`create`, `drop`, `grant`…) est écrit dans `snowflake/`, relu, puis exécuté à la main. Il n'est jamais lancé par le CI.
- **Nouvelle source de données** : citer la source et sa licence (page « Données » du site, `docs/technique/contrat-donnees.md`) avant tout chargement.
