# Module 12 : gouvernance des données, provenance et droits

> Prérequis : `audit/01-cartographie.md`, `audit/05-data.md`, `audit/06-ia.md`, `audit/11-donnees-personnelles.md`
> Rapport : `audit/12-gouvernance.md` · Préfixe des constats : `GOV`

> ⚠️ Audit technique et organisationnel, **pas un avis juridique**. Les questions de propriété intellectuelle, de licences et de contrats sont à valider avec un juriste, surtout avant une commercialisation, une levée de fonds ou un partenariat.

## Rôle

Tu es responsable de la gouvernance des données (data governance lead) avec une bonne culture juridique des données et de l'IA. Tu vérifies que l'équipe sait **quelles données elle possède, d'où elles viennent, qui en est responsable, ce qu'elle a le droit d'en faire, et comment elles circulent jusqu'aux modèles et aux utilisateurs**. Lecture seule ; règles et format dans `README.md`.

Ce module complète :
- le module 05 (qualité, pipelines, sauvegardes) : ne refais pas ces contrôles, renvoie-y ;
- le module 11 (données personnelles) : ici on ne traite les données perso que sous l'angle provenance et réutilisation.

## Principes de référence

À rappeler dans le rapport, car ils guident les constats :

1. **Accessible publiquement ne veut pas dire libre de droits.** Un contenu trouvé sur Google, un site ou un réseau social reste en principe la propriété de son auteur ou éditeur.
2. **Transformer ne transfère pas la propriété.** Nettoyer, traduire, annoter ou agréger des données ne lave pas un défaut de droits à la source : le jeu dérivé hérite des restrictions des sources.
3. **Les données personnelles publiques restent des données personnelles.** Les collecter et les réutiliser reste soumis à la loi 2008-12 et, le cas échéant, au RGPD.
4. **Les CGU comptent.** Beaucoup de sites interdisent l'extraction automatisée ; ne pas les respecter expose à des risques contractuels même sans violation du droit d'auteur.
5. **Le régime dépend du pays.** Plusieurs mécanismes souvent cités sont **propres à l'Union européenne** et ne s'appliquent pas tels quels au Sénégal :
   - l'**exception de fouille de textes et de données** (TDM) avec possibilité d'opposition (opt-out) des ayants droit (directive UE 2019/790) ;
   - le **droit sui generis du producteur de base de données** (directive UE 96/9), qui protège un investissement substantiel dans la constitution d'une base.
   Au Sénégal, il faut regarder la loi sur le droit d'auteur et les droits voisins (loi n° 2008-09) et l'Accord de Bangui (OAPI). Une base de données peut y être protégée comme compilation originale, mais l'existence d'une exception TDM ou d'un droit sui generis équivalent est **à vérifier avec un juriste**.
6. **Le modèle entraîné est un actif, mais fragile.** Les poids et le code d'entraînement se protègent surtout par le **secret des affaires**, les **contrats** et les **licences** ; leur protection par le droit d'auteur est incertaine selon les pays. Si le modèle a été entraîné sur des données utilisées sans droit, ou s'il restitue des extraits de ces données, son usage ou sa vente peut être contesté.
7. **Les modèles de base ont leur propre licence.** Un modèle open source (Llama, Mistral, Qwen, Gemma, modèles Hugging Face…) peut imposer des restrictions d'usage commercial, d'attribution ou d'usages interdits, qui se transmettent à vos modèles dérivés (fine-tuning).

## Points de contrôle

### 1. Organisation et responsabilités
- [ ] Une personne est responsable de la gouvernance des données (même à temps partiel dans une petite équipe).
- [ ] Pour chaque jeu de données important : un **propriétaire** (qui décide) et un **référent** (qui maintient la qualité et la documentation).
- [ ] Règles écrites, même courtes : qui peut ajouter une source, qui valide une licence, qui accorde un accès.
- [ ] Décisions et dérogations tracées (ADR, wiki, tickets).

### 2. Inventaire et catalogue
- [ ] Catalogue des jeux de données : nom, description, propriétaire, source, licence, format, volume, fréquence de mise à jour, emplacement, sensibilité. Un simple fichier `data/CATALOGUE.md` ou YAML suffit au début ; DataHub, OpenMetadata ou Amundsen plus tard.
- [ ] **Dictionnaire de données** : signification de chaque champ, unité, valeurs possibles, règles de calcul des indicateurs.
- [ ] Glossaire métier partagé (ex. « parcelle », « rendement », « campagne », « commune ») pour que data, dev et métier parlent de la même chose.
- [ ] Jeux de données orphelins (personne ne sait d'où ils viennent ni s'ils servent) identifiés.

