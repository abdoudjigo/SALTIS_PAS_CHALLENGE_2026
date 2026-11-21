# 07 · Sécurité — Assaman & Suuf

> Audit du 21/11/2026, branche `dev/all-recup` (commit `51e448d`). Revue de code et de configuration.
> **Aucune attaque** de la prod : seulement des requêtes passives (en-têtes, codes de retour, TLS, une requête `Origin` étrangère, un `POST` d'administration sans jeton) sur `https://assaman-suuf.tech`, avec l'accord de l'équipe.
> Outils : `detect-secrets 1.5`, recherche par motifs dans tout l'historique git (`git log -p --all`, 81 commits), `bandit`, `pip-audit`, `npm audit`, `openssl s_client`. `gitleaks`, `trivy` et `semgrep` ne sont pas installés ; `npx` est refusé par le contrôle des permissions.
> **Les secrets sont masqués** dans tout le rapport. Préfixe : `SEC`.

---

## 1. Note globale : **2 / 5** · maturité estimée **ASVS L1 partiel**

La configuration HTTP et le code de l'API sont **au-dessus de la moyenne** :
- TLS 1.3 seulement, HSTS, CSP stricte, CORS fermé ;
- conteneurs sans droits superflus et réseaux internes ;
- entrées validées, secrets en `SecretStr`, comparaison en temps constant.

La note est tirée vers le bas par **un secret réel poussé sur GitHub** (SEC-01), par la **CI qui écrit en prod avec un rôle trop puissant** (SEC-02, SEC-03) et par une surface d'abus sur la voix (SEC-04). Sans SEC-01, la note serait de 3.

---

## 2. OWASP Top 10 (2021)

| Catégorie | Statut | Constats liés |
|---|---|---|
| A01 Contrôle d'accès défaillant | **Partiel** | Données publiques par conception, administration protégée par jeton (`compare_digest`, limite 10/min). Mais `/systeme/cache` est public (SEC-07), et la CI écrit dans les schémas de prod (SEC-02). |
| A02 Défaillances cryptographiques | OK | TLS 1.3 seulement (TLS 1.0 et 1.1 refusés), HSTS 1 an, aucune crypto maison. |
| A03 Injection | OK | SQL : une requête par identifiants en liste blanche (`api/source_snowflake.py:24-40`). Pas d'`eval`, de `pickle` ni de `shell=True`. En-têtes e-mail protégés par la bibliothèque `email`. Front : `innerHTML` seulement sur du texte fixe. |
| A04 Conception non sécurisée | **Partiel** | Synthèse vocale de n'importe quel texte (SEC-04) ; fausse authentification côté client (SEC-09). |
| A05 Mauvaise configuration | **Partiel** | Très bons en-têtes ; `/docs` et `/redoc` coupés en prod. En revanche, le rôle `SYSADMIN` (SEC-03), un VPS administré en `root` sans durcissement documenté (SEC-05), et la base et Redis de dev publiés sur toutes les interfaces (SEC-10). |
| A06 Composants vulnérables | **Partiel** | 0 vulnérabilité connue dans les dépendances livrées (`pip-audit -r requirements-api.txt`, `npm audit --omit=dev`). Mais **aucune version Python figée**, pas de Dependabot, images non épinglées, modèles HF sans révision (SEC-06). |
| A07 Identification et authentification | Non applicable / partiel | Pas de comptes réels. La fausse session JWT dans `localStorage` n'ouvre aucun droit côté serveur (SEC-09). |
| A08 Intégrité des logiciels et des données | **KO** | La CI reconstruit les marts de prod depuis n'importe quelle branche `dev/*` (SEC-02). Modèles HF téléchargés sans version (SEC-06). Build sur le VPS sans signature. |
| A09 Journalisation et surveillance | **Partiel** | Journaux Docker avec rotation, erreurs 500 tracées côté serveur. Aucune alerte, aucun journal d'administration, aucune procédure d'incident (SEC-08). |
| A10 SSRF | OK | Aucune URL fournie par l'utilisateur n'est appelée par le serveur. Les URL de téléchargement d'`ingestion/` sont fixes (`bandit B310`, faux positif). |

**OWASP API Security Top 10** : API1 (BOLA) et API5 (BFLA) non applicables, car il n'y a pas de ressource par utilisateur. **API4 (consommation de ressources non bornée)** : voir SEC-04. API8 (mauvaise configuration) : SEC-07.

---

## 3. Constats (du plus grave au moins grave)

### [SEC-01] Mot de passe d'application SMTP réel dans `.env.example`, commité et poussé sur GitHub
- **Suivi (21/11/2026, après l'audit)** : ✅ Corrigé — mot de passe d'application **révoqué** par l'équipe dans le compte Google, et valeurs SMTP retirées de `.env.example` (commit `2a9c664`, branche `assaman_suuf`). L'ancienne valeur reste lisible dans l'historique git (commit `51e448d`), mais elle ne fonctionne plus. **Recommandé** : vérifier l'activité récente du compte Google et nettoyer l'historique si le dépôt devient public.
- Sévérité : 🔴 Critique   Statut : Constaté
- Où : `.env.example:51-55` (`SMTP_HOST`, `SMTP_USER`, **`SMTP_PASSWORD=kk************`**, `AVIS_DESTINATAIRE`) ; ajouté par le commit `51e448d` (« fusion des deux branches », 21/11/2026) ; présent sur `origin/dev/all-recup`
- Constat : la valeur a la forme d'un mot de passe d'application Gmail (16 lettres minuscules). Ce n'est pas un exemple. Elle diffère de celle du `.env` local, ce qui laisse penser qu'il s'agit d'un autre compte ou d'un ancien mot de passe encore valide. `detect-secrets` ne l'a pas détectée (entropie faible) : seule la recherche par motif dans l'historique l'a trouvée. La procédure de déploiement commence par `cp .env.example .env` (`deploy/README.md:23`) : la valeur se retrouve donc aussi sur tout serveur installé depuis ce commit.
- Scénario d'exploitation : quiconque lit le dépôt, ou une copie mise en cache par un robot de recherche de secrets si le dépôt est public, se connecte au compte SMTP de l'équipe et envoie des e-mails d'hameçonnage « au nom d'AKAI » aux ONG et aux services de l'État.
- Impact : usurpation de l'équipe auprès des partenaires institutionnels, blocage du compte par Google, perte du canal d'avis des ONG. Selon les droits du compte Google, accès à sa boîte.
- Recommandation : **révoquer aujourd'hui** le mot de passe d'application dans le compte Google concerné (Sécurité → Mots de passe des applications), en créer un nouveau, le mettre **uniquement** dans le `.env` du VPS. Vider les 4 valeurs SMTP de `.env.example`. Nettoyer l'historique (`git filter-repo` ou BFG) **après** la révocation : la révocation suffit à neutraliser la fuite, le nettoyage évite les fausses alertes futures. Vérifier si le dépôt `github.com/<propriétaire>/SALTIS_PAS_CHALLENGE_2026` est public. Ajouter `gitleaks` en hook pre-commit et en CI.
- Effort : S

### [SEC-02] La CI dbt écrit dans les schémas de prod depuis n'importe quelle branche
- **Suivi (21/11/2026, après l'audit)** : ✅ Corrigé dans le code — cible dbt `ci` dans `dbt/profiles.yml` ; `macros/generate_schema_name.sql` préfixe tous les schémas par `CI_` (vérifié par `dbt parse` : 56 modèles et seeds en `CI_STAGING`, `CI_INTERMEDIATE`, `CI_MARTS` ; la cible de production reste sur `STAGING`, `INTERMEDIATE`, `MARTS`). Le CI lance `dbt build --target ci` seulement sur les PR, `main`, `develop` ou à la main, et refuse de construire si un modèle vise un schéma hors `CI_*`. **Reste recommandé** : rôle Snowflake dédié au CI sans droit d'écriture sur la production (`SNOWFLAKE_CI_ROLE`), et vérifier dans `QUERY_HISTORY` ce que le CI a déjà écrit.
- Sévérité : 🔴 Critique   Statut : Probable (voir DATA-01)
- Où : `dbt/macros/generate_schema_name.sql:2-5` ; `.github/workflows/ci.yml` (push `dev/**`, `SNOWFLAKE_SCHEMA: CI` ignoré)
- Constat : détaillé en DATA-01. Côté sécurité : **toute personne qui peut pousser une branche `dev/*`** (4 contributeurs aujourd'hui) modifie les marts de prod sans relecture, avec les identifiants Snowflake du CI, probablement `SYSADMIN` (SEC-03).
- Scénario d'exploitation : un compte GitHub d'équipe compromis, ou un modèle dbt modifié par erreur, pousse une branche `dev/x`. Les chiffres de prod sont réécrits, puis servis au prochain rafraîchissement.
- Recommandation : voir DATA-01 (schémas préfixés ou base `SALTIS_CI`, rôle CI sans droit sur `SALTIS`, build de prod seulement depuis `main`). Protéger `main` (revue obligatoire, `ci-status` requis).
- Effort : S

### [SEC-03] Rôle Snowflake `SYSADMIN` pour l'API, dbt et l'ingestion ; authentification par mot de passe
- Sévérité : 🟠 Élevé   Statut : Probable (`.env` de prod non lu)
- Où : `.env.example:9` (`SNOWFLAKE_ROLE=SYSADMIN`) ; `api/config.py` (défaut `SYSADMIN`) ; `docs/etat-modelisation.md:273` ; `docker-compose.prod.yml` (`env_file: .env` pour l'API)
- Constat : l'API, exposée sur internet et qui ne fait que lire, détient des identifiants capables de créer, modifier et supprimer tout objet de la base, et de consommer des crédits d'entrepôt. Authentification par mot de passe simple : pas de paire de clés, pas de restriction d'adresse IP réseau Snowflake documentée.
- Scénario d'exploitation : une faille dans une dépendance Python de l'API, ou un accès au `.env` du VPS (SEC-05), donne `SYSADMIN` sur Snowflake. L'attaquant supprime `RAW`, qui ne peut pas être reconstruit (DATA-02, DATA-10), ou fait tourner l'entrepôt aux frais de l'équipe.
- Recommandation : rôles séparés (`R_API_LECTURE` en `SELECT` sur `MARTS` et `ML`, `R_DBT`, `R_INGESTION`, `R_ML` existant). Utilisateurs de service à **clé RSA**. *Network policy* Snowflake limitée à l'IP du VPS et aux IP des runners pour l'utilisateur CI. Plafond de crédits (*resource monitor*). Ne passer à l'API **que** ses variables (`environment:` explicite plutôt que `env_file: .env` entier, qui lui donne aussi `UMAMI_DB_PASSWORD`, `UMAMI_APP_SECRET`…).
- Effort : S

### [SEC-04] Consommation de ressources non bornée sur la voix (OWASP API4)
- Sévérité : 🟠 Élevé   Statut : Constaté (code)
- Où : `api/routes/voix.py:112-160` ; `api/voix/espace.py:32` (délai de 900 s) ; détail en BE-01 et BE-02
- Constat : `POST /voix/parler` synthétise tout texte jusqu'à 1 500 caractères, avec une file de 6 et un cache disque qu'on peut saturer. `POST /voix/question` (5 Mo d'audio) reste public sans client.
- Scénario d'exploitation : un script envoie 7 textes différents par minute depuis 2 ou 3 adresses. La voix wolof reste « occupée » pour tous, un cœur est saturé, la carte ralentit, et le cache vocal se remplit de textes inventés pour toujours.
- Recommandation : voir BE-01 (identifiants de phrases au lieu de texte libre, borne commune, délai de 60 s, cache LRU) et BE-02 (désactiver `/voix/question` et `/voix/texte`).
- Effort : M

### [SEC-05] VPS administré en `root`, durcissement non documenté
- Sévérité : 🟠 Élevé   Statut : À vérifier (configuration du VPS non vue)
- Où : `deploy/README.md:16` (`ssh root@<IP du VPS>`, `ufw allow 22,80,443/tcp`) ; aucune mention de clé SSH, de `PasswordAuthentication no`, de `fail2ban`, de `unattended-upgrades` ni de compte non `root`
- Constat : la procédure laisse SSH ouvert à tout internet, pour `root`, sans préciser la méthode d'authentification. Rappel : Docker contourne `ufw` pour les ports publiés. Seuls 80 et 443 le sont, et Umami est bien lié à `127.0.0.1:3001`, donc c'est correct aujourd'hui.
- Scénario d'exploitation : attaque par force brute ou réutilisation d'un mot de passe `root` (fréquente sur les VPS neufs). L'attaquant obtient tout : `.env` (Snowflake `SYSADMIN`, SMTP, Umami), données et site.
- Recommandation : compte nominatif dans le groupe `sudo`, clés SSH seulement (`PasswordAuthentication no`, `PermitRootLogin no`), `fail2ban`, `unattended-upgrades` pour les mises à jour de sécurité, SSH limité aux IP de l'équipe si possible, ou derrière le pare-feu Hostinger. Ajouter ces étapes à `deploy/README.md`, section 1.
- Effort : S

### [SEC-06] Chaîne d'approvisionnement : versions Python non figées, images et modèles non épinglés, pas de mises à jour automatisées
- Sévérité : 🟡 Moyen   Statut : Constaté
- Où : `requirements-api.txt`, `requirements-voix.txt`, `requirements.txt` (aucun `==`) ; `deploy/Dockerfile.*` (`python:3.12-slim`, `node:22-alpine`, `caddy:2-alpine`) ; `docker-compose.prod.yml` (`redis:7-alpine`, `postgres:16-alpine` ; seul `umami:3.4.1` est figé) ; `bandit B615` ×6 (`from_pretrained` sans `revision`) ; pas de `.github/dependabot.yml`
- Constat : chaque `docker compose up --build` sur le VPS installe les dernières versions publiées de FastAPI, Uvicorn, torch, transformers, etc. Aujourd'hui : `pip-audit -r requirements-api.txt` → **0 vulnérabilité**, `npm audit --omit=dev` → **0**. Le `venv` de dev contient `pip 25.1.1` avec 6 avis (PYSEC-2026-*), sans effet en prod.
- Scénario d'exploitation : une version piégée ou défectueuse d'une dépendance publiée entre deux déploiements part en prod sans relecture. C'est ce type d'attaque qui touche régulièrement PyPI et npm.
- Recommandation : `pip-compile` (ou `uv lock`) vers des fichiers figés avec empreintes (`--require-hashes`). Images épinglées par version et empreinte (`python:3.12.x-slim@sha256:…`). `revision=` sur les modèles HF. Dependabot pour `pip`, `npm`, `docker` et `github-actions`. `pip-audit` et `npm audit --omit=dev` en CI. Construire les images en CI et les publier, plutôt que les construire sur le VPS.
- Effort : S

### [SEC-07] Informations internes exposées publiquement (`/systeme/cache`, en-têtes de diagnostic)
- Sévérité : 🟡 Moyen   Statut : Constaté (prod)
- Où : `api/routes/systeme.py:50-54` ; `api/main.py:28` (`ENTETES_EXPOSES`) ; en-têtes de prod : `x-cache-mode: redis`, `x-data-version`, `server-timing`, `x-temps-traitement-ms`
- Constat : `GET /api/v1/systeme/cache` renvoie sans jeton la base et le schéma source (`SALTIS.MARTS`), les versions, les volumes, les durées de lecture Snowflake et le déclencheur (BE-05). Chaque réponse indique le mode de cache et le temps de traitement.
- Scénario d'exploitation : un attaquant repère les rafraîchissements, le nom de l'entrepôt, et mesure l'effet de ses requêtes sur la charge pour régler une attaque par épuisement (SEC-04).
- Recommandation : `/systeme/cache` derrière `exiger_admin`. Garder `X-Data-Version` (utile au front) et retirer `X-Cache-Mode` et `Server-Timing` en prod.
- Effort : S

### [SEC-08] Aucune procédure d'incident ni alerte de sécurité
- Sévérité : 🟡 Moyen   Statut : Constaté
- Où : aucun document `SECURITY.md` ni runbook ; `docker-compose.prod.yml` (journaux `json-file`, 3 × 10 Mo, sans envoi externe)
- Constat : personne n'est désigné pour recevoir un signalement. Il n'y a ni liste « secrets → où les révoquer », ni alerte sur les `401` répétés de l'administration ou sur une hausse des `429`, ni journal des actions d'administration (`rafraichir`, `retour-arriere`). Les journaux disparaissent après 30 Mo.
- Impact (cadre local) : en cas de fuite de données personnelles (avis des ONG, adresses IP), la loi n° 2008-12 attend un traitement sous la responsabilité du responsable de traitement, et la CDP peut être concernée (module 11). La loi n° 25/2026 crée des obligations de notification pour les opérateurs d'infrastructures critiques. La plateforme n'en est vraisemblablement pas un aujourd'hui, mais des clients publics peuvent imposer ces exigences par contrat. À revérifier avec un juriste.
- Recommandation : `SECURITY.md` (contact, délai de réponse) ; tableau des secrets (propriétaire, emplacement, procédure de révocation) ; journal d'administration (qui, quand, quelle IP) ; alerte simple (Uptime Kuma, ou `healthchecks.io` sur `/sante`) et envoi des journaux hors du VPS.
- Effort : S

### [SEC-09] Fausse session « JWT » dans `localStorage`, et identifiants de démo dans le code
- Sévérité : 🔵 Faible   Statut : Constaté
- Où : `app/src/auth/session.ts:5,31` ; `app/src/api/mock/comptes.ts:5` (mot de passe de démonstration en clair) ; `deploy/Dockerfile.web:14` (`VITE_AUTH_DEMO=true`)
- Constat : ce n'est pas une faille aujourd'hui. Le « jeton » n'est jamais envoyé à l'API (`sansJeton: config.authDemo`, `api/index.ts:32`), et les données sont publiques. Mais le mot de passe de démo est publié, et le modèle de session (jeton en `localStorage`, lisible par tout script) serait **dangereux s'il était réutilisé** le jour où de vrais comptes État et ONG arriveront.
- Recommandation : supprimer la fausse authentification (ARC-06). Pour la future offre payante : session en cookie `HttpOnly; Secure; SameSite=Lax` posé par l'API, mots de passe hachés en argon2id, MFA pour les comptes de l'État. Éviter l'OTP par SMS seul (SIM swap fréquent dans la région, module 13).
- Effort : S

### [SEC-10] Environnement de dev : PostgreSQL et Redis publiés sur toutes les interfaces
- **Suivi (21/11/2026, après l'audit)** : ✅ Corrigé — `docker-compose.yml` publie PostgreSQL et Redis sur `127.0.0.1` seulement.
- Sévérité : 🔵 Faible   Statut : Constaté
- Où : `docker-compose.yml` (`ports: ["5432:5432"]`, `["6379:6379"]`, Redis **sans mot de passe**)
- Constat : sur un portable de l'équipe connecté à un Wi-Fi public (université, café, salle de concours), Redis et PostgreSQL sont joignables par les autres machines du réseau. Docker contourne le pare-feu de l'hôte.
- Recommandation : `127.0.0.1:5432:5432` et `127.0.0.1:6379:6379`.
- Effort : S

### [SEC-11] Petites durcissements HTTP et proxy
- Sévérité : 🔵 Faible   Statut : Constaté
- Où : `docker-compose.prod.yml` (`FORWARDED_ALLOW_IPS: "*"` ; l'API partage le réseau `public` avec Umami) ; prod en ligne : HSTS sans `includeSubDomains` ni `preload`, et une adresse inconnue répond `200` (le `Caddyfile` du dépôt corrige ces deux points : à redéployer)
- Constat : Caddy, par défaut, n'accepte pas d'en-tête `X-Forwarded-For` venant d'internet. Mais avec `*`, tout conteneur du réseau `public` (Umami) peut se faire passer pour n'importe quelle adresse auprès de la limitation de débit.
- Recommandation : `FORWARDED_ALLOW_IPS` = adresse du conteneur `web` (réseau dédié `web-api`, avec une IP fixe). Redéployer le `Caddyfile` actuel. Envisager `preload` une fois le domaine stable.
- Effort : S

---

## 4. Ce qui est bien fait

- **Transport et en-têtes (prod)** : TLS 1.3 (`TLS_AES_128_GCM_SHA256`), TLS 1.0 et 1.1 refusés, certificat valide, HTTP → HTTPS en `308`, HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` restrictive, **CSP sans `unsafe-inline` pour les scripts ni `unsafe-eval`**.
- **CORS** : une requête avec `Origin: https://evil.example` ne reçoit pas d'`Access-Control-Allow-Origin` (même origine seulement).
- **Pas d'exposition d'outils** : `/openapi.json`, `/redoc`, `/.env`, `/.git/config` et `/stats/*` (sauf le script et la route d'envoi) renvoient la page du site, pas le contenu demandé. Administration `401` sans jeton.
- **Conteneurs** : API en utilisateur non `root` (`Dockerfile.api`), `cap_drop: ALL`, `no-new-privileges`, limites mémoire et nombre de processus, Redis et la base Umami sur des réseaux `internal` sans sortie internet, tableau de bord Umami lié à `127.0.0.1`.
- **Code** : `SecretStr`, `secrets.compare_digest`, limite sur l'administration contre la force brute, corps bornés, piège à robots sur le formulaire d'avis, aucune trace technique dans les réponses `500`. Le build du front **refuse** les jetons secrets dans `VITE_*` (`vite.config.ts:13-19`).
- **`.env`** : ignoré par git et **absent de tout l'historique** (aucun fichier `.env`, `.pem` ou `.key` jamais commité). Les seuls fichiers d'exemple commités sont `.env.example` et `app/.env.example`.

---

## 5. Secrets à révoquer

| Fichier | Type | Valeur (masquée) | Où il a fuité | Action |
|---|---|---|---|---|
| `.env.example:54` | Mot de passe d'application Gmail (`SMTP_PASSWORD`) | `kk**************` (16 car.) | Commit `51e448d`, poussé sur `origin/dev/all-recup` ; copié sur tout serveur installé avec `cp .env.example .env` | **Révoquer dans le compte Google**, en créer un nouveau dans le `.env` du VPS seulement, vider `.env.example`, puis réécrire l'historique |
| `.env.example:53,55` | Adresse e-mail du compte SMTP et du destinataire | `ak****` | Idem | Pas un secret, mais une cible d'hameçonnage : retirer de `.env.example` |
| *(à vérifier)* | Mot de passe `root` du VPS, `SNOWFLAKE_PASSWORD` du `.env` de prod | — | Non trouvés dans le dépôt | Rotation recommandée **si** le dépôt est public, ou si le `.env` du VPS a pu être copié avec la valeur SMTP. Passer Snowflake en clé RSA (SEC-03). |

Autres valeurs relevées et **jugées non secrètes** :
- jetons de téléchargement Firebase des fichiers publics GMIA dans un script de collecte (historique du patch, lignes de `ingestion/…`) ;
- mot de passe de démonstration du front (SEC-09) ;
- `POSTGRES_PASSWORD=cha…` d'exemple dans `.env.example`, de la forme « change_me ».

---

## 6. Plan de remédiation

| Échéance | Actions |
|---|---|
| **J+1** | SEC-01 : révoquer le mot de passe SMTP, vider `.env.example`, vérifier la visibilité du dépôt. SEC-02 : désactiver le job `dbt` sur `push dev/**` (le garder sur PR vers `main`) en attendant la correction de la macro ; vérifier `QUERY_HISTORY`. SEC-04 : plafonner `/voix/parler` à environ 300 caractères et désactiver `/voix/question` et `/voix/texte`. SEC-07 : protéger `/systeme/cache`. |
| **J+7** | SEC-03 : rôle `R_API_LECTURE`, utilisateur à clé RSA, *network policy*, *resource monitor*, variables d'environnement minimales pour l'API. SEC-05 : compte non `root`, clés SSH seulement, `fail2ban`, `unattended-upgrades`. SEC-02 : macro de schéma corrigée et rôle CI séparé. Protection de `main`. Redéployer le `Caddyfile` actuel. |
| **J+30** | SEC-06 : dépendances figées avec empreintes, images épinglées, Dependabot, `pip-audit` et `npm audit` en CI, images construites en CI. SEC-08 : `SECURITY.md`, tableau des secrets, journal d'administration, supervision externe. SEC-04 complet (phrases identifiées, cache LRU, voix pré-générées). Nettoyage de l'historique git. Point juridique sur la loi n° 25/2026 et les exigences contractuelles des clients publics. |

---

## Résumé

- **2/5, ASVS L1 partiel.** Très bonne base HTTP et conteneurs (TLS 1.3, CSP stricte, CORS fermé, non-`root`, réseaux internes), 0 vulnérabilité connue dans les dépendances livrées.
- 🔴 SEC-01 : un **mot de passe d'application Gmail réel** est dans `.env.example`, commité dans `51e448d` et poussé sur `origin/dev/all-recup`. **À révoquer aujourd'hui.**
- 🔴 SEC-02 : la CI dbt réécrit les marts de prod depuis n'importe quelle branche `dev/*`. 🟠 SEC-03 : `SYSADMIN` par mot de passe pour l'API.
- 🟠 SEC-04 : la voix peut être monopolisée (texte libre, file de 6). 🟠 SEC-05 : VPS en `root` sans durcissement documenté (à vérifier).
- 🟡 Versions non figées et pas de Dependabot ; `/systeme/cache` public ; aucune procédure d'incident. Plan J+1, J+7, J+30 fourni.
