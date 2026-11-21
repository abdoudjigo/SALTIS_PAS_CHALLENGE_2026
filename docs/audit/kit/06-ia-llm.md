# Module 06 : IA, LLM, chatbots et modèles ML

> Prérequis : `audit/01-cartographie.md`. À lancer si la plateforme utilise un LLM, du RAG, un assistant vocal ou un modèle ML.
> Rapport : `audit/06-ia.md` · Préfixe des constats : `IA`

## Rôle

Tu es ML/LLM engineer senior. Tu évalues la qualité, la fiabilité, la sécurité et le coût des composants IA. Lecture seule ; règles et format dans `README.md`. N'envoie aucun appel payant à une API LLM sans accord.

## A. Composants LLM et chatbots

### Inventaire
- [ ] Fournisseurs et modèles utilisés (nom exact et version), où ils sont appelés, avec quels paramètres (température, `max_tokens`).
- [ ] Prompts système : où sont-ils stockés (en dur, fichiers, BDD) ? Versionnés ? Recopie leur structure, pas forcément leur texte intégral.
- [ ] Framework (LangChain, LlamaIndex, SDK natif, Vercel AI SDK...) et pertinence de ce choix.

### Conception des prompts
- [ ] Rôle, contexte, contraintes, format de sortie et cas de refus clairement définis.
- [ ] Sorties structurées (JSON schema, tool use) plutôt que parsing de texte libre fragile.
- [ ] Langue : comportement en français, en wolof et en mélange des deux (code-switching) ; qualité réelle en wolof testée ?
- [ ] Domaine sensible (santé, agriculture, finance, juridique) : avertissements, renvoi vers un humain, refus de conseils dangereux.

### RAG (si présent)
- [ ] Ingestion : formats sources, découpage (taille, chevauchement, respect des sections), métadonnées.
- [ ] Embeddings : modèle, adapté à la langue ? Base vectorielle (pgvector, Pinecone, Chroma, Qdrant) et index.
- [ ] Récupération : top-k, seuil de similarité, recherche hybride (mots-clés + vecteurs), reranking.
- [ ] Citations des sources dans la réponse ; comportement quand rien de pertinent n'est trouvé (doit dire « je ne sais pas »).
- [ ] Fraîcheur : réindexation quand les documents changent.

### Évaluation
- [ ] Existe-t-il un jeu d'évaluation (questions + réponses attendues) ? Sinon, c'est un constat 🟠.
- [ ] Métriques suivies : exactitude, fidélité aux sources, pertinence, taux de refus, hallucinations (Ragas, DeepEval, promptfoo, évaluation manuelle).
- [ ] Tests de non-régression quand on change de prompt ou de modèle.
- [ ] Propose 20 questions de test représentatives du domaine, dont 5 pièges (hors sujet, ambiguës, en wolof, injection).

### Sécurité IA (OWASP Top 10 for LLM Applications)
- [ ] Injection de prompt directe et indirecte (via documents RAG, pages web, e-mails) : instructions système séparées des données ?
- [ ] Fuite du prompt système ou de données d'autres utilisateurs (isolation des contextes et des index par tenant).
- [ ] Sorties du LLM traitées comme non fiables : pas d'exécution directe, assainissement avant rendu HTML, validation avant appel d'outil.
- [ ] Outils / agents : permissions minimales, confirmation humaine pour les actions sensibles.
- [ ] Données personnelles envoyées au fournisseur : minimisation, politique de rétention du fournisseur.
- [ ] Limites d'usage : rate limiting par utilisateur, plafond de tokens, protection contre l'abus de coût.

### Coût, latence et robustesse
- [ ] Estimation du coût par conversation et par mois au volume visé (tokens entrée/sortie × tarif).
- [ ] Mise en cache (prompt caching, cache de réponses fréquentes), choix d'un modèle plus petit pour les tâches simples.
- [ ] Streaming des réponses ; latence perçue sur réseau mobile.
- [ ] Timeouts, retries, modèle de repli si le fournisseur tombe.
- [ ] Journalisation des échanges (avec consentement et masquage) pour améliorer le système.

### Voix (si assistant vocal)
- [ ] STT et TTS : modèles utilisés, qualité en wolof et accents locaux, taux d'erreur mesuré.
- [ ] Gestion du bruit, des coupures, de la taille des fichiers audio sur réseau lent.

## B. Modèles ML classiques (prédiction, classification, séries temporelles)

- [ ] Reproductibilité : seeds, versions des données et du code, environnement figé.
- [ ] Découpage train/validation/test sans fuite (fuite temporelle pour les séries, fuite spatiale pour les données géographiques).
- [ ] Baseline simple comparée ; métriques adaptées au problème et au coût des erreurs.
- [ ] Biais et couverture : régions, saisons, populations sous-représentées.
- [ ] Suivi des expériences (MLflow, W&B) et registre de modèles.
- [ ] Service en prod : format, version chargée, validation des entrées, latence.
- [ ] Surveillance de la dérive des données et des performances ; plan de réentraînement.
- [ ] Explicabilité pour les utilisateurs finaux (pourquoi cette recommandation ?).

## Livrables du rapport

1. Note /5 et synthèse : Conception · RAG · Évaluation · Sécurité IA · Coût/latence · ML.
2. Fiche par composant IA : modèle, usage, coût estimé, risques.
3. Constats `IA-xx` au format standard.
4. Jeu de 20 questions de test proposé (format tableau : question, réponse attendue, critère de réussite).
5. Feuille de route IA : 5 actions pour passer d'un prototype à un système évalué et surveillé.

## Commandes utiles

```bash
grep -rEn "openai|anthropic|mistral|gemini|groq|ollama|huggingface|langchain|llama_index|ai-sdk" --include=*.{py,ts,js,json,toml,txt} . | grep -v node_modules
grep -rEn "system_prompt|systemPrompt|role.*system|SYSTEM_PROMPT" .
grep -rEn "temperature|max_tokens|top_k|chunk_size|chunk_overlap|similarity" .
grep -rEn "pgvector|pinecone|chroma|qdrant|weaviate|faiss" .
find . -name "*.ipynb" -o -name "*.pkl" -o -name "*.joblib" -o -name "*.onnx" -o -name "*.pt" | grep -v node_modules
```
