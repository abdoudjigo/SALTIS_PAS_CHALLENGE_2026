# Assistant de la scène (questions en français ou en wolof)

Bulle flottante en bas à droite de la carte (agriculteur et ONG, `AssistantFlottant`, montée par `pages/Scene.tsx`) ; sur téléphone elle se place au-dessus du tiroir. On écrit une question, ou on la dicte en français
(reconnaissance vocale du navigateur) ; la réponse s'affiche et se lit à voix haute : français par la voix du navigateur,
wolof par la voix de synthèse du serveur (`POST /api/v1/voix/parler`, voir `voix/README.md`). Repli en français si la voix
wolof ne répond pas. Préférences gardées dans le navigateur : `assaman.assistant.langue`, `assaman.assistant.voix`.

## D'où viennent les réponses

`POST /api/v1/voix/texte` (`api/routes/voix.py`) : la question est comprise par mots-clés (`api/voix/comprendre.py`), puis :

| Sujet | Exemple | Source |
|---|---|---|
| `saison`, `semis`, `culture`, `besoins`, `alerte` | « Kañ laa wara ji gerte ci Kaolack ? » | cache de l'API (marts et modèles), chiffres réels, phrases types FR et WO |
| `bulletin` | « Que dit le dernier bulletin ? », « La pluie en septembre 2025 », « Des conseils ? » | bulletins décadaires de l'ANACIM (juin 2023 → août 2026), texte cité tel quel, **sections pluie, agriculture, prévisions et conseils seulement** |
| `hors_champ` | « Y a-t-il des chenilles ? », « Mes moutons », « Le fleuve à Bakel », « Le prix au marché » | texte fixe : hors de la plateforme, rappel de ce qu'elle couvre |
| `aide` | « Bonjour », « Ça va ? », « Merci », « Au revoir », « D'accord », « Qui es-tu ? » (et en wolof : « Salaam aleekum », « Naka nga def ? », « Jërëjëf », « Ba beneen ») | bonnes manières (`comprendre.POLITESSE`) : on rend le salut (« Bonsoir » → « Bonsoir », « Salaam aleekum » → « Maalekum salaam »), puis une phrase d'aide. Un salut devant une vraie question est rendu avant la réponse |
| `libre` | « Pourquoi mon mil jaunit ? » | passages de bulletins les plus proches (BM25) ; si `LLM_API_KEY` est renseignée (Groq gratuit), le modèle rédige 3 phrases à partir de ces seuls passages, sinon le passage est cité |

Une question sans mot-clé mais avec un département ou une année reste une question de saison ; une question libre
n'est retenue que si le passage contient l'essentiel de ses mots rares (sinon : « pas trouvé ») (« Et pour Kolda ? »).
Le département et l'année de l'écran servent quand la question n'en cite pas ; l'année de l'écran ne filtre jamais les bulletins.
« Voir sur la carte » ouvre l'écran de la réponse avec son département, sa culture et son année.

## Bulletins de l'ANACIM

- Textes : `data/text/anacim/*.txt` (extraits des PDF, hors Git).
- Base : `api/voix/bulletins_anacim.json.gz` (versionnée, ~215 Ko : décade, sommaire, sections par thème).
- Reconstruire après l'ajout de bulletins : `venv/bin/python ingestion/collecte/bulletins_anacim/construire.py`.

## Limites connues

- Les réponses wolof sur les bulletins disent seulement la décade et le sujet : le texte de l'ANACIM est en français
  (aucune traduction automatique fiable et gratuite). Phrases wolof **à faire relire par un locuteur** (`repondre.py`, `bulletins.py`, `Assistant.tsx`).
- Hors champ : ravageurs, élevage, santé animale, fleuves et marchés ne font pas partie d'Assaman & Suuf. L'assistant n'en
  cite rien, même quand le bulletin en parle : sections écartées et phrases filtrées par mots (`bulletins.SECTIONS_HORS_CHAMP`,
  `bulletins.MOTS_HORS_CHAMP`), questions orientées vers `hors_champ` (`comprendre.MOTS_HORS_CHAMP`). Un mot oublié peut laisser
  passer une phrase : compléter ces listes.
- Recherche par mots : une question vague peut tomber sur un passage voisin. La source est toujours affichée.
- Pas de dictée en wolof : la reconnaissance du navigateur ne le connaît pas (`/voix/question` existe côté API, via le Space).
- `VOIX_QUESTIONS` est `true` par défaut (audit BE-02 : rouvert depuis que l'assistant existe) ; `false` coupe l'assistant,
  qui répond alors « pas ouvert sur ce serveur ». Débit limité par adresse (`LIMITE_VOIX_TEXTE_PAR_MINUTE`) ; la rédaction par le modèle
  partage la limite `llm` des PDF (au-delà : passage cité).
