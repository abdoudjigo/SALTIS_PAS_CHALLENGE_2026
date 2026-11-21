# 09 · Qualité du code, tests, dette technique et documentation — Assaman & Suuf

> Audit du 21/11/2026, branche `dev/all-recup` (commit `51e448d`). Lecture seule.
> Outils lancés en local : `ruff`, `pytest` + `pytest-cov`, `mypy`, `radon`, `vulture` (installés dans `venv/`) ; `tsc`, ESLint du projet avec règles `complexity` et `max-lines-per-function` ajoutées **en ligne de commande**, sans toucher à la configuration ; `npm outdated`, `pip list --outdated`. `jscpd`, `ts-prune` et `depcheck` n'ont pas pu être lancés (`npx` refusé) : la duplication est estimée à la main.
> Préfixe des constats : `QUA`.

---

## 1. Note globale : **3 / 5**

Le code se lit bien et il est **très documenté** : 37 fichiers Markdown, des commentaires qui expliquent le *pourquoi*, une seule langue (le français). Le back est bien testé.

Le front, en revanche, **n'a aucun test**, alors que ses écrans contiennent la logique de conseil la plus complexe du projet (complexité cyclomatique jusqu'à 155). Une nouvelle personne peut lancer le front en démonstration en 10 minutes. Il lui faut des accès personnels (Snowflake, Drive) pour le reste.

