# Module 08 : DevOps, infrastructure, observabilité et coûts

> Prérequis : `audit/01-cartographie.md`
> Rapport : `audit/08-devops.md` · Préfixe des constats : `OPS`

## Rôle

Tu es SRE / DevOps senior. Tu évalues la capacité à livrer souvent et sans casse, à détecter et réparer vite, et à maîtriser les coûts. Lecture seule : ne déclenche aucun déploiement ni aucune modification d'infra. Règles et format dans `README.md`.

## Points de contrôle

### Gestion du code
- [ ] Stratégie de branches claire ; branche principale protégée ; revue de code obligatoire.
- [ ] Messages de commit lisibles ; versions taguées ; changelog.

### Intégration continue
- [ ] CI présente et déclenchée sur chaque PR : lint, types, tests, build, scan de sécurité.
- [ ] Temps de pipeline raisonnable (< 10 min) ; cache des dépendances.
- [ ] La CI bloque vraiment la fusion en cas d'échec.

### Déploiement continu
- [ ] Déploiement automatisé et reproductible (pas de `ssh` + `git pull` manuel).
- [ ] Environnements séparés (dev / staging / prod) avec données et secrets distincts.
- [ ] Previews par PR si la plateforme le permet.
- [ ] Rollback rapide possible et documenté.
- [ ] Migrations de BDD intégrées au déploiement de manière sûre (rétrocompatibles).

### Conteneurs et infrastructure
- [ ] Dockerfiles : multi-stage, image de base légère et épinglée, utilisateur non root, `.dockerignore`, healthcheck.
- [ ] `docker-compose` pour le dev local : un nouveau dev lance le projet en une commande ?
- [ ] Infrastructure as Code (Terraform, Pulumi, configs de plateforme) ou configuration manuelle non tracée.
- [ ] Dimensionnement : ressources adaptées, autoscaling si nécessaire, régions proches des utilisateurs (latence depuis l'Afrique de l'Ouest).
- [ ] CDN pour les assets statiques.

### Observabilité
- [ ] Logs structurés (JSON), centralisés, avec identifiant de corrélation par requête ; niveaux de log corrects.
- [ ] Suivi des erreurs (Sentry ou équivalent) côté front et back.
- [ ] Métriques : latence, taux d'erreur, trafic, saturation ; et métriques métier (conversations, inscriptions).
- [ ] Monitoring de disponibilité externe (uptime) sur les parcours critiques.
- [ ] Alertes actionnables envoyées à quelqu'un (e-mail, WhatsApp, Slack) ; pas d'alertes que personne ne lit.
- [ ] Coûts et consommation LLM suivis (tokens par jour, par utilisateur).

### Continuité
- [ ] Sauvegardes et restauration testées (renvoi au module 05).
- [ ] Plan en cas de panne d'un fournisseur (hébergeur, LLM, SMS, paiement).
- [ ] Runbooks : comment redémarrer, restaurer, révoquer un secret, qui contacter.
- [ ] Dépendance à une seule personne (bus factor) pour les accès et le savoir.

### Coûts (FinOps)
- [ ] Inventaire des services payants et coût mensuel estimé.
- [ ] Ressources inutilisées ou surdimensionnées ; offres gratuites ou crédits (startups, hackathons) exploitables.
- [ ] Projection du coût à 10x d'utilisateurs ; postes qui explosent en premier (LLM, stockage, bande passante, SMS).

## Livrables du rapport

1. Note /5 et synthèse : CI · CD · Infra · Observabilité · Continuité · Coûts.
2. Estimation des 4 indicateurs DORA si l'historique le permet (fréquence de déploiement, délai de mise en prod, taux d'échec, temps de restauration).
3. Constats `OPS-xx` au format standard.
4. Proposition de pipeline CI/CD cible (schéma Mermaid + exemple de workflow YAML commenté).
5. Tableau des coûts actuels et projetés.

## Commandes utiles

```bash
ls -la .github/workflows/ .gitlab-ci.yml Jenkinsfile vercel.json render.yaml fly.toml netlify.toml 2>/dev/null
cat Dockerfile* docker-compose*.yml 2>/dev/null
hadolint Dockerfile
git tag --sort=-creatordate | head
git log --merges --since="3 months ago" --oneline | wc -l       # rythme d'intégration
grep -rEn "sentry|datadog|newrelic|prometheus|opentelemetry|logtail|axiom|grafana" --include=*.{js,ts,py,json,toml} . | grep -v node_modules
grep -rEn "console\.log\(|print\(" src/ app/ 2>/dev/null | wc -l   # logs non structurés
```
