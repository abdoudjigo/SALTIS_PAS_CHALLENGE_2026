# Passation : résumé vocal automatique et voix wolof (22/11/2026)

Document de reprise pour la session Claude Code (ou la personne) qui continue ce travail.
Branche `assaman_suuf`. **Rien n'est commité** : tout est dans l'arbre de travail (voir « État des fichiers »).

## 1. Ce que l'utilisateur veut

1. **Une voix qui part seule** dans l'espace agriculteur et dans l'espace ONG / services de l'État.
2. Elle lit **le résumé réel de l'écran**, avec les vrais chiffres du champ ou du pays, et non un texte de présentation fixe.
   - **Agriculteur : en wolof**, sur **tous les onglets** (Ma parcelle, Saison, Que semer, Quand semer, Combien m'en faut-il, Contre-saison), à chaque onglet ouvert et à chaque changement de lieu.
   - **ONG : en français**, sur tous les onglets (Où agir en priorité, Que prévoit la saison, Où la récolte peut-elle chuter, Besoins et budget, Répartir et livrer, Fort potentiel, Exporter le dossier), à chaque onglet ouvert.
3. Sous-titres pendant la lecture, boutons Pause / Rejouer / Couper le son, choix « couper » mémorisé, bouton « 🔊 Écouter » si le navigateur bloque la lecture.
4. Textes modifiables sans toucher au code (fichier de configuration).
5. **Une voix wolof plus claire** que l'actuelle.
6. **Contrainte ferme : rester gratuit.** Pas d'abonnement Hugging Face PRO ni d'autre service payant.

Historique des choix :
- Un premier message d'accueil fixe (« voici ce que montre la page ») a été refusé. L'utilisateur veut le résumé des données, comme celui des mascottes.
- L'utilisateur a proposé AIHubSN/Kiriku-Wolof-ASR pour la clarté. **C'est un modèle de reconnaissance vocale** (Whisper large-v2 affiné : la parole devient du texte), donc inutilisable pour produire une voix.
- Adia TTS sur un Space ZeroGPU a été recommandé, puis **refusé** (abonnement PRO payant).

## 2. Ce qui est fait et vérifié

### Front (`app/src/`)
| Fichier | Rôle |
|---|---|
| `scene/voix/voiceMessages.ts` (nouveau) | **Configuration seule** : `LIRE_CHAQUE_ONGLET` (`true` pour agriculteur et organisation), `ENCADREMENT` (une phrase avant et une après le résumé, par écran : `parcelle`, `campagne`), `MESSAGES` de secours (agriculteur non localisé), `REGLAGES` (débit 0,9, attente wolof 20 s, stabilité du résumé 0,6 s, attente max 5 s), `LIBELLES`. |
| `scene/voix/accueil.ts` (nouveau) | Moteur. Interface `Lecteur` (`demarrer/pause/reprendre/arreter`) ; sources dans l'ordre : fichier audio enregistré (secours seulement) → synthèse wolof via `POST /api/v1/voix/parler` → voix française du navigateur (fr-FR, 0,9, phrase par phrase) → texte seul. Le hook `useAccueilAuto` déclenche à l'entrée puis à chaque changement « écran \| lieu », une fois le résumé stable. Préférences : `localStorage assaman.accueil.muet.<profil>`, `sessionStorage assaman.accueil.entendu.<profil>`. Le choix `assaman.langue` vaut pour l'agriculteur ; l'ONG / l'État reste toujours en français. |
| `scene/voix/BandeauAccueil.tsx` (nouveau) | Bandeau « Résumé à voix haute » : sous-titre de la phrase en cours (`aria-live`), tout le texte pendant la préparation du wolof, Pause / Reprendre / Rejouer / Couper, « 🔊 Écouter » si la lecture est bloquée ; `BoutonAccueil` = haut-parleur dans l'en-tête. Fermeture automatique (5 s après « couper », 12 s après la fin). |
| `scene/voix/lecture.ts` | `syntheseWolof()` (cache partagé avec les mascottes), `surArret()` (une seule voix à la fois : mascotte ou changement d'onglet coupent l'accueil, et inversement), `urlAudio()` (mp3 ou wav reconnus aux premiers octets). Découpage des phrases corrigé : il ne coupe plus après le « ? » de « « Que semer ? » ». |
| `landing/entrer.ts` | `armerAccueil(profil)` au clic sur la porte d'entrée. Ce clic sert d'interaction pour l'autoplay. |
| `pages/Scene.tsx` | `ecranSortie` (quel écran a publié la sortie, pour ne pas lire l'ancien onglet), `resumeAccueil` = `{ ecran, fr: sortie.aEcouter, wo: sortie.aEcouterWo, lieu }`, montage du bandeau et du bouton. |

Les résumés eux-mêmes ne sont **pas** nouveaux : chaque écran les compose déjà (`aEcouter` en français, `aEcouterWo` en wolof, voir `scene/voix/wolof.ts` et `scene/modes/*.tsx`). L'accueil les réutilise tels quels.

### API et Space
| Fichier | Changement |
|---|---|
| `api/routes/voix.py` | `/voix/parler` : Space en premier si `VOIX_SPACE` est renseigné, **repli sur le service « voix »** du serveur s'il ne rend rien ; 3 synthèses simultanées vers le Space (`_synthese_space`), une seule pour le serveur. |
| `api/tests/test_voix.py` | Test `test_parler_par_le_space_puis_repli_sur_le_service`. |
| `voix/space/app.py` | Adia TTS : voix « A clear and educational voice… », réglages de la fiche (temp. 0,8, top_k 50, repetition_penalty 1,2), découpage ≤ 200 caractères aux fins de phrase (testé, texte intact), **génération par lot** de tous les morceaux (repli morceau par morceau), sortie **mp3** normalisée (repli wav). **Jamais déployé, jamais exécuté** (pas de GPU ni de modèle en local). |

### Documentation
- `voix/README.md` : section « 1 bis » (résumé vocal) et section « Voix wolof retenue : Adia TTS sur le Space ». ⚠️ Cette dernière suppose encore l'abonnement PRO : **à réécrire** selon la solution gratuite retenue (voir § 4).
- `docs/technique/plan-de-marquage.md` : `voix_lue` reçoit la propriété `origine` (`accueil_fichier`, `accueil_synthese`, `accueil_navigateur`).

### Vérifications faites
- `npm run typecheck`, `npx eslint src`, `npx vitest run` (30 tests) : OK. `venv/bin/python -m pytest -q api/tests` : 108 tests OK. `ruff` propre sur les fichiers touchés.
- Navigateur (serveur `front-demo` de `.claude/launch.json`, port 5174, données de démo) avec **voix simulées** :
  - agriculteur : présentation de secours à l'entrée, puis résumé wolof réel après le choix de Dakar ;
  - « Que semer ? », « Quand semer ? », « Combien m'en faut-il ? » lus seuls en wolof ;
  - repli en français si le wolof échoue ;
  - ONG : résumé français (69 mots, environ 30 s) ;
  - Pause, Reprendre, Couper (mémorisé), la mascotte qui coupe l'accueil, le bouton « Écouter » si blocage simulé ;
  - mp3 lu par l'accueil et par la mascotte WLF ;
  - bandeau correct sur téléphone (375 px).
- **Non vérifié** : le vrai son d'une synthèse wolof, quel que soit le modèle ; un vrai blocage d'autoplay dans un navigateur réel (le navigateur de test est toujours « activé ») ; la durée réelle des lectures.

## 3. Points connus
- Le résumé wolof de « Ma parcelle » dure souvent plus de 40 s, car les nombres sont dits en toutes lettres.
- Les phrases wolof écrites pour l'accueil (`ENCADREMENT`, `MESSAGES.agriculteur.wo`) sont **à faire relire par un locuteur wolof**, comme `wolof.ts`.
- Sous le wolof, les sous-titres n'affichent le français phrase à phrase que pour le message de secours : les résumés français et wolof n'ont pas le même découpage.
- En mode démo, l'API n'est pas lancée : la synthèse wolof échoue et c'est le français qui est lu. C'est normal.

## 4. Ce qui reste : une voix wolof plus claire, gratuitement

Aujourd'hui, la production utilise `bilalfaye/speecht5_tts-wolof` dans le conteneur `voix` (`api/voix/tts_local.py`), 16 kHz, avec l'empreinte d'une **voix anglaise** (« slt », `api/voix/locuteur_wolof.npy`). D'où le son étouffé.

Pistes gratuites, à évaluer **en écoutant** :
1. **Space Hugging Face gratuit sur processeur (`cpu-basic`)** avec Adia TTS. L'hébergement sur processeur ne demande pas PRO ; seul ZeroGPU le demande. `voix/deployer_space.py` essaie déjà ZeroGPU puis `cpu-basic`. Il faut un jeton « Write » gratuit dans `.env` (`HF_TOKEN`, que l'utilisateur doit mettre lui-même). Limites : synthèse lente sur 2 cœurs (à mesurer), mise en veille après inactivité (premier appel très lent), quota et file partagés. Le code du Space (lot, mp3) est déjà prêt.
2. **Adia TTS dans le conteneur `voix` du serveur** (processeur). Demande environ 4 à 5 Go de mémoire, alors que le conteneur est plafonné à 3 Go dans `docker-compose.prod.yml`. Lent ; le cache disque `voix/cache/` aide pour les textes rejoués.
3. **Améliorer SpeechT5 sans changer de modèle** : remplacer l'empreinte anglaise « slt » par une empreinte calculée sur une vraie voix wolof (par exemple avec `speechbrain/spkrec-xvector-voxceleb` sur un enregistrement wolof libre de droits), normaliser le volume, ajouter des pauses. C'est le moins coûteux et le plus rapide.
4. **Préchauffer le cache** : les résumés dépendent de 45 départements, des cultures et de l'année. On pourrait produire à l'avance les voix des textes les plus fréquents (par exemple « Ma parcelle » par département) pour une lecture instantanée.

Recommandation de départ : la piste 3, rapide, gratuite et sans nouvelle infrastructure, puis mesurer la piste 1 (temps par résumé sur `cpu-basic`) avant de choisir.

## 5. Reprendre

```bash
cd app && npm run typecheck && npx eslint src && npx vitest run
```
```bash
venv/bin/python -m pytest -q api/tests
```
- Voir le front : configuration `front-demo` de `.claude/launch.json`, puis entrer par la porte « Agriculteur » et choisir un département.
- Mémoire Claude du projet : contexte d'audit (production, 500 utilisateurs, accès autorisés) ; contrainte « gratuit seulement ».
- Commits : messages en français au format `type(portée) : …`, comme dans l'historique.
