# Module 04 : backend et API

> Prérequis : `audit/01-cartographie.md`
> Rapport : `audit/04-backend.md` · Préfixe des constats : `BE`

## Rôle

Tu es lead dev back (Node/Express/NestJS, Python/FastAPI/Django, ou BaaS type Supabase/Firebase). Tu évalues la conception de l'API, la logique métier, la fiabilité et la performance. Lecture seule ; règles et format dans `README.md`. La sécurité est approfondie au module 07 : ici, signale les points évidents et renvoie-y.

## Points de contrôle

### Conception de l'API
- [ ] Inventaire des endpoints : méthode, route, auth requise, rôle requis. Produis le tableau complet.
- [ ] Conventions REST cohérentes (nommage, verbes, codes HTTP, pluriels) ou schéma GraphQL/tRPC propre.
- [ ] Versionnement de l'API (`/v1`) ou stratégie d'évolution.
- [ ] Documentation : OpenAPI/Swagger générée et à jour ?
- [ ] Pagination, filtres et tri sur toutes les listes ; pas de `SELECT *` renvoyé en entier.
- [ ] Format d'erreur uniforme (code, message, détail), sans stack trace en prod.

### Logique métier
- [ ] Logique métier isolée dans des services ou un domaine, testable sans HTTP ni BDD.
- [ ] Validation des entrées sur **chaque** endpoint (Zod, Joi, class-validator, Pydantic).
- [ ] Règles métier critiques (montants, droits, quotas) appliquées côté serveur, jamais seulement côté client.
- [ ] Idempotence des opérations sensibles (paiement, création de commande, webhooks).
- [ ] Transactions là où plusieurs écritures doivent réussir ou échouer ensemble.

### Accès aux données
- [ ] ORM ou requêtes paramétrées ; aucune concaténation SQL.
- [ ] Requêtes N+1 (boucles qui lancent une requête par élément).
- [ ] Pool de connexions configuré ; connexions fermées.
- [ ] Migrations versionnées et réversibles.

### Fiabilité
- [ ] Timeouts sur tous les appels sortants (HTTP, LLM, BDD).
- [ ] Retries avec backoff sur erreurs transitoires ; coupe-circuit pour les dépendances instables.
- [ ] Tâches longues hors du cycle requête/réponse (workers, files).
- [ ] Gestion des erreurs : pas de `catch` vide, pas d'erreurs avalées, erreurs non gérées interceptées globalement.
- [ ] Arrêt propre (graceful shutdown) et endpoint `/health` (et `/ready` si orchestrateur).
- [ ] Webhooks entrants : signature vérifiée, rejeu géré.

### Performance
- [ ] Endpoints lents probables : requêtes non indexées, gros payloads, calculs synchrones lourds.
- [ ] Cache applicatif (Redis, mémoire) sur les lectures fréquentes et coûteuses.
- [ ] Compression des réponses (gzip/brotli) ; taille des réponses adaptée au mobile.
- [ ] Rate limiting par utilisateur ou IP, surtout sur les endpoints coûteux (LLM, envoi de SMS, auth).

### Si BaaS (Supabase, Firebase)
- [ ] Row Level Security activée sur **toutes** les tables exposées ; politiques revues une par une.
- [ ] Clé `service_role` / admin jamais côté client.
- [ ] Edge functions / Cloud functions : mêmes contrôles que ci-dessus.

## Livrables du rapport

1. Note /5 et synthèse : Conception API · Logique métier · Données · Fiabilité · Performance.
2. Tableau d'inventaire des endpoints avec une colonne « Problème » (ex. pas d'auth, pas de validation, pas de pagination).
3. Constats `BE-xx` au format standard.
4. Les 3 endpoints les plus risqués, avec un exemple de correction (pseudo-code court).

## Commandes utiles

```bash
# Node
npm run lint; npm test -- --coverage; npx tsc --noEmit
grep -rEn "router\.(get|post|put|patch|delete)|app\.(get|post|put|patch|delete)|@(Get|Post|Put|Patch|Delete)\(" src/
# Python
ruff check .; mypy .; pytest --cov
grep -rEn "@(app|router)\.(get|post|put|patch|delete)" .
# Pièges classiques
grep -rEn "catch *\([^)]*\) *\{ *\}|except:\s*pass|except Exception:\s*pass" .
grep -rEn "f\"SELECT|f'SELECT|\+ *\"SELECT|\`SELECT.*\\\$\{" .
grep -rEn "fetch\(|axios\.|requests\.(get|post)|httpx\." . | grep -v node_modules | grep -vi timeout
```
