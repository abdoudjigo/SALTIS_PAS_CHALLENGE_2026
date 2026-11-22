# 04 · Backend et API — Assaman & Suuf

> Audit du 21/11/2026, branche `dev/all-recup` (commit `51e448d`). Lecture seule. Prérequis : `01-cartographie.md`, `02-architecture.md`.
> Préfixe des constats : `BE`. Contrôles faits en local (venv, ruff, pytest, couverture), plus quelques requêtes GET en lecture sur la prod (`https://assaman-suuf.tech/api/v1`, déploiement du 19/11) et un POST admin **sans jeton**, pour vérifier qu'il est refusé.
> La sécurité est approfondie au module 07 : ici, les points évidents seulement, avec un renvoi.

---

## 1. Note globale : **4 / 5 (solide)**

C'est la partie la mieux construite du projet. Les réponses sont précalculées et versionnées, avec ETag et `304`, gzip, un format d'erreur maison, la validation Pydantic, la limitation de débit, une taille de corps bornée et le secret admin comparé en temps constant. **121 tests passent** et l'API est couverte à 91 %. Les faiblesses se concentrent sur la voix, coûteuse et ouverte à tout texte, et sur quelques détails de traçabilité et de cohérence.

| Domaine | Note | En bref |
|---|---|---|
| Conception de l'API | 4 | `/api/v1`, routes REST lisibles, OpenAPI généré, réponses `{meta, donnees}`. Les erreurs de validation (`422`) sortent au format FastAPI, pas au format maison (BE-06). |
| Logique métier | 4 | Construction des réponses isolée dans `api/cache/construction.py`, testée à 99 %. Routes minces. La logique de phrases wolof est en double avec le front (ARC-05). |
| Accès aux données | 4 | Une seule requête Snowflake, identifiants filtrés par liste blanche, connexion fermée, délais d'attente. Le secours CSV est étiqueté comme venant de Snowflake (BE-04). |
| Fiabilité | 3 | Repli Redis → mémoire, verrou de préchargement, retour arrière, `/sante`, délais SMTP et Snowflake. La voix, elle, n'a ni borne de concurrence côté Space ni délai raisonnable (BE-01). |
| Performance | 4 | Lecture d'une clé, puis renvoi tel quel : 0,3 à 1 s depuis le poste d'audit, réponses de 0,1 à 25 Ko compressées. Seule la synthèse vocale est lente. |

---

## 2. Mesures relevées

