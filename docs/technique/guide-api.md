# Guide de l'API — lancer, arrêter, utiliser

Guide pratique de l'API `api/`. Pour le détail technique du code : [`api/README.md`](../../api/README.md).

---

## 1. Ce qui a été fait, en bref

L'API sert au front et à la BI les **marts** construits par dbt dans Snowflake (`SALTIS.MARTS`).

```
Snowflake SALTIS.MARTS ──(au démarrage, environ 20 s)──► cache en mémoire ──► API ──► front
                                                         (moins d'1 ms par requête)
```

- **Au démarrage**, l'API lit les 6 marts, vérifie chaque ligne, puis prépare à l'avance **toutes les réponses possibles** (5 182) et les garde en mémoire. C'est automatique : il n'y a rien à lancer à part l'API.
- **À chaque requête**, l'API renvoie la réponse déjà prête, en moins d'1 ms. Snowflake n'est jamais appelé pendant une requête.
- **Après un `dbt build`**, il suffit de **redémarrer l'API** pour qu'elle relise les marts.
- **Sécurité** : si un mart a changé de forme (colonne manquante, valeur inattendue), l'API le signale dans la console au lieu de servir des données fausses.
- **Pas de Docker** : Redis est optionnel (section 9). Sans lui, tout fonctionne.

Le mart ML (`MART_ML_PREVISION_PLUIE`) n'est pas exposé : il le sera quand les modèles seront prêts.

---

## 2. À faire une seule fois

```bash
cd ~/"Documents/Orange Digital center/SALTIS/saltis-pas-challenge"
source venv/bin/activate
pip install -r requirements.txt
```

Les identifiants Snowflake sont ceux du fichier `.env`, les mêmes que pour dbt. Il n'y a rien à ajouter.

---

## 3. Lancer le serveur

Depuis la racine du dépôt, avec l'environnement activé (`source venv/bin/activate`) :

```bash
python -m api
```

Ce qui s'affiche :

```
  API SALTIS — documentation : http://localhost:8080/docs
  Cache : mémoire (rechargé depuis Snowflake à chaque démarrage)
  Arrêt : Ctrl + C

INFO:     Waiting for application startup.
INFO api.cache.service : Chargement des marts depuis Snowflake (environ 15 s)…
INFO api.source_snowflake : Snowflake SALTIS.MARTS.MART_CARTE_AGROCLIMAT : 2025 lignes
...
INFO api.cache.service : Version v20261111T093354456Z publiée (memoire) : 5182 réponses…
INFO:     Application startup complete.          ← c'est prêt
INFO:     Uvicorn running on http://127.0.0.1:8080
```

Attendre **`Application startup complete`**, puis ouvrir **http://localhost:8080/docs** dans le navigateur.

| Adresse | Contenu |
|---|---|
| http://localhost:8080/docs | **Swagger** : on teste chaque route avec « Try it out » puis « Execute » |
| http://localhost:8080/redoc | La même documentation, en lecture |
| http://localhost:8080/api/v1/systeme/sante | Santé de l'API |

Options :

```bash
python -m api --port 8081      # sur un autre port
python -m api --reload         # redémarre seul quand on modifie le code (et relit Snowflake à chaque fois)
python -m api --host 0.0.0.0   # accessible depuis les autres machines du réseau (ex. le poste du front)
python -m api --help           # toutes les options
```

> Le port par défaut est **8080**. Le port 8000 est souvent pris par d'autres outils, comme Airbyte. Si le port est occupé, l'API le dit et propose une solution :
>
> ```
>   Le port 8080 est déjà utilisé par un autre programme.
>   Voir lequel     : ss -ltnp | grep :8080
>   Autre port      : python -m api --port 8081
> ```

---

## 4. Arrêter le serveur

**Dans le terminal où il tourne** : taper **`Ctrl + C`**.

```
INFO:     Shutting down
INFO:     Application shutdown complete.
```

