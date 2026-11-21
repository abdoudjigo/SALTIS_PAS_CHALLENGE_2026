# Module 02 : architecture

> Prérequis : `audit/01-cartographie.md`
> Rapport : `audit/02-architecture.md` · Préfixe des constats : `ARC`

## Rôle

Tu es architecte logiciel senior. Tu évalues si l'architecture tient la charge, l'évolution et l'équipe actuelles, et si elle est proportionnée au besoin (ni sous- ni sur-dimensionnée). Lecture seule ; règles et format dans `README.md`.

## Points de contrôle

### Découpage et responsabilités
- [ ] Style identifiable (monolithe modulaire, microservices, serverless, BaaS) et cohérent avec la taille de l'équipe.
- [ ] Séparation des couches : présentation / logique métier / accès aux données. Repère la logique métier dans les composants UI ou les contrôleurs, et le SQL dans les routes.
- [ ] Frontières de modules claires : pas d'imports croisés circulaires (`madge --circular`, `pydeps`, `import-linter`).
- [ ] Le domaine métier est lisible dans l'arborescence (détail dans la section suivante).

### Structure et organisation des dossiers
Commence par produire l'arborescence réelle (`tree -L 3 -d -I "node_modules|.git|venv|.venv|dist|build|__pycache__|.next"`), puis évalue :

**Racine du dépôt**
- [ ] Racine propre et lisible : README, config d'outils, et quelques dossiers clairs (`apps/`, `packages/`, `services/`, `docs/`, `infra/`, `scripts/`), sans scripts en vrac, fichiers de test ou dumps qui traînent.
- [ ] Monorepo : séparation nette entre applications déployables (`apps/web`, `apps/api`) et code partagé (`packages/ui`, `packages/types`, `packages/config`) ; chaque package a son propre `package.json` / `pyproject.toml`.
- [ ] Fichiers de configuration rangés et non dupliqués (un seul `tsconfig` de base étendu, un seul `.eslintrc`, etc.).

**Stratégie d'organisation**
- [ ] Stratégie identifiable et **appliquée partout** : par fonctionnalité (`features/auth`, `features/chat`, `features/parcelles`), par couche (`controllers/`, `services/`, `models/`), ou hybride. Repère les mélanges incohérents entre dossiers.
- [ ] Au-delà d'une taille moyenne, l'organisation par fonctionnalité est préférée : tout ce qui concerne une fonctionnalité (UI, hooks, API, types, tests) est regroupé.
- [ ] Profondeur raisonnable : pas plus de 4 ou 5 niveaux ; pas de dossiers contenant un seul fichier en cascade.
- [ ] Taille des dossiers : signale ceux qui contiennent plus de 20 à 30 fichiers à plat.

**Front**
- [ ] Séparation claire : pages/routes, composants partagés (design system), composants propres à une fonctionnalité, hooks, services/API, état, types, utilitaires, assets, traductions (`locales/fr`, `locales/wo`).
- [ ] Conventions du framework respectées (ex. `app/` de Next.js, routes groupées, `_components` privés).
- [ ] Pas de dossier fourre-tout (`utils/`, `helpers/`, `misc/`, `common/` de plus de 15 fichiers sans sous-structure).

**Back**
- [ ] Couches visibles dans l'arborescence : routes/contrôleurs → services (métier) → accès aux données (repositories/models) ; schémas de validation et DTO rangés à part.
- [ ] Migrations, seeds, scripts ponctuels et jobs/workers dans des dossiers dédiés.
- [ ] Config par environnement centralisée (`config/`), pas dispersée.

**Data et IA**
- [ ] Séparation `data/raw`, `data/processed` (ou équivalent), **ignorés par git** si volumineux ou personnels.
- [ ] Notebooks d'exploration (`notebooks/`, numérotés et datés) séparés du code de prod (`src/pipelines`, `src/models`).
- [ ] Prompts, jeux d'évaluation, configs de modèles et artefacts (poids, index) rangés et versionnés, ou référencés via un stockage dédié.
- [ ] Code partagé entre data et back (schémas, features) dans un module commun, pas copié.

**Tests, docs, infra**
- [ ] Emplacement des tests cohérent (à côté du code, ou dans `tests/` en miroir de `src/`), un seul choix.
- [ ] `docs/` avec architecture, ADR, API, runbooks ; `infra/` ou `deploy/` pour Docker, IaC, CI.

