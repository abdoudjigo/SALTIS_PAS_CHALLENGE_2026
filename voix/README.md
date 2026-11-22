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

## La voix wolof sur le serveur (gratuit, sans carte bancaire) — méthode retenue
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