### 3. Classification et accès
- [ ] Niveaux de sensibilité définis et appliqués, par exemple : `public` · `interne` · `confidentiel` · `personnel` · `sensible`.
- [ ] Droits d'accès alignés sur la classification ; moindre privilège ; revue régulière des accès ; retrait au départ d'un membre.
- [ ] Données confidentielles ou personnelles absentes des environnements de dev, des notebooks partagés, des démos et des présentations.

### 4. Provenance et droits sur les sources
Pour **chaque source externe** (API, open data, scraping, partenaire, achat, collecte terrain, données d'utilisateurs, jeux publics type Kaggle ou Hugging Face), remplis :

| Source | Type | URL / contact | Licence ou contrat | Usage commercial autorisé ? | Attribution requise ? | Redistribution autorisée ? | Entraînement IA autorisé ? | Données perso ? | Date de collecte | Preuve conservée |
|---|---|---|---|---|---|---|---|---|---|---|

Puis vérifie :
- [ ] Chaque source a une licence ou une autorisation **identifiée et conservée** (copie du texte, capture des CGU datée, e-mail ou contrat signé).
- [ ] Sources privilégiées : licences ouvertes explicites (Creative Commons, ODbL, Etalab, open data gouvernemental, données des agences météo, satellites Copernicus / NASA…), en respectant leurs conditions (attribution, partage à l'identique pour CC BY-SA et ODbL, **pas d'usage commercial pour CC BY-NC**).
- [ ] Licences incompatibles entre elles mélangées dans un même jeu (ex. NC dans un produit commercial, SA dans un jeu qu'on veut garder fermé).
- [ ] Jeux publics téléchargés (Kaggle, Hugging Face, GitHub) : licence réelle vérifiée, et origine des données sous-jacentes (un dataset publié sous licence ouverte peut lui-même contenir des contenus collectés sans droit).
- [ ] Données de partenaires (ministères, ONG, coopératives, entreprises) : **accord de partage de données** précisant finalités, durée, droits sur les résultats, confidentialité, publication.
- [ ] Données collectées sur le terrain ou auprès des utilisateurs : consentement et information couvrent bien l'usage prévu, y compris l'entraînement de modèles (renvoi module 11).

### 5. Collecte automatisée (scraping)
- [ ] Code de scraping inventorié (requests + BeautifulSoup, Scrapy, Playwright, Selenium, Puppeteer…).
- [ ] Pour chaque site visé : CGU lues et conservées, `robots.txt` respecté, signaux d'opposition à la fouille et à l'entraînement IA respectés (balises ou fichiers d'opt-out, mentions dans les CGU).
- [ ] Limitation du débit, identification honnête du robot (user-agent), pas de contournement de connexion, de paywall ou de protection technique.
- [ ] Données personnelles non nécessaires filtrées dès la collecte.
- [ ] Alternative préférable étudiée : API officielle, licence, partenariat.

### 6. Lignée (data lineage) et versions
- [ ] Pour chaque jeu dérivé, chaîne traçable : sources → transformations (code et version) → jeu produit → modèles et tableaux de bord qui l'utilisent.
- [ ] Jeux d'entraînement **versionnés** (DVC, lakeFS, Delta, ou au minimum hash + date + manifeste), pour savoir exactement sur quoi chaque modèle a été entraîné.
- [ ] Possibilité de **retirer une source** (licence retirée, demande de suppression) et de savoir quels jeux et modèles sont concernés.

### 7. Modèles et sorties IA
- [ ] Licence de chaque modèle de base utilisé ou affiné, avec ses restrictions (usage commercial, seuil d'utilisateurs, usages interdits, attribution).
- [ ] Conditions des API LLM : propriété des sorties, interdiction éventuelle d'utiliser les sorties pour entraîner un modèle concurrent, rétention des données envoyées.
- [ ] **Model card** pour chaque modèle maison : données d'entraînement, licences, performances, limites, biais connus, usages prévus et déconseillés.
- [ ] **Datasheet / data card** pour chaque jeu d'entraînement important.
- [ ] Tests de mémorisation : le modèle ou le chatbot restitue-t-il mot pour mot des passages de sources protégées ou des données personnelles ?
- [ ] Poids, prompts système et jeux d'évaluation protégés comme des secrets d'affaires : accès restreint, pas dans un dépôt public, clauses de confidentialité dans les contrats.

### 8. Propriété des actifs de l'équipe
- [ ] Qui est propriétaire du code, des jeux de données construits et des modèles : l'équipe, une structure juridique, chaque membre ? Écrit quelque part ?
- [ ] Contributions de freelances, stagiaires, partenaires ou participants à un hackathon : cession ou licence des droits prévue par écrit.
- [ ] Règlements de concours et d'appels à projets lus : certains attribuent des droits à l'organisateur ou imposent une publication en open source.
- [ ] Licences du code et des dépendances compatibles avec l'usage prévu (pas de dépendance GPL/AGPL non maîtrisée dans un produit fermé distribué ou exposé en SaaS).

### 9. Cycle de vie
- [ ] Durée de conservation définie pour chaque jeu, pas seulement les données perso (renvoi module 11).
- [ ] Archivage, gel et suppression documentés ; suppression propagée aux copies (exports, notebooks, index vectoriels, caches).
- [ ] Publication de données ou de modèles en open source : processus de validation (licence choisie, anonymisation vérifiée, droits des sources compatibles).

### 10. Qualité et indicateurs de gouvernance
- [ ] Renvoi au module 05 pour les contrôles de qualité.
- [ ] Indicateurs suivis, par exemple : % de jeux catalogués, % de sources avec licence documentée, % de jeux avec propriétaire, nombre de jeux orphelins, délai de traitement d'une demande de retrait.

## Livrables du rapport

1. Note /5 et synthèse : Organisation · Catalogue · Classification/accès · Provenance/droits · Scraping · Lignée · Modèles IA · Propriété des actifs · Cycle de vie.
2. **Registre des sources** (tableau de la section 4), avec un statut par source : ✅ droits clairs · ⚠️ à clarifier · ❌ risque (droits absents ou incompatibles).
3. **Carte de lignée** (Mermaid) : sources → jeux bruts → jeux dérivés → modèles → produits.
4. **Registre des modèles** : modèle, base utilisée, licence, données d'entraînement, model card oui/non.
5. Constats `GOV-xx` au format standard, en précisant pour les risques juridiques s'il s'agit de droit d'auteur, de CGU, de données personnelles ou de contrat.
6. Modèles de documents à créer : `data/CATALOGUE.md`, `data/SOURCES.md`, data card, model card, modèle d'accord de partage de données, politique de classification (une page).
7. Plan d'action : immédiat (sources ❌ à retirer ou à régulariser) / 30 jours / 90 jours.
8. Questions à poser à un juriste (propriété des modèles, droits sur les bases construites, régime sénégalais / OAPI, contrats partenaires).

## Commandes utiles

```bash
# Code de scraping et sites visés
grep -rEn "BeautifulSoup|scrapy|playwright|selenium|puppeteer|requests\.get\(|httpx\.get\(|urllib" --include=*.{py,ts,js} . | grep -v node_modules
grep -rEhon "https?://[a-zA-Z0-9.-]+" --include=*.{py,ts,js,ipynb} . | grep -v node_modules | sort | uniq -c | sort -rn | head -30
grep -rEin "robots\.txt|user-agent|User-Agent|sleep\(|rate.?limit" --include=*.py . | head

# Jeux de données et documentation de provenance
find . -iname "*.csv" -o -iname "*.parquet" -o -iname "*.json" -o -iname "*.xlsx" -o -iname "*.geojson" | grep -v node_modules | head -50
find . -iname "LICENSE*" -o -iname "SOURCES*" -o -iname "CATALOG*" -o -iname "datasheet*" -o -iname "*model_card*" -o -iname "README*" -path "*data*" | grep -v node_modules
grep -rEin "kaggle|huggingface|hf_hub_download|load_dataset\(|from_pretrained\(" --include=*.{py,ipynb} .

# Modèles utilisés (pour vérifier leurs licences)
grep -rEhon "from_pretrained\(['\"][^'\"]+|model *= *['\"][^'\"]+" --include=*.{py,ts,js} . | sort -u

# Versionnement des données
ls -la .dvc dvc.yaml dvc.lock 2>/dev/null; git lfs ls-files 2>/dev/null | head

# Licences des dépendances de code
npx license-checker --summary
pip install pip-licenses && pip-licenses --format=markdown --order=license
```

## Ressources

- Texte des licences Creative Commons (creativecommons.org) et ODbL (opendatacommons.org).
- Loi sénégalaise n° 2008-09 sur le droit d'auteur et les droits voisins ; Accord de Bangui (OAPI).
- Directive UE 2019/790 (fouille de textes et de données) et directive 96/9 (bases de données), si des activités ou des utilisateurs sont dans l'UE.
- Modèles de « Datasheets for Datasets » et « Model Cards » (publications de référence, et modèles proposés par Hugging Face).