| Domaine | Note | En bref |
|---|---|---|
| Code | 3 | TS `strict` (1 cast), ESLint propre, ruff CI propre. Mais 12 écrans dépassent une complexité de 20 (jusqu'à 155) ; `construire()` côté API est à 61. |
| Tests | 3 | 121 tests Python réussis (API 91 %, `ml` : AgroDistrib seulement), 345 tests dbt. **0 test front, 0 test de bout en bout.** |
| Dette | 3 | Peu de dette visible (6 `À FAIRE`, tous sur la relecture wolof). Duplications front-back (ARC-04, ARC-05), double moteur AgroDistrib (ARC-01), modèles et docs obsolètes. |
| Documentation | 4 | README par dossier, contrat de données, fiche par modèle, journal de modélisation, cahier des charges V1. Quelques documents contradictoires (OPS-09). |
| Expérience développeur | 3 | `make`, `.env.example` commenté, données d'exemple côté front. Mais `make install` crée `.venv` alors que l'équipe utilise `venv`, le README est orienté PowerShell, il n'y a pas de `.python-version`, et l'API exige Snowflake. |

---

## 2. Mesures

| Mesure | Valeur | Commande |
|---|---|---|
| ESLint (configuration du projet) | 0 erreur, 0 avertissement ; 18 `eslint-disable` | `npx eslint .` |
| TypeScript | `strict: true`, 0 erreur ; 1 `as unknown as` (`Scene.tsx:35`) ; `noUncheckedIndexedAccess: false` | `npm run typecheck` |
| Ruff (règles de la CI) | 0 erreur | `ruff check . --select E9,F63,F7,F82,F401` |
| Ruff (règles étendues du poste) | 50 remarques, surtout de style (`C408` ×20, `UP017` ×5, `I001` ×5…) | `ruff check api ml ingestion voix --statistics` |
| mypy (`api/`, hors tests) | **60 erreurs**, surtout des `Optional` non vérifiés (`union-attr` 23, `arg-type` 21, `call-arg` 9) ; aucun mypy dans la CI | `mypy api --ignore-missing-imports` |
| Complexité Python (radon ≥ C) | 15 fonctions ; pire : `api/cache/construction.py:289 construire` = **F (61)**, `main` = D (24) | `radon cc -s -n C` |
| Complexité front (> 20) | **20 fonctions**, dont `Parcelle` **155**, `Surface` 106, `Saison` 93, `BesoinsPays` 76, `Campagne` 73, `Semer` 73, `QuandSemer` 61, `ContreSaison` 59, `Repartir` 55, `exporterFicheOng` 51 | ESLint `complexity: [warn, 20]` |
| Fonctions front > 150 lignes | `Carte` 488, `Landing` 303, `Parcelle` 232, `Carte` (effet interne) 218, `Surface` 204, `Campagne` 203, `Semer` 197, `Repartir` 181 | ESLint `max-lines-per-function` |
| Code mort Python (vulture ≥ 80 %) | 0 | `vulture … --min-confidence 80` |
| Duplication | Non mesurée par outil. Doublons connus : types front / schémas Pydantic (ARC-04), nombres et phrases wolof TS / Python (ARC-05), formule AgroDistrib front / `ml` (ARC-01), référentiels de doses (DATA-08) | revue manuelle |
| `TODO` / `FIXME` / `À FAIRE` | 6, tous « À FAIRE RELIRE » en wolof (`api/voix/*.py`, `scene/wolof.ts`) | `grep` |
| `console.log` (front) / `print` (API hors tests) | 0 / 8 (dans `api/__main__.py` et `cache/prechargement.py`, scripts en ligne de commande : légitime) | `grep` |
| Tests Python | **121 réussis, 0 échec, 0 ignoré, 9,6 s** | `pytest api/tests ml/tests` |
| Couverture API | **91 %** ; `prechargement.py` 0 %, `source_snowflake.py` 38 %, `voix/tts_local.py` 41 %, `voix/espace.py` 46 % | `pytest --cov=api` |
| Couverture `ml` | 11 tests (AgroDistrib) ; M1, M3, M4 : 0 | `ls ml/tests` |
| Tests dbt | 345 (génériques + 19 SQL) | `dbt parse`, manifeste |
| Tests front | **0** fichier `*.test.*` ou `*.spec.*` ; ni Vitest, ni Jest, ni Playwright dans `package.json` | `find`, `grep` |
| Dépendances front en retard d'une version majeure | TypeScript 5.9 → 7.0, react-router 7 → 8, ESLint 9 → 10 (9.39 plus maintenu), `@types/node` 22 → 26 | `npm outdated` |
| Dépendances Python (venv) | FastAPI 0.162 → 0.165, pydantic 2.14.3 → 2.14.4 : rien de majeur | `pip list --outdated` |

---

## 3. Top 10 des zones chaudes (modifiées souvent et complexes)

| # | Fichier | Modifications (git) | Taille / complexité | Recommandation |
|---|---|---|---|---|
| 1 | `app/src/scene/modes/Parcelle.tsx` | 5 | 344 l., complexité **155** | Sortir les règles (culture conseillée, fenêtre de semis, sacs/ha) dans `parcelle/regles.ts` testé ; le composant n'affiche plus que le résultat |
| 2 | `app/src/scene/Carte.tsx` | 7 | 675 l., fonction de 488 l. | Découper : couches, caméra, animations, repères ; un hook par effet |
| 3 | `api/cache/construction.py` | 7 | 648 l., `construire()` **F (61)** | Une fonction par mart (`_construire_<mart>`, déjà fait pour 4 sur 9), testée seule ; garder `construire()` comme simple chef d'orchestre |
| 4 | `app/src/pages/Scene.tsx` | 8 | 272 l., complexité 26 | Extraire la gestion du dossier ONG (`sessionStorage`) et de la navigation entre modes |
| 5 | `app/src/scene/modes/Surface.tsx` | 5 | 281 l., complexité 106 | Calcul des besoins (doses × surface, statuts) en fonction pure testée : ce sont des chiffres d'intrants montrés aux agriculteurs |
| 6 | `app/src/scene/modes/Saison.tsx` | 6 | 220 l., complexité 93 | Idem pour le choix océan / tendance et les phrases de fiabilité |
| 7 | `app/src/scene/modes/Campagne.tsx` | 4 | 277 l., complexité 73 | Idem (tableau par département : pluie, risque, vulnérabilité) |
| 8 | `app/src/scene/ui.tsx` | 6 | 371 l. | Un fichier par composant partagé (`ui/Fiche.tsx`, `ui/Champ.tsx`…) |
| 9 | `app/src/api/index.ts` | 7 | 166 l. | Types générés depuis OpenAPI (ARC-04) ; isoler le faux serveur (ARC-06) |
| 10 | `api/schemas/__init__.py` + `api/marts.py` + `api/docs.py` | 8 + 7 + 8 | petits fichiers, mais modifiés à chaque nouveau mart | Signe d'un contrat recopié : générer depuis dbt (`contract`, DATA-07) |

---

## 4. Constats

### [QUA-01] Aucun test front, alors que les écrans contiennent la logique de conseil la plus complexe
- Sévérité : 🟠 Élevé   Statut : Constaté
- Où : `app/` (0 test, aucun outil de test dans `app/package.json`) ; complexité : `Parcelle.tsx:71` (155), `Surface.tsx:46` (106), `Saison.tsx:70` (93), `BesoinsPays.tsx:20` (76), `Campagne.tsx:61` (73), `Semer.tsx:74` (73), `Repartir.tsx:27` (55) ; règles : `scene/conseil.ts`, `scene/repartition.ts`, `scene/besoinsPays.ts`, `scene/fiabilite.ts` (complexité 28)
- Constat : le front ne fait pas qu'afficher. Il **calcule** des sacs d'engrais par hectare, des besoins pour une surface, la répartition d'un stock (ARC-01), la culture conseillée, le choix entre prévision océan et tendance, et les phrases de fiabilité. Ces calculs sont mêlés au rendu, dans des fonctions de 150 à 230 lignes, et aucun test ne les vérifie. Les bugs FE-01 (service worker) et IA-01 (alertes non fiables) seraient passés inaperçus avec ou sans CI.
- Impact : chaque modification d'écran risque de changer un chiffre montré aux agriculteurs ou aux autorités. Personne ne le saurait avant la démo. La règle « jamais 0 pour une valeur inconnue » n'est vérifiée qu'à la relecture.
- Recommandation : installer **Vitest** (même chaîne que Vite) et tester d'abord les fonctions pures existantes (`repartition.ts`, `conseil.ts`, `lib/format.ts`, `besoinsPays.ts`, `fiabilite.ts`). Puis extraire les règles de `Parcelle`, `Surface` et `Saison` en fonctions pures. Ajouter **1 test Playwright** du parcours P1 + P2 (porte agriculteur → ma parcelle → que semer) avec les données d'exemple. Lancer `npm test` dans le job `front` de la CI.
- Effort : M

### [QUA-02] Pas de test de bout en bout ni de test de la configuration de prod
- Sévérité : 🟡 Moyen   Statut : Constaté
- Où : `.github/workflows/ci.yml` (job `front` : `VITE_USE_MOCK=true`) ; aucun test HTTP contre un conteneur
- Constat : les tests de l'API utilisent `TestClient` et des données de test (`api/tests/donnees_test.py`), ce qui est bien. Le front n'est construit qu'en mode « données d'exemple ». Rien ne vérifie le site complet **tel qu'il est livré** : Caddy, API, service worker et `VITE_API_URL` vide.
- Impact : FE-01, la différence de comportement de Caddy (404/200, module 01) ou une route oubliée dans `@page` du `Caddyfile` ne se voient qu'en prod.
- Recommandation : un test de fumée en CI : `docker compose -f docker-compose.prod.yml` avec un `DOMAINE=localhost` (certificat interne de Caddy) et le cache chargé depuis `api/tests/donnees_test.py`, puis 5 requêtes `curl` (pages, `/api/v1/systeme/sante`, une route de données) et 1 parcours Playwright avec passage hors ligne.
- Effort : M

### [QUA-03] Typage Python non vérifié (60 erreurs mypy dans `api/`)
- Sévérité : 🔵 Faible   Statut : Constaté
- Où : `api/cache/service.py` (18), `api/voix/repondre.py` (9), `api/config.py` (9), `api/cache/construction.py` (8)…
- Constat : les annotations de type sont présentes, ce qui est un bon point, mais jamais vérifiées. La plupart des erreurs sont des `Optional` non contrôlés (`self.stockage` peut être `None`). Ce ne sont pas des bugs observés, puisque les tests passent, mais le filet manque.
- Recommandation : `mypy api` (ou `pyright`) en CI, d'abord en mode non bloquant. Corriger les `union-attr` de `service.py` avec une assertion de démarrage ou une propriété non optionnelle.
- Effort : S

### [QUA-04] Fonctions « dieu » côté API : `construire()` (complexité 61)
- Sévérité : 🔵 Faible   Statut : Constaté
- Où : `api/cache/construction.py:289-487`
- Constat : une seule fonction de 200 lignes construit les réponses de 5 marts. Les autres (`_construire_opportunites`, `_construire_previsions`, `_construire_prix`, `_construire_cadre_harmonise`) sont déjà séparées. Couverture à 99 % : le risque est faible, c'est surtout une question de lisibilité et de reprise.
- Recommandation : terminer le découpage (une fonction par mart), comme pour les 4 déjà extraites.
- Effort : S

### [QUA-05] Mise en route : instructions divergentes et accès personnels nécessaires
- **Suivi (21/11/2026, après l'audit)** : 🟡 Partiellement corrigé — README racine unifié (structure, démarrage Linux et Windows, `venv/`), `.python-version` (3.12), `.nvmrc` (22), `make test` et `make verifier`. **Reste** : un mode « données locales » pour lancer l'API sans Snowflake.
- Sévérité : 🟡 Moyen   Statut : Constaté
- Où :
  - `README.md:33-39` (démarrage rapide `make install` → `.venv`) ;
  - `README.md:44-63` (procédure PowerShell et `dbt.ps1`, Windows) ;
  - `Makefile` (`.venv/bin/…`) alors que le venv réel est `venv/` (module 01) ;
  - `REGLE.md` (consignes pour un assistant IA, renvoie à `dev/aby` et `.venv`) ;
  - pas de `.python-version` ni de `.nvmrc` (Python 3.14 sur le poste, 3.12 en CI et en prod) ;
  - `api/config.py` (l'API exige Snowflake pour démarrer) ;
  - `README.md:83` (données sur un Drive partagé)
- Constat : estimation de mise en route pour une nouvelle personne :
  - **Front en démonstration** : ≈ 10 minutes (`make front-install && make front`), sans aucun accès.
  - **API** : impossible sans identifiants Snowflake. Il n'existe pas de mode « données locales » pour les marts, seulement pour les sorties ML.
  - **dbt et ML** : Snowflake, plus les CSV du Drive, plus le code amont absent (DATA-02).
- Impact : un nouveau membre, un évaluateur ou un partenaire technique (ISRA, ANSD) ne peut pas faire tourner la plateforme complète, ni reproduire un chiffre. Dépendance aux personnes (OPS-07).
- Recommandation : un seul démarrage rapide, Linux et Windows (`venv/` partout). `.python-version` (3.12) et `.nvmrc` (22). Un mode `SOURCE_DONNEES=local` pour l'API, qui lit des parquet d'exemple versionnés (quelques départements, données publiques). Déplacer `REGLE.md` dans `.claude/` ou `docs/`.
- Effort : S

### [QUA-06] Documentation riche mais par endroits contradictoire ou périmée
- **Suivi (21/11/2026, après l'audit)** : 🟡 Partiellement corrigé — documentation de déploiement et de rafraîchissement corrigée, `docs/` rangé avec un index (`docs/README.md`). **Reste** : date « vérifié le » dans chaque README, fiabilité des modèles (IA-07).
- Sévérité : 🔵 Faible   Statut : Constaté
- Où :
  - `app/README.md:189-238` (déploiement Vercel, Render, Neon, OPS-09) ;
  - `deploy/README.md:56` (rafraîchissement faux, ARC-03) ;
  - `ml/MODELES.md` (RPSS +0,22 / +0,17, IA-07) ;
  - `docs/etat-modelisation.md:387` (« aucun traceur n'est branché », alors qu'Umami l'est depuis : à confirmer au module 14) ;
  - contexte de l'audit (« schéma CI isolé », DATA-01)
- Constat : 37 fichiers Markdown, environ 1 500 lignes dans les 6 README principaux. La qualité de rédaction est remarquable, mais plusieurs documents décrivent un état ancien.
- Recommandation : une date « vérifié le » en tête de chaque README. Une relecture des documents de déploiement et de modèles avant chaque présentation. Générer ce qui peut l'être (contrat de données depuis dbt, fiabilité depuis `evaluation_m*.csv`).
- Effort : S

### [QUA-07] Dépendances front avec une version majeure de retard sur l'outillage
- Sévérité : 🔵 Faible   Statut : Constaté
- Où : `app/package.json` ; `npm outdated`
- Constat : ESLint 9.39 n'est plus maintenu (10 disponible). TypeScript 7, react-router 8 et `@types/node` 26 sont disponibles. React 19, Vite 8 et Tailwind 4 sont à jour.
- Recommandation : monter ESLint et `typescript-eslint` maintenant (outillage seulement). Planifier react-router 8 et TypeScript 7 **après** la démo, avec les tests de QUA-01 en filet de sécurité.
- Effort : S

---

## 5. Stratégie de tests minimale : les 10 premiers tests à écrire

| # | Test | Type | Pourquoi d'abord | Lien |
|---|---|---|---|---|
| 1 | Service worker : un écran déjà vu s'affiche en mode avion | Playwright (build de prod) | La promesse « hors ligne » est fausse aujourd'hui | FE-01 |
| 2 | Alerte récolte : aucune alerte quand `alerte_fiable` est faux partout (années 2026-2035) | Vitest sur une fonction extraite de `AlerteRecolte` | Chiffre faux montré aux autorités | IA-01 |
| 3 | `repartir()` : somme ≤ stock, part ≤ besoin, département sans vulnérabilité traité comme la moyenne, et **même résultat que `ml/agrodistrib` sur un cas fixe** | Vitest + fixture issue de `ml/sorties` | Deux moteurs divergents | ARC-01 |
| 4 | Besoins d'une surface : dose `null` → « dose à saisir », jamais 0 ; doses × surface exactes ; statut `A_CONFIRMER` affiché | Vitest (règle extraite de `Surface.tsx`) | Quantités d'intrants pour les agriculteurs | QUA-01, DATA-06 |
| 5 | `lib/format.ts` : `null`, `undefined` et `NaN` → « — » ; séparateurs français ; FCFA sans décimales | Vitest | Règle « jamais 0 » | — |
| 6 | Parcours P1 + P2 : porte agriculteur → choisir un département **sans carte** (FE-02) → que semer | Playwright (données d'exemple) | Premier écran de la démo | FE-02 |
| 7 | CI : aucun modèle dbt ne se résout dans `STAGING`, `INTERMEDIATE` ou `MARTS` avec la cible `ci` | pytest sur `manifest.json` | Écriture en prod | DATA-01 |
| 8 | `/voix/parler` : 7ᵉ demande → `503` ; texte hors modèle ou trop long → refusé | pytest | Abus de la voix | BE-01 |
| 9 | Source réelle dans `meta.source` quand le secours CSV est utilisé | pytest (faux lecteur Snowflake) | Traçabilité des prévisions | BE-04 |
| 10 | M1 : pas de fuite temporelle (l'année testée est absente de l'entraînement), plages et colonnes des sorties, `*_fiable` cohérent avec `evaluation_m*.csv` | pytest sur `ml/` | Reproductibilité des prévisions | IA-06 |

---

## Résumé

- **3/5.** Code lisible, très documenté et en une seule langue. Back bien testé (121 tests réussis, 91 % de couverture de l'API, 345 tests dbt). ESLint, TS strict et ruff de la CI propres.
- 🟠 QUA-01 : **0 test front**, alors que les écrans portent la logique de conseil (complexité 155 pour `Parcelle`, 106 pour `Surface`, 93 pour `Saison`, 20 fonctions au-dessus de 20).
- 🟡 Pas de test de bout en bout ni de la configuration de prod. Mise en route divergente (`.venv` ou `venv`, PowerShell, pas de version Python figée), et l'API exige Snowflake pour démarrer.
- 🔵 60 erreurs mypy non vérifiées. `construire()` à 61 de complexité. Documentation par endroits périmée. ESLint 9 plus maintenu.
- 10 premiers tests proposés, en tête : le mode hors ligne, les alertes non fiables, et l'équivalence des deux moteurs AgroDistrib.
