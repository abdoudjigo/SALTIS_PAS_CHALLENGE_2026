# IA vocale — Assaman & Suuf

## 1. Les deux mascottes : FR et WLF
Chaque fenêtre de résultats a deux mascottes, en haut (en haut à droite du tiroir sur téléphone) :

| Mascotte | Badge | Langue | Voix |
|---|---|---|---|
| Le garçon | **FR** | Français, toutes les fonctionnalités | Synthèse vocale du navigateur, instantanée |
| La fille | **WLF** | Wolof, les 5 fonctionnalités de l'agriculteur | Texte wolof préparé à l'avance (`app/src/scene/voix/wolof.ts` et `aEcouterWo` de chaque fonctionnalité), dit par l'API (`POST /api/v1/voix/parler`) |

On appuie sur une mascotte : elle lit l'essentiel de ce qu'affiche la fenêtre. On rappuie : elle s'arrête. La voix wolof est gardée en mémoire : la rejouer est instantané. Sans Space configuré, la fille affiche « voix wolof non configurée ».

**Comment le wolof est préparé** : chaque action (se localiser, choisir une année, une culture…) recalcule les phrases françaises et, en même temps, les phrases wolof, avec les mêmes chiffres (nombres en lettres : « juróom-benni téeméer ak fukk ak benn »). Rien n'est traduit à la volée par une IA : les phrases types wolof sont fixes, seuls les chiffres changent. **À faire relire par un locuteur wolof de l'équipe.**

Ce que dit la mascotte FR :

| Fonctionnalité | Ce que la voix dit |
|---|---|
| Ma parcelle | Le département, la région et la zone ; le sol ; les cultures les mieux placées ; la saison attendue ; le meilleur moment pour semer ; la récolte habituelle ; le risque de sécheresse et la vulnérabilité |
| La saison qui vient | Sèche, normale ou humide, avec les trois chances ; la pluie attendue et sa fourchette, comparée à la normale ; d'où vient la prévision |
| Quand semer | La période conseillée, le meilleur moment et son risque, pourquoi ni trop tôt ni trop tard |
| Quelle culture | Combien de cultures adaptées, les trois meilleures, la récolte attendue |
| Mes besoins | Pour sa surface : semences, NPK, urée, DAP, fumier (ou « dose à saisir »), puis la saison, le semis et la production attendue |
| Préparer la campagne | La saison dans le pays, les départements à surveiller et pourquoi |
| Alerte récolte | Les départements en alerte et leur risque, ce que vaut l'alerte |
| Vulnérabilité, Besoins du pays, Répartir un stock | Le classement, les totaux, la répartition proposée |