| Mesure | Résultat | Commande |
|---|---|---|
| Lint avec les règles de la CI (`E9,F63,F7,F82,F401`) | 0 erreur | `ruff check . --select E9,F63,F7,F82,F401` |
| Lint avec les règles étendues du poste (style, `S`, `UP`, `FURB`…) | 50 remarques, surtout de style (`C408` ×20) ; 1 `S110` (`except: pass`, `api/cache/service.py:93`) ; 1 `S608` (`api/source_snowflake.py:40`, faux positif : identifiants filtrés) | `ruff check api ml ingestion voix --statistics` |
| Tests | **121 réussis** en 9,6 s (`api/tests` + `ml/tests`) | `pytest api/tests ml/tests -q` |
| Couverture de l'API | **91 %**. Les plus faibles : `cache/prechargement.py` 0 %, `source_snowflake.py` 38 %, `voix/tts_local.py` 41 %, `voix/espace.py` 46 % | `pytest --cov=api` (pytest-cov installé dans `venv/`) |
| Taille des réponses en prod (gzip / brut) | `agrodistrib/territoires` 25 Ko / 634 Ko ; `previsions/fiabilite` 6,6 / 177 Ko ; `opportunites` 5,2 / 60 Ko ; `agroclimat/campagnes/2025` 4,8 / 40 Ko ; `referentiels/departements` 1,6 / 12 Ko | `curl -H 'Accept-Encoding: gzip' -w %{size_download}` |
| Temps de réponse en prod (depuis le poste d'audit) | 0,27 à 1,08 s | idem, `%{time_total}` |
| Cache en prod | 28 486 réponses, 236 Mo bruts → 35 Mo stockés par version, 2 versions conservées, mode Redis | `GET /api/v1/systeme/cache` (public, voir BE-05) |
| Administration en prod | `POST /systeme/cache/rafraichir` sans jeton → **401**. Le jeton admin est donc défini en prod, et la dernière version a été publiée par l'API (`"declencheur":"api"`). | `curl -X POST` |

---

## 3. Inventaire des endpoints (`/api/v1`)

Aucune route n'exige d'authentification, à part l'administration : c'est voulu, les données sont publiques. Toutes les routes passent par la limite globale (1 200 requêtes par minute et par IP).

| Méthode et route | Validation des entrées | Limite propre | Problème |
|---|---|---|---|
| `GET /referentiels/{departements,regions,zones,cultures,periodes,intrants,phases-cadre-harmonise}` | — (sans paramètre) | — | — |
| `GET /agroclimat/campagnes/{campagne}`, `/agroclimat/departements/{code}` | code GADM par regex (`outils.py:17-29`), campagne et culture contrôlées contre l'index | — | — |
| `GET /suivi-decadaire/{code}/{annee}` | idem | — | L'écran est retiré par le cahier des charges V1, la route reste exposée (🔵) |
| `GET /choix-cultures/{code}` | idem | — | — |
| `GET /besoins/departements/{code}`, `/besoins/totaux`, `/prix-intrants` | idem | — | — |
| `GET /agrodistrib/{territoires,agregats}`, `/vulnerabilite`, `/vulnerabilite/{code}` | `niveau` par `Literal`, culture contrôlée | — | 634 Ko bruts sans gzip (les navigateurs envoient toujours gzip) |
| `GET /opportunites`, `/opportunites/{code}` | idem | — | — |
| `GET /cadre-harmonise`, `/cadre-harmonise/{code}` | idem | — | — |
| `GET /previsions/saison/{annee}`, `/saison/departements/{code}` | année bornée, contrôlée contre l'index | — | — |
| `GET /previsions/rendement/{code}/{annee}` | idem | — | — |
| `GET /previsions/alerte-recolte/{annee}` | idem | — | Valeur par défaut `moment=FIN_JUILLET` absente pour 2026-2035 → `404` « aucune donnée » avec une aide hors sujet (BE-07) |
| `GET /previsions/semis/departements/{code}`, `/semis/carte`, `/fiabilite` | idem | — | — |
| `POST /voix/texte` | texte de 2 à 500 car., année bornée | 60 / min / IP | Non utilisée par le front (BE-02) |
| `POST /voix/question` | corps audio de 5 Mo max, lu en flux | 20 / min / IP | Non utilisée par le front. Audio envoyé au Space HF sans borne de concurrence (BE-01, BE-02) |
| `POST /voix/parler` | **texte libre** de 1 à 1 500 car. | 20 / min / IP (voix nouvelles seulement) | **Synthèse CPU de n'importe quel texte**, file de 6, cache disque saturable (BE-01) |
| `POST /avis` | champs coupés à 2 000 car., piège à robots `_honey` | 5 / 10 min / IP | Un retour à la ligne dans « Nom de l'organisation » est refusé par `email` (`ValueError`, pas d'injection d'en-tête) mais renvoie `502 envoi_echoue` au lieu de `422` : l'avis est perdu et l'ONG croit à une panne (🔵) |
| `GET /systeme/sante` | — | — | Public (normal pour un healthcheck) ; renvoie le mode et la version |
| `GET /systeme/cache` | — | — | **Public** : versions, volumes, durées, colonnes, déclencheur (BE-05) |
| `POST /systeme/cache/{rafraichir,retour-arriere}` | `X-Admin-Token`, `compare_digest` | 10 / min / IP | Bonne protection. La doc de déploiement oriente vers une procédure qui ne marche pas (ARC-03) |

---

## 4. Constats

### [BE-01] `POST /voix/parler` synthétise n'importe quel texte : un seul visiteur peut bloquer la voix pour tous
- **Suivi (22/11/2026, après l'audit)** : ✅ Corrigé — texte limité à **700 caractères** (le plus long réellement envoyé par le front : 476, mesuré sur les 6 écrans). **Une seule synthèse à la fois, locale ou Space**, avec 6 demandes en attente au plus (`503 voix_occupee` ensuite). Délai vers le Space ramené de 900 à 120 s, attente du front de 15 à 3 minutes. Cache des voix en **LRU** : les moins récemment utilisées sont supprimées au-delà du plafond, il ne peut plus être bloqué. Tests : `x * 701` → 422, `test_cache_des_voix_supprime_les_plus_anciennes`. **Reste (option)** : n'accepter que des identifiants de phrases servis par l'API (ARC-05), et sortir la voix dans un service séparé (ARC-02).
- Sévérité : 🟠 Élevé   Statut : Constaté (code) / Probable (effet en charge, non testé pour ne pas charger la prod)
- Où : `api/routes/voix.py:112-160` (`TexteWolof.texte` jusqu'à 1 500 car.) ; `:24-29` (sémaphore 1, file de 6) ; `api/voix/espace.py:32,53-60` (délai de 900 s, pas de sémaphore) ; `api/routes/voix.py:152-155` (cache disque plafonné à 400 fichiers)
- Constat : la route accepte un texte quelconque, pas seulement les phrases produites par la plateforme. Une voix nouvelle coûte plusieurs secondes à plusieurs minutes de processeur. Trois effets :
  - **File locale.** Une seule synthèse à la fois, 6 en attente au plus : 7 requêtes de textes différents, depuis une adresse ou plusieurs, suffisent pour répondre `503 voix_occupee` à tout le monde pendant des minutes, avec un cœur sur deux saturé (ARC-02).
  - **Space HF.** Avec `VOIX_SPACE` renseigné, aucune borne de concurrence : chaque appel occupe un thread du pool `asyncio.to_thread` jusqu'à 900 s. Le pool (environ 40 threads) est partagé avec l'envoi des avis SMTP et le préchargement du cache. L'épuiser bloque aussi ces fonctions.
  - **Cache disque.** Les voix produites sont gardées jusqu'à 400 fichiers, puis plus rien n'est gardé. Des textes inventés remplissent le cache, et ensuite **plus aucune vraie phrase n'est mise en cache**, pour toujours.
- Impact : la voix wolof est le canal des personnes peu à l'aise avec l'écrit. Elle peut être rendue indisponible sans effort, et la carte ralentit en même temps. Le site sert aussi de synthèse vocale wolof gratuite à des tiers.
- Recommandation : (1) Ne plus accepter de texte libre : le front envoie un identifiant de phrase et ses paramètres (`{modele: "saison", departement, annee}`), et l'API reconstruit le texte (source unique, ARC-05). À défaut, refuser un texte dont l'empreinte n'a pas été produite par l'API. (2) Plafonner à environ 300 caractères. (3) Mettre le même sémaphore et la même file sur le chemin Space, avec un délai de 60 s. (4) Gérer le cache en LRU (supprimer les plus anciennes) au lieu de cesser d'écrire. (5) Pré-générer les phrases au rafraîchissement (ARC-02).
- Effort : M

### [BE-02] Routes vocales publiques sans client : `/voix/question` (audio) et `/voix/texte`
- **Suivi (22/11/2026, après l'audit)** : ✅ Corrigé — réglage `VOIX_QUESTIONS` (faux par défaut) : `/voix/texte` et `/voix/question` répondent `404 fonction_inactive` tant qu'aucun client ne s'en sert. Test : `test_questions_a_la_voix_coupees_par_defaut`. Documenté dans `api/README.md` et `.env.example`.
- Sévérité : 🟡 Moyen   Statut : Constaté
- Où : `api/routes/voix.py:71-110` ; aucune référence dans `app/src` (module 01)
- Constat : ces deux routes sont en ligne derrière Caddy, que seul `/api/*` filtre. `/voix/question` accepte 5 Mo d'audio et les transmet au Space Hugging Face. Aucun écran ne les appelle.
- Impact : surface d'attaque et de coût sans usage. Si le Space est activé, de l'audio de personnes inconnues part chez un tiers (module 11). Les tester ou les surveiller coûte du temps pour rien.
- Recommandation : les désactiver par un réglage (`VOIX_QUESTIONS=false` par défaut) tant qu'aucun client (front, WhatsApp, serveur vocal) ne les utilise. Les réactiver avec les protections de BE-01.
- Effort : S

### [BE-03] Limitation par adresse IP peu adaptée aux réseaux mobiles et aux salles de démo
- Sévérité : 🟡 Moyen   Statut : Probable
- Où : `api/securite.py:64-71` ; `api/config.py` (`limite_requetes_par_minute=1200`, voix 20 et 60, avis 5 / 10 min)
- Constat : toutes les limites sont comptées **par adresse IP**. Au Sénégal, les opérateurs mobiles partagent souvent une adresse publique entre de nombreux abonnés (NAT d'opérateur), et une salle de formation ou de jury passe par un seul Wi-Fi. Une ouverture de carte agriculteur fait environ 43 requêtes (module 03). Une trentaine d'ouvertures par minute depuis la même adresse atteint donc la limite globale. 20 voix par minute et 5 avis par 10 minutes sont partagés par toute la salle.
- Impact : pendant un atelier avec les ONG ou la présentation aux autorités, des `429` « Trop de requêtes » peuvent apparaître pour des utilisateurs légitimes. Le front ne les affiche pas clairement (FE-03).
- Recommandation : relever la limite globale (les réponses sont précalculées et ne coûtent presque rien), garder des limites strictes seulement sur la voix et l'avis, et prévoir une liste d'adresses exemptées le jour d'une démo (`LIMITE_EXEMPTEES`). Le contexte local reste à vérifier avec un test depuis une connexion Orange ou Free (adresse partagée ou non).
- Effort : S

### [BE-04] Les prévisions de secours (CSV figés dans l'image) sont annoncées comme venant de `SALTIS.ML`
- Sévérité : 🟡 Moyen   Statut : Constaté
- Où : `api/source_snowflake.py:95-99` (repli sur `ml/sorties/*.csv` si `SALTIS.ML` est absent ou vide) ; `api/cache/construction.py:536-548` (`source = f"{prefixe_ml}.{d.table}"` dans tous les cas) ; `deploy/Dockerfile.api` (`COPY ml/sorties`)
- Constat : quand les tables ML de Snowflake ne sont pas lisibles (droits, table vide), l'API sert les CSV copiés dans l'image au moment du build, sans le dire. `meta.source` affiche quand même `SALTIS.ML.PREVISION_SAISONNIERE` ; seul un message dans le journal le signale.
- Impact : traçabilité fausse sur les chiffres les plus sensibles (prévisions présentées aux autorités). En cas de question sur une prévision, l'équipe chercherait dans Snowflake des valeurs qui viennent en réalité d'un fichier vieux de plusieurs jours.
- Recommandation : renseigner la vraie source (`ml/sorties/prevision_saison.csv (secours, date_calcul=…)`), ajouter un avertissement dans `meta.avertissements` et l'exposer dans `/systeme/cache`. En prod, envisager de refuser le secours (`ML_SECOURS_CSV=false`) plutôt que de servir silencieusement d'anciennes valeurs.
- Effort : S

### [BE-05] `GET /systeme/cache` est public et détaille le fonctionnement interne
- **Suivi (22/11/2026, après l'audit)** : ✅ Corrigé — `GET /systeme/cache` exige l'en-tête `X-Admin-Token` (401 sans jeton) ; `/systeme/sante` reste public pour la supervision. Test : `test_etat_du_cache_reserve_a_l_administration`. Documentation mise à jour (`api/README.md`, `docs/technique/guide-api.md`).
- Sévérité : 🟡 Moyen   Statut : Constaté (prod)
- Où : `api/routes/systeme.py:50-54` ; `deploy/Caddyfile` (`handle /api/*`)
- Constat : sans jeton, la route renvoie les versions conservées, le nombre de lignes par mart, les colonnes ignorées, les durées de lecture Snowflake, le déclencheur, la taille et la dernière erreur.
- Preuve : `curl https://assaman-suuf.tech/api/v1/systeme/cache` → `"source":"SALTIS.MARTS"`, `"taille_octets":236066917`, `"versions_conservees":[…]`…
- Impact : des renseignements gratuits pour qui prépare une attaque (moment des rafraîchissements, nom de la base). C'est aussi un endpoint non mis en cache qui touche Redis à chaque appel. Voir module 07.
- Recommandation : protéger `/systeme/cache` par le jeton admin. Garder `/systeme/sante` public mais minimal (`{"statut":"ok"}`).
- Effort : S

### [BE-06] Deux formats d'erreur : `{"erreur": …}` en français et `{"detail": …}` en anglais
- Sévérité : 🔵 Faible   Statut : Constaté (prod)
- Où : `api/erreurs.py` (pas de gestionnaire pour `RequestValidationError`) ; `api/main.py:89-91`
- Preuve : `GET /previsions/semis/carte` → `{"detail":[{"type":"missing","loc":["query","culture"],"msg":"Field required",…}]}`
- Impact : le front doit traiter deux formats. Les messages anglais pourraient remonter à l'écran.
- Recommandation : ajouter un gestionnaire `RequestValidationError` → `422 {"erreur":{"code":"parametre_invalide","message":"…","aide":"<champ>"}}`.
- Effort : S

### [BE-07] Valeur par défaut inutilisable pour les années à venir (`alerte-recolte`)
- Sévérité : 🔵 Faible   Statut : Constaté (prod)
- Où : `api/routes/previsions.py:94-111` (`moment="FIN_JUILLET"` par défaut) ; `ml/sorties/prevision_rendement.csv` (2026-2035 : `FIN_MAI` seulement)
- Preuve : `GET /previsions/alerte-recolte/2026` → `404 aucune_donnee`, avec l'aide « Liste : GET /api/v1/referentiels/departements », hors sujet. `/2025` → `200`.
- Impact : le front passe le bon moment, mais tout autre client (partenaire, futur canal) tombe sur une erreur trompeuse.
- Recommandation : prendre par défaut le dernier moment disponible pour l'année demandée, ou renvoyer `404 moment_indisponible` avec la liste des moments possibles.
- Effort : S

### [BE-08] Les chemins qui échouent en prod sont les moins testés
- Sévérité : 🔵 Faible   Statut : Constaté
- Où : couverture `pytest --cov=api`
- Constat : 91 % au total, mais `cache/prechargement.py` à 0 %, `source_snowflake.py` à 38 % et la voix entre 41 et 46 %. Aucun test de charge, ni de la file vocale, ni du repli CSV.
- Recommandation : tester `lire()` avec un faux connecteur (table facultative absente → secours CSV et étiquette, BE-04), la file vocale (7ᵉ requête → `503`), et la commande `prechargement --verifier`. Détail au module 09.
- Effort : S

> Renvois : ARC-02 (voix dans le worker de l'API), ARC-03 (procédure de rafraîchissement ; **en prod, le jeton admin est bien défini**, puisque `401` sans jeton, ce qui réduit le risque mais pas l'erreur de documentation), module 07 (BE-01, BE-02, BE-05), module 11 (audio envoyé à Hugging Face).

---

## 5. Points solides relevés

- **Précalcul et service.** `api/routes/outils.py:63-115` : ETag faible lié à la version, `304`, `Cache-Control` avec `stale-while-revalidate`, gzip préstocké servi tel quel, en-têtes de diagnostic. Une version incomplète n'est jamais servie (bascule atomique, `service.py:175-227`).
- **Robustesse.** Repli automatique Redis → mémoire (`service.py:86-97`), verrou de préchargement (`409`), retour arrière, `503` explicite tant que le cache n'est pas prêt, healthcheck Docker sur `/sante`.
- **Entrées.** Codes de département par regex, cultures résolues contre l'index (accents et casse tolérés), années bornées, corps JSON limité à 64 Ko et audio lu en flux avec plafond (`securite.py:74-85`).
- **Accès aux données.** Une requête unique, des identifiants en liste blanche, aucune valeur venant de la requête HTTP (`source_snowflake.py:24-40`), délais de connexion et de réseau, fermeture garantie.
- **Secrets et erreurs.** `SecretStr` partout, `compare_digest` pour le jeton admin, rien de technique dans les réponses `500` (`erreurs.py:28-30`), message SMTP sans détail (`avis.py:77-79`).

---

## 6. Les 3 endpoints les plus risqués et une correction

**1. `POST /voix/parler`** (BE-01) : n'accepter que des phrases produites par l'API.
```python
class DemandeVoix(BaseModel):
    modele: Literal["saison", "semis", "culture", "besoins", "alerte"]
    code_departement: CodeDepartement
    annee: int = Field(ge=1981, le=2035)

@voix.post("/parler")
async def parler(request: Request, d: DemandeVoix):
    version, index = await cache.etat_actif()
    texte = phrases_wo(d, index)          # même source que la fiche affichée (ARC-05)
    fichier = CACHE_VOIX / f"{sha256(texte)}.b64"
    if fichier.exists(): return {"audio_wo_base64": fichier.read_text()}
    limiter(request, "voix_synthese")
    async with SYNTHESE:                  # même borne pour le local ET le Space
        audio = await asyncio.wait_for(asyncio.to_thread(moteur.parler, texte), timeout=60)
    cache_lru.ecrire(fichier, audio)      # supprime la plus ancienne au-delà du plafond
```

**2. `POST /voix/question`** (BE-02) : la couper tant qu'aucun client ne s'en sert.
```python
if not request.app.state.parametres.voix_questions:
    raise ErreurApi(404, "fonction_inactive", "Question parlée non disponible.")
```

**3. `GET /systeme/cache`** (BE-05) : la réserver à l'administration.
```python
@systeme.get("/cache", dependencies=[Security(exiger_admin)])
```

---

## Résumé

- **4/5.** API solide : réponses précalculées (ETag, gzip, 0,3 à 1 s en prod), entrées validées, erreurs propres, 121 tests réussis, 91 % de couverture.
- 🟠 BE-01 : `/voix/parler` synthétise n'importe quel texte de 1 500 caractères. Quelques requêtes bloquent la voix pour tous, et le cache vocal peut être saturé pour toujours.
- 🟡 Routes vocales audio et texte publiques sans client (BE-02). Limites par IP risquées derrière le NAT des opérateurs ou le Wi-Fi d'une salle de démo (BE-03). Le secours CSV se présente comme `SALTIS.ML` (BE-04). `/systeme/cache` est public (BE-05).
- 🔵 Format `422` non uniforme, valeur par défaut trompeuse pour `alerte-recolte`, chemins Snowflake et voix peu testés.
- En prod, le jeton admin est défini (`401` sans jeton) : le rafraîchissement par l'API est possible, mais `deploy/README.md` reste à corriger (ARC-03).
