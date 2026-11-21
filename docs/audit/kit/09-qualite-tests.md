# Module 09 : qualité du code, tests, dette technique et documentation

> Prérequis : `audit/01-cartographie.md`
> Rapport : `audit/09-qualite.md` · Préfixe des constats : `QUA`

## Rôle

Tu es tech lead. Tu évalues si une nouvelle personne peut comprendre, modifier et livrer le code sans peur de tout casser. Lecture seule ; règles et format dans `README.md`.

## Points de contrôle

### Qualité du code
- [ ] Linter et formateur configurés (ESLint/Prettier, Ruff/Black) et appliqués : nombre d'erreurs et d'avertissements actuels.
- [ ] Typage : TypeScript strict, type hints Python + mypy/pyright.
- [ ] Complexité : fonctions les plus longues et les plus complexes (top 10), fichiers « dieu ».
- [ ] Duplication de code (`jscpd`) : taux et principaux blocs dupliqués.
- [ ] Code mort, dépendances inutilisées, fichiers orphelins.
- [ ] Nommage cohérent, une seule langue dans le code (anglais conseillé) ; commentaires utiles.
- [ ] Gestion des erreurs homogène ; pas de `console.log` / `print` de debug laissés partout.
- [ ] `TODO` / `FIXME` / `HACK` : nombre et ceux qui concernent la sécurité ou la donnée.

### Tests
- [ ] Types présents : unitaires, intégration, end-to-end (Playwright, Cypress), tests de données, tests IA.
- [ ] Lance la suite de tests : combien passent, échouent, sont ignorés ? Durée ?
- [ ] Couverture globale et, surtout, **couverture des parcours critiques** (auth, paiement, logique métier, calculs).
- [ ] Qualité des tests : assertions réelles, pas seulement « ça ne plante pas » ; tests déterministes (pas de flaky).
- [ ] Mocks raisonnables ; données de test isolées ; BDD de test jetable (conteneur).
- [ ] Les tests tournent en CI et bloquent la fusion.

### Dette technique
- [ ] Dépendances obsolètes (`npm outdated`, `pip list --outdated`) : versions majeures de retard sur les frameworks principaux.
- [ ] Zones chaudes : fichiers à la fois **très modifiés** (git) et **complexes** = priorités de refactoring.
- [ ] Contournements temporaires devenus permanents.

### Documentation et expérience développeur
- [ ] README : objectif, prérequis, installation, lancement, tests, déploiement. Teste-le : l'installation fonctionne-t-elle telle qu'écrite ?
- [ ] `.env.example` complet et commenté.
- [ ] Documentation d'architecture, d'API, du modèle de données.
- [ ] Guide de contribution, conventions, template de PR.
- [ ] Temps estimé pour qu'un nouveau membre lance le projet en local.

## Livrables du rapport

1. Note /5 et synthèse : Code · Tests · Dette · Documentation · DX.
2. Tableau de mesures : erreurs de lint, `any`, duplication %, couverture %, tests OK/KO, dépendances obsolètes.
3. Top 10 des zones chaudes (fichier, nombre de modifications, complexité, recommandation).
4. Constats `QUA-xx` au format standard.
5. Stratégie de tests minimale : les 10 premiers tests à écrire, par ordre de valeur.

## Commandes utiles

```bash
npm run lint -- --format compact | tail -5; npx tsc --noEmit 2>&1 | tail -3
npm test -- --coverage; npx playwright test
ruff check . --statistics; mypy . | tail -3; pytest --cov --cov-report=term-missing
npx jscpd src/ --min-lines 10 --reporters console
npx ts-prune; npx depcheck; vulture . --min-confidence 80
npm outdated; pip list --outdated
radon cc -s -n C .                          # complexité Python
grep -rEn "TODO|FIXME|HACK|XXX" --include=*.{js,ts,tsx,py} . | grep -v node_modules | wc -l
# Zones chaudes : modifications par fichier sur 6 mois
git log --since="6 months ago" --name-only --pretty=format: | grep -E "\.(ts|tsx|js|py)$" | sort | uniq -c | sort -rn | head -15
```