Comment c'est fait (`app/src/scene/voix/lecture.ts`) :
- **Rien d'inventé** : chaque fonctionnalité compose ses phrases avec les chiffres qu'elle affiche (`aEcouter` dans sa sortie). Une valeur absente se dit « non disponible ».
- **Écrit pour l'oreille** : pas d'abréviation (« 589 millimètres », « 41 pour cent », « N P K quinze quinze quinze », « kilos par hectare ») ; les cultures avec leur article (« le niébé », « de l'arachide ») ; les grosses quantités arrondies.
- **Fiable dans tous les navigateurs** : lecture phrase par phrase (Chrome coupe les lectures de plus de 15 secondes) ; choix automatique de la meilleure voix française de l'appareil (voix « Natural » d'Edge, « Google français » de Chrome, voix « Premium » d'Apple ; les voix robotiques sont écartées) ; la lecture s'arrête quand on change de fonctionnalité.
- **Testé** : un navigateur de test intercepte la synthèse vocale et enregistre chaque phrase lue, pour les dix fonctionnalités des deux profils.

Aucun serveur n'est nécessaire : la voix est celle du navigateur. Sa qualité dépend de l'appareil ; elle est la meilleure dans Edge (voix neuronales) et Chrome.

## 1 bis. Le message vocal d'accueil

Sans clic sur « Écouter », la voix lit le **résumé réel de l'écran ouvert**, avec ses vrais chiffres. C'est le même texte que les mascottes, encadré d'une phrase avant et d'une phrase après, la dernière disant quoi faire ensuite :

| Profil | Quand | Ce qui est dit | Langue |
|---|---|---|---|
| Agriculteur | dès que le champ est localisé (« Me localiser », liste, carte), à chaque onglet ouvert et à chaque changement de lieu | le résumé de l'onglet ouvert : « Ma parcelle », « Va-t-il bien pleuvoir ? », « Que semer ? », « Quand semer ? », « Combien m'en faut-il ? », « Contre-saison » | Wolof (repli : français) |
| Agriculteur | à l'entrée, champ pas encore localisé | message de secours : ce que montre la page, puis « appuyez sur Me localiser » | Wolof (repli : français) |
| ONG et services de l'État | à l'entrée | « Où agir en priorité » : départements à surveiller, Cadre harmonisé, alerte récolte, saison | Français |

Les sous-titres de la phrase en cours s'affichent sous l'en-tête (pendant la préparation de la voix wolof, tout le texte est déjà lisible). Commandes : Pause / Reprendre, Rejouer, Couper le son, et un bouton haut-parleur dans l'en-tête pour réentendre le résumé.

- **Textes** : `app/src/scene/voix/voiceMessages.ts`. On y trouve les onglets lus seuls (`LIRE_CHAQUE_ONGLET` : tous pour l'agriculteur, le premier seulement pour l'ONG), l'encadrement du résumé par écran (`ENCADREMENT`) et les messages de secours (`MESSAGES`). Le résumé lui-même vient de l'écran (`aEcouter`, `aEcouterWo`). Le wolof est **à faire relire**.
- **Ordre des voix** (`app/src/scene/voix/accueil.ts`) : fichier enregistré (message de secours seulement, le résumé changeant avec les données) → synthèse wolof du serveur (attendue 20 s au plus ; elle continue en arrière-plan et « Rejouer » sera en wolof) → voix française du navigateur (fr-FR, débit 0,9) → texte seul. Chaque source est un `Lecteur` (`demarrer`, `pause`, `reprendre`, `arreter`).
- **Le résumé est complet avant d'être lu** : on attend qu'il ne change plus pendant 1,5 s (les données arrivent par morceaux), sans dépasser 8 s.
- **Autoplay** : le clic sur la porte et le choix du lieu autorisent la voix. Si le navigateur la bloque quand même (page rechargée), le bandeau affiche « 🔊 Écouter ».
- **Préférences** : « Couper le son » est mémorisé par profil (`localStorage`, `assaman.accueil.muet.<profil>`) et coupe aussi la lecture au changement de lieu ; le bouton haut-parleur la réactive. L'accueil d'entrée n'est joué qu'une fois par onglet, sauf nouveau passage par la porte. Une langue choisie (`localStorage`, `assaman.langue` = `fr` ou `wo`) remplace celle du profil.
- **Une seule voix** : l'accueil coupe les mascottes ; une mascotte ou un changement d'écran coupe l'accueil.
- **Durée** : le résumé wolof de « Ma parcelle » dépasse souvent 40 s (nombres dits en toutes lettres).

## 2. Poser une question (API seulement)

Le bouton micro a été retiré de l'application (peu utile face aux mascottes). Les routes ci-dessous restent dans l'API pour un usage futur (serveur vocal, WhatsApp).

On pose sa question à voix haute ; la plateforme répond avec ses vraies données, à l'écrit et à l'oral, et la carte se place sur la réponse.

| Profil | Langue | Écoute | Voix de la réponse |
|---|---|---|---|
| Agriculteur | **Wolof** | M-Kiriku-ASR (IA Hub Sénégal), dans le Space Hugging Face | Adia TTS (CONCREE), dans le Space |
| ONG et services de l'État | **Français** | Le navigateur (reconnaissance vocale de Chrome, Edge, Safari) | Le navigateur (synthèse vocale) |

## Comment ça marche
```
Question parlée
  → transcription (wolof : Space ; français : navigateur)
  → compréhension (api/voix/comprendre.py) : fonctionnalité, département, culture, année, surface
  → réponse (api/voix/repondre.py) : chiffres lus dans le cache de l'API, phrases types en français et en wolof
  → voix (wolof : Space ; français : navigateur) + la carte s'ouvre sur le bon bouton
```

**Pas de texte inventé** : aucun modèle ne rédige librement. Les réponses sont des phrases types remplies avec les chiffres réels de la plateforme. Si une donnée manque, la réponse le dit. Si le département manque, la plateforme le demande.

Ce que la voix comprend :

| Fonctionnalité | Exemples (français) | Mots wolof repérés |
|---|---|---|
| La saison qui vient | « Comment sera la pluie à Kaolack en 2027 ? » | taw, nawet |
| Quand semer | « Quand semer l'arachide à Kaolack ? » | ji, kañ |
| Quelle culture (récolte) | « Quelle récolte attendre à Nioro ? » | bey, ngóob |
| Mes besoins | « Combien d'engrais pour 2 hectares de mil à Kaffrine ? » | soxla, ektaar |
| Alerte récolte | « Quels départements sont en alerte en 2026 ? » | — |

Les cultures se disent aussi en wolof : gerte (arachide), dugub (mil), mboq (maïs), ñebbe (niébé), malo (riz)… Les nombres de la réponse wolof sont écrits en toutes lettres (`api/voix/nombres.py`), car la voix de synthèse lit mal les chiffres.

> **À faire relire par un locuteur wolof de l'équipe** : les phrases types (`api/voix/repondre.py`), les mots-clés (`api/voix/comprendre.py`) et les nombres (`api/voix/nombres.py`).

## Adia TTS sur un Space Hugging Face (la plus claire)

> **Décision du 22/11/2026 : rester gratuit, pas d'abonnement PRO.** Le Space ZeroGPU décrit ici n'est donc pas retenu tel quel ; le code du Space reste prêt pour un Space gratuit sur processeur. Pistes gratuites et suite : `docs/technique/passation-voix-wolof.md`.

| | |
|---|---|
| Modèle | [CONCREE/Adia_TTS](https://huggingface.co/CONCREE/Adia_TTS) : Parler-TTS affiné sur 40 h de wolof, 24 kHz, Apache 2.0 (créditer CONCREE) |
| Voix | « A clear and educational voice, with a flow adapted to learning », réglages de la fiche du modèle (`temperature` 0,8, `top_k` 50, `repetition_penalty` 1,2) |
| Vitesse | le texte est coupé en morceaux de 200 caractères au plus (aux fins de phrase, jamais au milieu d'un mot), **tous synthétisés en une seule passe** sur la carte graphique : un résumé entier prend à peu près le temps d'un morceau |
| Poids | sortie **mp3** (5 à 10 fois plus léger que le wav), volume homogène ; le navigateur reconnaît mp3 ou wav à leurs premiers octets |
| Débit | jusqu'à 3 synthèses en parallèle vers le Space (une seule à la fois pour le service « voix » du serveur) |
| Secours | si le Space ne rend rien (endormi, quota épuisé), le service « voix » du serveur (SpeechT5, moins net) prend le relais ; le front passe au français au-delà de 20 s |

Kiriku-Wolof-ASR (IA Hub Sénégal) ne convient pas pour la voix : c'est un modèle de **reconnaissance** (la parole en texte). Le Space utilise sa version M-Kiriku-ASR pour comprendre les questions parlées.

**Mise en ligne** (une fois, puis après chaque modification de `voix/space/`) : suivre « Variante : Space Hugging Face » plus bas (abonnement PRO, `HF_TOKEN`, `venv/bin/python -m voix.deployer_space`), puis copier `VOIX_SPACE` et `HF_TOKEN` dans le `.env` du serveur et relancer l'API. Avec `VOIX_SPACE` renseigné, l'API passe par le Space en premier.

## Voix de secours : SpeechT5 sur le serveur (gratuit, sans carte bancaire)
La voix est produite sur le processeur du serveur (`api/voix/tts_local.py`). **En production, elle tourne dans son propre conteneur** `voix` (`api/voix/service.py`, `deploy/Dockerfile.voix`), limité à un cœur et 3 Go : l'API l'appelle (`VOIX_SERVICE_URL`) et abandonne au bout de 90 s (`VOIX_SERVICE_DELAI_S`). Une synthèse ne peut donc plus ralentir la carte et les fiches (audit, constat ARC-02). En développement, sans `VOIX_SERVICE_URL`, l'API produit la voix elle-même si `requirements-voix.txt` est installé.

| | |
|---|---|
| Modèle | [bilalfaye/speecht5_tts-wolof](https://huggingface.co/bilalfaye/speecht5_tts-wolof) : SpeechT5 affiné sur le wolof, **licence MIT**, accès libre, ~580 Mo |
| Vocodeur | microsoft/speecht5_hifigan |
| Voix | voix féminine « slt » du jeu CMU Arctic (`api/voix/locuteur_wolof.npy`, 2 Ko), comme dans la fiche du modèle |
| Vitesse | quelques secondes par phrase sur un processeur, sans carte graphique |

Sur le serveur (VPS) : rien à installer, `docker compose -f docker-compose.prod.yml up -d --build` construit aussi le conteneur `voix` (voir `deploy/README.md`). En local, pour essayer la voix dans l'API :
```bash
pip install -r requirements.txt -r requirements-voix.txt
```
Laisser `VOIX_SPACE` vide dans `.env`. Le conteneur `voix` télécharge et charge les modèles dès son démarrage (~1 minute) ; l'API locale, au premier appel. Chaque voix produite est gardée sur disque (`voix/cache/`) et dans le navigateur : la rejouer est instantané. Sans `requirements-voix.txt`, la fille WLF répond « voix wolof non installée » et le reste fonctionne.

Prévoir au moins 2 Go de mémoire libre sur le serveur pour la voix (le conteneur `voix` est plafonné à 3 Go).

## Variante : Space Hugging Face avec carte graphique (abonnement PRO, carte bancaire non prépayée)
La voix tourne sur la carte graphique de Hugging Face (ZeroGPU) : quelques secondes par texte. Le serveur de la plateforme (VPS) n'a besoin ni de carte graphique ni de modèle : il appelle le Space. Héberger un Space Gradio demande l'abonnement **PRO** (9 $/mois : hébergement ZeroGPU, quota de carte graphique ×8, priorité).

1. Prendre l'abonnement PRO sur https://huggingface.co/pro (compte `abdou221`).
2. Créer un jeton **Write** sur https://huggingface.co/settings/tokens et le mettre dans `.env` : `HF_TOKEN=hf_…` (jamais dans git).
3. Depuis la racine : `venv/bin/python -m voix.deployer_space`

Le script crée le Space `abdou221/assaman-suuf-voix`, y dépose `voix/space/`, demande ZeroGPU et écrit `VOIX_SPACE` dans `.env`. Premier démarrage du Space : quelques minutes (téléchargement d'Adia TTS) ; suivre l'onglet « Logs » du Space. Pour le mettre à jour après une modification de `voix/space/`, relancer la même commande.

**Le jeton sert aussi à l'API** : le quota ZeroGPU est décompté au compte qui appelle. Avec `HF_TOKEN` du compte PRO dans le `.env` du serveur, les voix utilisent le quota PRO (40 min/jour) ; sans jeton, le quota anonyme (2 min/jour).

**Fluidité** : chaque voix produite est gardée sur le disque du serveur (`voix/cache/`, ignoré par git) et dans le navigateur. La rejouer est instantané, sans consommer de quota. Avant une démo, appuyer une fois sur WLF dans chaque fonctionnalité à montrer.

Ce que celui qui récupère la branche doit faire : `pip install -r requirements.txt` (contient `gradio_client`), copier `.env.example` en `.env`, y mettre `HF_TOKEN` (donné personnellement). `VOIX_SPACE` est déjà renseigné.

## Brancher l'API sur le Space
Dans le `.env` à la racine :
```
VOIX_SPACE=<compte>/<nom-du-space>
HF_TOKEN=hf_…            # jeton du compte PRO : les voix sont décomptées sur son quota
```
Puis `venv/bin/python -m api`. Sans `VOIX_SPACE`, tout le reste fonctionne : la question en français marche, et la question en wolof répond « voix wolof non configurée ».

## Routes de l'API
| Route | Entrée | Sortie |
|---|---|---|
| `POST /api/v1/voix/texte` | `{texte, code_departement?, annee?}` | réponse en français et en wolof, vue de la carte |
| `POST /api/v1/voix/question?code_departement=&annee=` | l'audio brut (`audio/webm`…), 30 s au plus | transcription + réponse + voix wolof (wav en base64) |

`code_departement` et `annee` sont ceux affichés à l'écran : ils servent si la question ne les cite pas.

## Vie privée
L'audio est transcrit puis oublié : ni l'API ni le Space ne le conservent. La reconnaissance vocale du navigateur (français) passe par le service de l'éditeur du navigateur (Google pour Chrome).

## Limites
- M-Kiriku-ASR se trompe sur environ un mot sur six en wolof (WER 16 %, chiffre de la fiche du modèle). La compréhension par mots-clés résiste à ces erreurs, mais une phrase très mal transcrite peut être mal comprise : la transcription s'affiche toujours, pour que l'utilisateur voie ce qui a été entendu.
- Adia TTS : 200 caractères par phrase au plus (le Space découpe), qualité non mesurée par ses auteurs.
- Premier appel après une période d'inactivité : le Space se réveille (jusqu'à une minute).

## Crédits
M-Kiriku-ASR : AI Hub Senegal (Apache 2.0). Adia TTS : CONCREE (Apache 2.0).

## Guides vocaux : lecture phrase par phrase (français et wolof)

Les guides du dock (agriculteur : Français et Wolof ; ONG : Guide) parlent au clic seulement.

| Langue | Modèle (serveur, processeur) | Route |
|---|---|---|
| Français | Piper `fr_FR-siwis-medium` (`VOIX_FR_MODELE`) : ~0,3 à 1 s par phrase | `GET /api/v1/voix/francais?texte=` |
| Wolof | SpeechT5 wolof `bilalfaye/speecht5_tts-wolof-v0.2` (`VOIX_WO_MODELE`), 2 fils (`VOIX_WO_FILS`) : à peu près au rythme de la parole | `GET /api/v1/voix/wolof?texte=` |

- **Une phrase par requête** (WAV) : la voix part dès la première phrase, au lieu d'attendre le texte entier (avant : ~40 s de calcul pour l'introduction wolof avant le premier mot).
- **Dans l'ordre** : les phrases suivantes sont demandées d'affilée, l'une après l'autre, pendant que la première est dite.
- **Cache** : une phrase dite est gardée sur le serveur (`voix/cache`, `wo-*.wav`, `fr-*.wav`) et par le navigateur (`Cache-Control: immutable`). L'introduction wolof est demandée dès l'ouverture de l'espace : après le tout premier visiteur, elle part sans attente.
- **Même voix à chaque fois** : graine fixe pour SpeechT5 ; durée bornée par phrase (coupe les fins qui traînent).
- **Testé** (essais mesurés, novembre 2026) : la compression int8 du modèle wolof coupait les phrases (rejetée) ; Adia TTS est trop lent sur processeur ; Kiriku TTS est en accès restreint.
- **Français, serveur muet** : la voix du navigateur prend le relais. **Wolof, serveur muet** : un message le dit, le texte reste à l'écran.