**Nommage**
- [ ] Convention unique de nommage des fichiers et dossiers (`kebab-case`, `PascalCase` pour les composants, `snake_case` en Python) appliquée partout.
- [ ] Une seule langue pour les noms (anglais conseillé) ; pas de mélange `utilisateur/` et `users/`.
- [ ] Pas de doublons ou versions sauvegardées (`Button2.tsx`, `old/`, `backup/`, `*_v2_final.py`, `copy of`).

**Règles d'import**
- [ ] Alias d'import (`@/features/...`) plutôt que `../../../../`.
- [ ] Une fonctionnalité n'importe pas l'intérieur d'une autre : elle passe par son point d'entrée public (`index.ts`).
- [ ] Les règles sont outillées (ESLint `import/no-restricted-paths`, `eslint-plugin-boundaries`, dependency-cruiser, `import-linter` en Python) plutôt que tacites.

### Couplage et contrats
- [ ] Contrats entre front et back explicites : OpenAPI, types partagés, tRPC, GraphQL schema.
- [ ] Dépendances aux fournisseurs isolées derrière une interface (LLM, paiement, SMS) : changer de fournisseur doit toucher un seul module.
- [ ] Config externalisée (12-factor) : aucune URL ni clé en dur.

### Scalabilité et résilience
- [ ] Composants sans état, ou état externalisé (sessions, fichiers, caches).
- [ ] Traitements lourds (IA, imports, e-mails, rapports) en asynchrone : file de tâches, workers, crons.
- [ ] Points uniques de défaillance identifiés (un seul serveur, une seule BDD sans sauvegarde, un fournisseur LLM sans repli).
- [ ] Timeouts, retries avec backoff et coupe-circuit sur les appels externes.
- [ ] Stratégie de cache (HTTP, applicatif, CDN) adaptée.

### Adéquation au contexte
- [ ] Fonctionnement en réseau lent ou instable : taille des réponses, pagination, mode hors ligne ou PWA si pertinent, reprise sur erreur.
- [ ] Multilingue (FR, wolof, autres) prévu dans l'architecture : i18n, contenus, modèles.
- [ ] Coût d'exploitation prévisible à 10x et 100x d'utilisateurs (surtout les appels LLM et le stockage).

### Décisions et évolution
- [ ] Décisions d'architecture documentées (ADR, README, schémas).
- [ ] Choix techniques justifiables ; repère la sur-ingénierie (Kubernetes pour 50 utilisateurs) comme la sous-ingénierie.

## Livrables du rapport

1. Note globale /5 et 3 forces, 3 faiblesses.
2. Diagramme Mermaid de l'architecture **actuelle**, avec les points faibles annotés.
3. Liste des constats `ARC-xx` au format standard.
4. **Structure des dossiers** :
   - arborescence actuelle (3 niveaux) annotée des problèmes ;
   - arborescence **cible** proposée, adaptée à la stack réelle ;
   - tableau de correspondance `ancien chemin → nouveau chemin` pour les déplacements principaux ;
   - ordre de réorganisation progressif (un module à la fois, avec les tests qui passent à chaque étape) et règles de convention à ajouter dans le README ou un `CONTRIBUTING.md`.
5. Architecture **cible** recommandée à 6 mois (diagramme + étapes de migration progressives, sans big bang).
6. Tableau des risques : risque, probabilité, impact, parade.

## Commandes utiles

```bash
tree -L 3 -d -I "node_modules|.git|venv|.venv|dist|build|__pycache__|.next"
find . -type d -not -path "*/node_modules/*" -not -path "./.git/*" -exec sh -c 'n=$(find "$1" -maxdepth 1 -type f | wc -l); [ "$n" -gt 25 ] && echo "$n $1"' _ {} \; | sort -rn   # dossiers trop gros
find . -type d -not -path "*/node_modules/*" -not -path "./.git/*" | awk -F/ '{print NF-1}' | sort -n | tail -1                                   # profondeur max
find . -not -path "*/node_modules/*" -iregex ".*\(old\|backup\|copy\|_v[0-9]\|final\|2\)\.\(ts\|tsx\|js\|py\)$"                                  # doublons et copies
grep -rEn "from ['\"](\.\./){3,}" --include=*.{ts,tsx,js} src/ | wc -l                                                                           # imports relatifs profonds
npx madge --circular --extensions ts,tsx src/
npx depcruise src --output-type err-long
pip install pydeps && pydeps <package> --show-cycles
grep -rEn "https?://[a-z0-9.-]+\.(com|io|sn|net|app)" --include=*.{js,ts,tsx,py} . | grep -v node_modules | grep -v test
```
