# Déployer Assaman & Suuf sur le VPS (Hostinger KVM 2)

Tout tourne dans Docker, lancé par une seule commande. Trois conteneurs :

| Conteneur | Rôle | Ouvert sur internet |
|---|---|---|
| `web` | Le site (construit avec Vite) servi par **Caddy**, qui obtient le certificat **HTTPS** tout seul et transmet `/api` à l'API | oui : ports 80 et 443 |
| `api` | L'API : marts lus dans Snowflake, prévisions des modèles (`ml/sorties`), voix wolof (SpeechT5 sur processeur) | non |
| `redis` | Le cache des réponses de l'API | non |

Le KVM 2 (2 processeurs, 8 Go de mémoire) suffit : l'API et la voix wolof prennent environ 2 à 3 Go.

## 1. Préparer le VPS (une fois)
1. Dans le panneau Hostinger, choisir le modèle **Ubuntu 24.04 avec Docker** (ou installer Docker : https://docs.docker.com/engine/install/ubuntu/).
2. **Nom de domaine** (recommandé, pour le HTTPS, le micro et la géolocalisation sur téléphone) : créer un enregistrement DNS **A** qui pointe vers l'IP du VPS.
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
| `DOMAINE` | le nom de domaine (ex. `assaman-suuf.com`) ; sans domaine : `:80` |
| `VITE_EMAIL_CONTACT` | facultatif : l'adresse affichée sur la page Contact |
| `VOIX_SPACE`, `HF_TOKEN` | laisser vides : la voix wolof est produite par l'API |

Le `.env` ne quitte jamais le serveur (il est ignoré par git et par Docker).

## 3. Lancer
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Première construction : 5 à 10 minutes (PyTorch processeur, dépendances du site). Ensuite :
- le site : `https://<domaine>` (ou `http://<IP>` sans domaine) ;
- l'état de l'API : `https://<domaine>/api/v1/systeme/sante` (répond `ok` quand le cache est chargé, ~30 s après le démarrage) ;
- les journaux de l'API : `docker compose -f docker-compose.prod.yml logs -f api`.

**Voix wolof** : au premier appui sur la mascotte **WLF**, l'API télécharge le modèle (~600 Mo, environ une minute), puis chaque texte est dit en quelques secondes. Les voix produites sont gardées (volume `voix-cache`) : la rejouer est instantané.

## 4. Mettre à jour
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
Après une mise à jour des marts dans Snowflake (`dbt build`), redémarrer seulement l'API pour relire les données : `docker compose -f docker-compose.prod.yml restart api`.

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
| En-têtes (Caddy) | HSTS, CSP (site + Mapbox seulement), `X-Frame-Options: DENY`, `Permissions-Policy` (micro et géolocalisation pour le site seulement). **Un nouveau service externe dans le front (police, carte, vidéo) doit être ajouté à la CSP de `deploy/Caddyfile`** |
| API | CORS fermé (`CORS_ORIGINES=[]` : même origine), documentation `/docs` coupée (`API_DOCS=false`), débit par adresse IP (1 200 requêtes/min, 60 questions écrites/min, 20 reconnaissances ou synthèses vocales/min, 10 essais de jeton d'administration/min), corps JSON ≤ 64 Ko, audio ≤ 5 Mo, une seule synthèse vocale à la fois, 400 voix gardées au plus |
| Secrets | Tous dans `.env` (jamais dans git ni dans les images). Jeton Mapbox : public par nature, à **restreindre au domaine** dans le compte Mapbox |

Les limites se règlent dans `.env` (`LIMITE_REQUETES_PAR_MINUTE`, `LIMITE_VOIX_TEXTE_PAR_MINUTE`, `LIMITE_VOIX_SYNTHESE_PAR_MINUTE` ; 0 = sans limite) : à relever si tout un jury partage la même adresse IP et atteint un plafond (réponse 429).

## Fichiers
| Fichier | Rôle |
|---|---|
| `docker-compose.prod.yml` | Les trois conteneurs, leurs volumes, les seuls ports ouverts (80, 443) |
| `deploy/Dockerfile.api` | Image de l'API (Python 3.12, `requirements-api.txt` + `requirements-voix.txt`) |
| `deploy/Dockerfile.web` | Construction du site, puis Caddy |
| `deploy/Caddyfile` | HTTPS automatique, `/api` vers l'API, cache des fichiers du site, en-têtes de sécurité |
| `.dockerignore` | Ce qui n'entre jamais dans les images (`.env`, données brutes, environnements locaux) |