**Si le terminal a été fermé**, ou si on ne sait plus où il tourne :

```bash
ss -ltnp | grep :8080
# LISTEN 0 2048 127.0.0.1:8080 0.0.0.0:* users:(("python",pid=30767,fd=6))

kill 30767                       # le numéro après pid=
ss -ltnp | grep :8080 || echo "serveur arrêté"
```

---

## 5. Après un `dbt build`

Les données sont lues au démarrage. Pour voir les nouveaux marts : **`Ctrl + C`, puis `python -m api`**.

Pour vérifier les marts sans lancer l'API (utile après une modification dbt) :

```bash
python -m api.cache.prechargement --verifier
# Contrat respecté : carte=2025, suivi=71280, cultures=1710, besoins=369, agrodistrib=345, vulnerabilite=45
```

---

## 6. Les routes

Toutes les routes commencent par **`/api/v1`** et ne font que **lire** des données (`GET`).

Codes de département utiles (codes GADM) :

| Département | Code | | Département | Code |
|---|---|---|---|---|
| Dakar | `SEN.1.1_1` | | Kolda | `SEN.7.1_1` |
| Guédiawaye | `SEN.1.2_1` | | Saint-Louis | `SEN.10.3_1` |
| Kaffrine | `SEN.4.2_1` | | *tous les autres* | `GET /referentiels/departements` |

Le paramètre `culture` est **optionnel** et ne tient compte ni des accents ni des majuscules : `mais`, `Maïs` et `MAÏS` donnent le même résultat. Le nom doit être complet : `mil (souna)`, pas `mil`. Voir `/referentiels/cultures`.

### Référentiels — les listes de base

| Route | Ce qu'elle renvoie |
|---|---|
| `GET /referentiels/departements` | Les 45 départements : code, nom, région, zone, latitude et longitude, et s'ils ont un suivi décadaire et un score de vulnérabilité |
| `GET /referentiels/regions` | Les 14 régions et leurs départements |
| `GET /referentiels/zones` | Les 6 zones agroécologiques et leurs départements |
| `GET /referentiels/cultures` | Les 12 cultures, avec leur nom exact |
| `GET /referentiels/periodes` | Les campagnes (1981-2025) et années disponibles |
| `GET /referentiels/intrants` | Les produits et la colonne de besoin à lire (`colonne_besoin`) ; fumier hors totaux |
| `GET /referentiels/phases-cadre-harmonise` | Les 5 phases du Cadre harmonisé et leurs couleurs officielles |

### A · Agroclimat — « Quelle pluie, quelle saison ? »

| Route | Ce qu'elle renvoie | Usage front |
|---|---|---|
| `GET /agroclimat/campagnes/{campagne}` | Bilan de la saison pour les **45 départements** une année donnée : pluie, écart à la normale, démarrage, séquences sèches, alertes, `risque_saison`, vulnérabilité, **latitude et longitude** du département | Colorier la **carte** |
| `GET /agroclimat/departements/{code}` | Les **45 saisons** (1981-2025) d'un département | Graphique d'historique |
| `GET /suivi-decadaire/{code}/{annee}` | Les **36 décades** d'une année : pluie observée, normale, écart, cumul depuis juin, fourchette habituelle. Option `?saison_seulement=true` : seulement juin-octobre | Courbe de suivi de campagne |

```bash
curl "http://localhost:8080/api/v1/agroclimat/campagnes/2024"
curl "http://localhost:8080/api/v1/suivi-decadaire/SEN.7.1_1/2025?saison_seulement=true"
```

### B · Choix des cultures — « Que semer, avec quel cycle ? »

| Route | Ce qu'elle renvoie |
|---|---|
| `GET /choix-cultures/{code}?culture=` | Pour chaque culture du département : les cycles (courte, moyenne, longue) et les variétés, **classés** par `rang_option` (1 = la meilleure), avec la probabilité que la saison couvre le cycle et le niveau d'adéquation (`adaptée`, `à risque`, `déconseillée`…) |

