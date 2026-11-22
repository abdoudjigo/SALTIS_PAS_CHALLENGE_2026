# Déployer Assaman & Suuf sur le VPS (Hostinger KVM 2)

Tout tourne dans Docker, lancé par une seule commande. Trois conteneurs :

| Conteneur | Rôle | Ouvert sur internet |
|---|---|---|
| `web` | Le site (construit avec Vite) servi par **Caddy**, qui obtient le certificat **HTTPS** tout seul et transmet `/api` à l'API | oui : ports 80 et 443 |
| `api` | L'API : marts lus dans Snowflake, prévisions des modèles (`ml/sorties`) | non |
| `voix` | La voix wolof (SpeechT5 sur processeur), appelée par l'API seulement ; **un cœur et 3 Go au plus**, pour qu'une synthèse ne ralentisse jamais la carte | non |
| `redis` | Le cache des réponses de l'API | non |

Le KVM 2 (2 processeurs, 8 Go de mémoire) suffit : l'API prend 2 Go au plus, la voix wolof 3 Go au plus et un seul des deux processeurs.

## 1. Préparer le VPS (une fois)
1. Dans le panneau Hostinger, choisir le modèle **Ubuntu 24.04 avec Docker** (ou installer Docker : https://docs.docker.com/engine/install/ubuntu/).
2. **Nom de domaine** (obligatoire : le site est servi en HTTPS seulement ; le micro et la géolocalisation en dépendent) : créer un enregistrement DNS **A** qui pointe vers l'IP du VPS.
3. Se connecter : `ssh root@<IP du VPS>`, puis ouvrir les ports web : `ufw allow 22,80,443/tcp && ufw enable`.

## 2. Récupérer le projet
```bash
git clone https://github.com/abdoudjigo/SALTIS_PAS_CHALLENGE_2026.git assaman-suuf
cd assaman-suuf
cp .env.example .env
nano .env
```

Dans `.env`, renseigner au minimum :

| Variable | Valeur |
|---|---|
| `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, `SNOWFLAKE_ROLE`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE` | l'accès Snowflake (lecture des marts) |
| `VITE_MAPBOX_TOKEN` | le jeton public Mapbox (`pk.…`) ; dans le compte Mapbox, autoriser le domaine du site |
| `DOMAINE` | **obligatoire** : le nom de domaine (ex. `assaman-suuf.com`), sans `https://` ni `www.` ; sans lui, `docker compose` refuse de démarrer |
| `API_ADMIN_TOKEN` | **obligatoire** : jeton des routes d'administration (relire les données, revenir à la version précédente, état du cache) : `openssl rand -hex 24` ; sans lui, `docker compose` refuse de démarrer |
| `UMAMI_DB_PASSWORD`, `UMAMI_APP_SECRET` | **obligatoires** : deux secrets pour la mesure d'audience (`openssl rand -hex 24` chacun) ; voir section 7 |
| `UMAMI_WEBSITE_ID` | identifiant du site dans Umami, à renseigner après sa création (section 7) ; vide = aucune mesure |
| `EMAIL_CONTACT` | facultatif : l'adresse affichée sur la page Contact, au clic seulement (anti-spam) ; l'ancien nom `VITE_EMAIL_CONTACT` reste accepté |
| `VOIX_SPACE`, `HF_TOKEN` | laisser vides : la voix wolof est produite par le conteneur `voix` (`VOIX_SERVICE_URL` est déjà réglé dans `docker-compose.prod.yml`) |
| `LLM_API_KEY` | facultatif : clé Groq (gratuite, créée sur https://console.groq.com/keys) pour les explications IA des PDF de l'ONG ; vide = repères de lecture sans IA |
| `LLM_BASE_URL`, `LLM_MODEL` | facultatifs : par défaut Groq (`https://api.groq.com/openai/v1`) et `openai/gpt-oss-120b` ; peuvent pointer vers un autre fournisseur compatible OpenAI |

Le `.env` ne quitte jamais le serveur (il est ignoré par git et par Docker).
Les résumés des sections du dossier (sans le nom de l'organisation) sont transmis au fournisseur LLM configuré. Vérifier ses conditions de traitement des données avant d'activer cette option. Groq (par défaut) : pas de conservation des requêtes par défaut, sauf journaux de 30 jours au plus pour la fiabilité et les abus (désactivables) ; serveurs aux États-Unis. Offre gratuite limitée en requêtes par minute et par jour : au-delà, le PDF sort avec les repères de lecture sans IA.

## 3. Lancer
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Première construction : 5 à 10 minutes (PyTorch processeur, dépendances du site). Ensuite :
- le site : `https://<domaine>` ; `http://<domaine>` et `http://<IP>` y sont redirigés (301 ou 308) ;
- l'état de l'API : `https://<domaine>/api/v1/systeme/sante` (répond `ok` quand le cache est chargé, ~30 s après le démarrage) ;
- les journaux de l'API : `docker compose -f docker-compose.prod.yml logs -f api`.

**Voix wolof** : au premier démarrage, le conteneur `voix` télécharge le modèle (~600 Mo, environ une minute, gardé dans le volume `api-donnees`) et le charge en mémoire ; ensuite chaque texte est dit en quelques secondes. Suivre le chargement : `docker compose -f docker-compose.prod.yml logs -f voix`. Si la voix n'est pas prête ou met plus de 90 s, l'API répond « voix indisponible » et le texte wolof reste affiché. Les voix produites sont gardées (volume `voix-cache`) : la rejouer est instantané.

## 4. Mettre à jour
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
Après une mise à jour des marts ou des résultats des modèles dans Snowflake (`dbt build`, `ml/charger_snowflake.py`), **relire les données** sans redémarrer :
```bash
curl -X POST -H "X-Admin-Token: <API_ADMIN_TOKEN du .env>" https://<domaine>/api/v1/systeme/cache/rafraichir
curl https://<domaine>/api/v1/systeme/sante      # version_active change une fois le préchargement terminé
```
`API_ADMIN_TOKEN` doit donc être renseigné dans le `.env` du serveur (`openssl rand -hex 24`). **Redémarrer l'API ne suffit pas** : avec Redis, elle reprend la version déjà en cache sans relire Snowflake. Autre possibilité, depuis le serveur : `docker compose -f docker-compose.prod.yml exec api python -m api.cache.prechargement`.

## 5. Commandes utiles
| Besoin | Commande |
|---|---|
| Voir l'état | `docker compose -f docker-compose.prod.yml ps` |
| Journaux | `docker compose -f docker-compose.prod.yml logs -f api` (ou `web`) |
| Arrêter | `docker compose -f docker-compose.prod.yml down` |
| Place disque | `docker system df` ; nettoyer les anciennes images : `docker image prune` |

## 6. Sécurité (revue du 16/11/2026)
| Sujet | Ce qui est en place |
|---|---|
| Réseau | Seuls 80 et 443 sont ouverts. Redis est sur un réseau Docker privé (`prive`, sans sortie internet) que seule l'API rejoint. `REDIS_PASSWORD` dans `.env` (facultatif, lettres et chiffres : `openssl rand -hex 24`) ajoute un mot de passe |
| Conteneurs | API sans droits root et sans capacité Linux ; Caddy avec la seule capacité d'écouter sur 80/443 ; `no-new-privileges`, limites de mémoire et de processus, journaux bornés (3 × 10 Mo), contrôles de santé |
| HTTPS forcé | `DOMAINE` obligatoire (pas de repli en HTTP) ; `DOMAINE=:80` est refusé par Caddy ; tout le port 80 est redirigé vers `https://<domaine>` ; HSTS un an avec `includeSubDomains` ; `upgrade-insecure-requests` dans la CSP. Vérifier : `curl -I http://<domaine>` doit répondre `308` (ou `301` par l'adresse IP) avec `Location: https://…` |
| En-têtes (Caddy) | HSTS, CSP (site + Mapbox seulement), `X-Frame-Options: DENY`, `Permissions-Policy` (micro et géolocalisation pour le site seulement). **Un nouveau service externe dans le front (police, carte, vidéo) doit être ajouté à la CSP de `deploy/Caddyfile`** |
| API | CORS fermé (`CORS_ORIGINES=[]` : même origine), documentation `/docs` coupée (`API_DOCS=false`), débit par adresse IP (1 200 requêtes/min, 60 questions écrites/min, 20 reconnaissances ou synthèses vocales/min, 10 essais de jeton d'administration/min), corps JSON ≤ 64 Ko, audio ≤ 5 Mo, une seule synthèse vocale à la fois, 400 voix gardées au plus |
| Secrets | Tous dans `.env` (jamais dans git ni dans les images). Le build du front échoue si une variable `VITE_*` ressemble à un secret (`app/vite.config.ts`). Jeton Mapbox : public par nature, à **restreindre au domaine** dans le compte Mapbox |

Les limites se règlent dans `.env` (`LIMITE_REQUETES_PAR_MINUTE`, `LIMITE_VOIX_TEXTE_PAR_MINUTE`, `LIMITE_VOIX_SYNTHESE_PAR_MINUTE` ; 0 = sans limite) : à relever si tout un jury partage la même adresse IP et atteint un plafond (réponse 429).

## 7. Mesure d'audience (Umami)
Umami compte les visites sans cookie, sur le VPS (conteneurs `umami` et `umami-db`, données dans le volume `umami-db`).
Le site n'en expose que le script et la route d'envoi (`/stats/script.js`, `/stats/api/send`) ; le tableau de bord
n'écoute que sur le VPS (`127.0.0.1:3001`), jamais sur Internet. Le script n'est chargé qu'après « Accepter » dans le bandeau cookies.

Première mise en route :
1. Dans `.env` : `UMAMI_DB_PASSWORD` et `UMAMI_APP_SECRET` (`openssl rand -hex 24` chacun), puis `docker compose -f docker-compose.prod.yml up -d --build`.
2. Depuis son ordinateur, ouvrir un tunnel vers le tableau de bord, puis aller sur http://localhost:3001 :
   ```bash
   ssh -N -L 3001:127.0.0.1:3001 root@<IP du VPS>
   ```
3. Se connecter avec `admin` / `umami`, et **changer ce mot de passe tout de suite** (Paramètres → Profil).
4. Paramètres → Sites web → Ajouter : nom « Assaman & Suuf », domaine `<domaine>`. Copier l'identifiant du site (UUID).
5. Dans `.env` : `UMAMI_WEBSITE_ID=<identifiant>`, puis reconstruire le site : `docker compose -f docker-compose.prod.yml up -d --build web`.
6. Vérifier : ouvrir le site, accepter le bandeau, changer de page ; les visites apparaissent dans le tableau de bord (Temps réel). Les événements (écrans ouverts, voix, exports…) sont dans « Événements » ; leur liste : [`docs/technique/plan-de-marquage.md`](../docs/technique/plan-de-marquage.md).
7. Sur chaque appareil de l'équipe, ouvrir une fois le site avec `?equipe=1` : ses visites ne sont plus comptées (`?equipe=0` pour annuler).

Sans `UMAMI_WEBSITE_ID`, le site ne charge rien et n'affiche pas de bandeau cookies (rien à accepter).
Sauvegarde des statistiques : `docker compose -f docker-compose.prod.yml exec umami-db pg_dump -U umami umami > umami.sql`.

## Fichiers
| Fichier | Rôle |
|---|---|
| `docker-compose.prod.yml` | Les conteneurs (site, API, Redis, Umami et sa base), leurs volumes, les seuls ports ouverts (80, 443 ; 3001 sur le VPS seulement) |
| `deploy/Dockerfile.api` | Image de l'API (Python 3.12, `requirements-api.txt`, sans torch) |
| `deploy/Dockerfile.voix` | Image du service voix (`api/voix/service.py`, `requirements-voix.txt` : torch processeur, transformers) |
| `deploy/Dockerfile.web` | Construction du site, puis Caddy |
| `deploy/Caddyfile` | HTTPS automatique, `/api` vers l'API, `/stats/script.js` et `/stats/api/send` vers Umami, cache des fichiers du site, en-têtes de sécurité |
| `.dockerignore` | Ce qui n'entre jamais dans les images (`.env`, données brutes, environnements locaux) |
