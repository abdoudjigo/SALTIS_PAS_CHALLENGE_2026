# Module 01 : cadrage et cartographie

> Premier module, obligatoire. Les autres modules s'appuient sur sa carte.
> Rapport : `audit/01-cartographie.md`

## Rôle

Tu es architecte logiciel. Tu dresses l'inventaire factuel du système, **sans encore juger**. Lecture seule ; règles et format dans `README.md`.

## À produire

### 1. Fiche d'identité
- Langages et versions (`package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Dockerfile`, `.nvmrc`, `.python-version`).
- Frameworks principaux et leur version, en signalant ceux qui sont en fin de vie.
- Type de dépôt : monorepo, multi-repo, outil (Turborepo, Nx, pnpm workspaces...).
- Volumétrie : nombre de fichiers et de lignes par langage (`cloc` ou `tokei` si disponibles, sinon `find` + `wc -l`).

### 2. Carte des composants
Pour chaque application ou service : nom, rôle, dossier, point d'entrée, port, dépendances internes.

| Composant | Rôle | Dossier | Techno | Entrée | Dépend de |
|---|---|---|---|---|---|

### 3. Flux et intégrations
- Services externes : BDD, cache, stockage objet, file de messages, e-mail/SMS, paiement (Wave, Orange Money...), API LLM, cartographie, auth tierce.
- Méthode : cherche les SDK dans les dépendances et les URL / clés dans `.env.example`, `config/`, `settings`.
- Variables d'environnement : liste les **noms** uniquement (jamais les valeurs) et signale celles qui sont utilisées dans le code sans figurer dans `.env.example`.

### 4. Diagramme
Un diagramme Mermaid (`flowchart LR`) des composants et des flux : client → front → API → BDD / services externes / LLM.

### 5. Environnements et déploiement
Ce qui est visible dans le dépôt : Dockerfile, docker-compose, CI (`.github/workflows`, `.gitlab-ci.yml`), IaC (Terraform...), configs Vercel / Render / Netlify / Fly.

### 6. Parcours critiques
Les 3 à 5 parcours utilisateur les plus importants (inscription, paiement, question au chatbot, tableau de bord...) et les fichiers qui les portent. Les autres modules les auditeront en priorité.

### 7. Zones d'ombre
Ce que tu n'as pas pu déterminer et qui demande une info ou un accès.

## Commandes utiles

```bash
git log --oneline | wc -l; git shortlog -sn | head
git log --since="3 months ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20   # fichiers les plus modifiés
find . -name "node_modules" -prune -o -name ".git" -prune -o -type f -print | sed 's/.*\.//' | sort | uniq -c | sort -rn | head
grep -rEn "process\.env\.|os\.environ|os\.getenv|import\.meta\.env" --include=*.{js,ts,tsx,py} . | grep -v node_modules
```

## Fin de module

Termine par un résumé de 5 lignes et la liste des modules suivants pertinents.