```bash
curl "http://localhost:8080/api/v1/choix-cultures/SEN.7.1_1?culture=mais"
curl -G "http://localhost:8080/api/v1/choix-cultures/SEN.7.1_1" --data-urlencode "culture=mil (souna)"
```

> La part « eau » est calculée pour chaque cycle (méthode FAO de l'équipe). Les valeurs d'origine de la source restent visibles dans les colonnes `*_source`, et `methode_niveau` indique d'où vient le verdict. Détail dans [`api/README.md`](../../api/README.md).

### C · Besoins en intrants — « Combien d'engrais et de semences ? »

| Route | Ce qu'elle renvoie |
|---|---|
| `GET /besoins/departements/{code}?culture=` | Besoins **de référence** d'un département, par culture : superficie, azote, urée, NPK 15-15-15, 15-10-10 et 6-20-10, DAP, semences (en tonnes), irrigation, source et statut de la dose retenue |
| `GET /besoins/totaux?niveau=&culture=` | Les mêmes besoins **additionnés** : `niveau=NATIONAL` (par défaut), `REGION` ou `ZONE` |
| `GET /prix-intrants?campagne=` | Prix des intrants par sac de 50 kg (cession, subvention, coût réel), statut et source ; `null` = à saisir |

```bash
curl "http://localhost:8080/api/v1/besoins/departements/SEN.7.1_1"
curl "http://localhost:8080/api/v1/besoins/totaux?niveau=REGION&culture=mais"
```

> Ce sont des besoins **historiques** (superficie × dose), pas des prévisions. `null` veut dire « dose à saisir », jamais 0 ; 0 veut dire « pas dans la formule ». Le fumier n'est pas chiffré (`null`) et reste hors totaux. Dans les totaux, `valeurs_manquantes` donne le nombre de lignes non additionnées : si ce nombre est supérieur à 0, le total est partiel.

### D · AgroDistrib — « Comment répartir les intrants ? »

| Route | Ce qu'elle renvoie |
|---|---|
| `GET /agrodistrib/territoires?culture=` | Pour chaque département × culture cultivée : besoin, potentiel de gain, adéquation, sol, vulnérabilité. Ce sont les critères de répartition |
| `GET /agrodistrib/agregats?niveau=&culture=` | Les besoins additionnés au niveau de répartition choisi : `REGION` (par défaut), `ZONE` ou `NATIONAL` |
| `GET /vulnerabilite` | Les 45 départements classés du **plus vulnérable** au moins vulnérable |
| `GET /vulnerabilite/{code}` | Le détail du score d'un département (sous-scores, indicateurs) |

```bash
curl "http://localhost:8080/api/v1/agrodistrib/agregats?niveau=ZONE&culture=mais"
curl "http://localhost:8080/api/v1/vulnerabilite"
```

> La vulnérabilité est un score **relatif** (il compare les départements entre eux) et **indicatif**. Il est `null` pour Dakar, Guédiawaye et Pikine.

### F · Cadre harmonisé — « Où l'insécurité alimentaire est-elle forte ? »

| Route | Ce qu'elle renvoie |
|---|---|
| `GET /cadre-harmonise` | Les 45 départements, dernier cycle : phases courante, projetée et retenue, personnes en phases 3 à 5, période (CILSS, licence CC BY) |
| `GET /cadre-harmonise/{code}` | Le détail d'un département ; `periode_terminee` recalculée à chaque requête |

### Système

| Route | Ce qu'elle renvoie |
|---|---|
| `GET /systeme/sante` | `200` si l'API sert des données, `503` sinon |
| `GET /systeme/cache` | État du cache : version, nombre de réponses, taille, durées de chargement (**en-tête `X-Admin-Token` requis**) |

Les routes `POST /systeme/cache/rafraichir` et `POST /systeme/cache/retour-arriere` servent seulement avec Redis (section 9). Sans Redis, on redémarre l'API.

---

## 7. Lire une réponse

Toutes les réponses de données ont la même forme :

```json
{
  "meta": {
    "version": "v20261111T093354456Z",
    "source": "SALTIS.MARTS.MART_VULNERABILITE_DEPARTEMENT",
    "nb_elements": 1,
    "filtres": {"code_departement": "SEN.7.1_1"},
    "avertissements": ["Score relatif et indicatif (méthode v1), à valider avec les techniciens."]
  },
  "donnees": { "departement": "Kolda", "score_vulnerabilite": 23.7, "classe_vulnerabilite": "très faible (relatif)", "...": "..." }
}
```

- `donnees` : les lignes du mart (une liste, ou un seul objet pour le détail d'un département).
- `meta.avertissements` : les limites à respecter ou à afficher à l'utilisateur.

En cas d'erreur, la réponse dit quoi faire :

```json
{"erreur": {"code": "departement_inconnu", "message": "Département SEN.99.1_1 inconnu.", "aide": "Liste : GET /api/v1/referentiels/departements"}}
```

| Code HTTP | Signification |
|---|---|
| `200` | OK |
| `304` | Rien n'a changé depuis la dernière fois : le navigateur réutilise sa copie |
| `404` | Département, culture ou année inconnu (le message précise lequel) |
| `422` | Paramètre mal écrit (ex. code département au mauvais format) |
| `503` | Les marts n'ont pas pu être chargés au démarrage : lire l'erreur dans la console |

---

## 8. Problèmes fréquents

| Symptôme | Cause | Solution |
|---|---|---|
| `Le port 8080 est déjà utilisé` | Un autre programme, ou une API déjà lancée | `ss -ltnp \| grep :8080`, puis `kill <pid>` ; ou `python -m api --port 8081` |
| `/docs` ouvre une autre application | Mauvais port dans le navigateur (8000 au lieu de 8080) | Ouvrir http://localhost:8080/docs |
| `ModuleNotFoundError` | Environnement non activé, ou commande lancée hors de la racine | `source venv/bin/activate`, puis se placer à la racine du dépôt |
| `503` sur toutes les routes | Le chargement Snowflake a échoué (identifiants, réseau, contrat) | Lire l'erreur dans la console, corriger, relancer |
| « erreur(s) de contrat » dans la console | Un mart a changé dans dbt | Le message indique le mart et la colonne : adapter `api/schemas/` ou le mart |
| Les données ne changent pas après un `dbt build` | Les marts sont lus au démarrage | `Ctrl + C`, puis `python -m api` |

---

## 9. Pour plus tard : Redis (optionnel)

Sans Redis, chaque démarrage relit Snowflake (environ 20 s). Avec Redis, le cache est partagé entre plusieurs serveurs, survit aux redémarrages (démarrage instantané) et se rafraîchit sans couper le service. C'est utile en production, inutile pour développer.

```bash
docker compose up -d redis                      # démarrer Redis (service décrit dans docker-compose.yml)
echo "REDIS_URL=redis://localhost:6379/0" >> .env
python -m api.cache.prechargement               # remplir le cache après un dbt build
python -m api                                   # l'API lit Redis ("Cache : Redis" au démarrage)
docker compose stop redis                       # arrêter Redis
```

Pour revenir au mode simple : supprimer la ligne `REDIS_URL` du `.env`.

---

## 10. Antisèche

```bash
source venv/bin/activate                         # 1. activer l'environnement (une fois par terminal)
python -m api                                    # 2. lancer → attendre « Application startup complete »
                                                 # 3. ouvrir http://localhost:8080/docs
# Ctrl + C                                       # 4. arrêter
python -m api.cache.prechargement --verifier     # vérifier les marts sans lancer l'API
python -m pytest api/tests -q                    # lancer les tests (29)
```
