# Journal de la mission ONG — équipe de sous-agents

Date : 19/11/2026

Sources clonées hors du dépôt (`~/agents-sources/`), lues sans exécuter aucun script :
- `wshobson/agents`, commit `42203085cfc5736204bf0f6d436dff7e1da0bf3f`, licence MIT (Seth Hobson, 2024) ;
- `VoltAgent/awesome-claude-code-subagents`, commit `ed74d115b7fb7026a22a4f816a8e3250f425e3b4`, licence MIT (VoltAgent, 2025).

Chaque agent de `.claude/agents/` commence par le bloc « Règles du projet » ; la provenance figure en commentaire HTML sous l'en-tête YAML.

## Équipe

| Nom | Provenance | Rôle | Outils |
|---|---|---|---|
| sql-pro | VoltAgent/awesome-claude-code-subagents, commit ed74d115, MIT, `categories/02-language-specialists/sql-pro.md` | SQL Snowflake (lecture, modèles, scripts `snowflake/`) | Read, Grep, Glob, Edit, Write, Bash |
| fastapi-pro | wshobson/agents, commit 42203085, MIT, `plugins/python-development/agents/fastapi-pro.md` | API FastAPI, Pydantic, Redis, pytest | Read, Grep, Glob, Edit, Write, Bash |
| react-specialist | VoltAgent/awesome-claude-code-subagents, commit ed74d115, MIT, `categories/02-language-specialists/react-specialist.md` | Composants React 19 | Read, Grep, Glob, Edit, Write, Bash |
| typescript-pro | VoltAgent/awesome-claude-code-subagents, commit ed74d115, MIT, `categories/02-language-specialists/typescript-pro.md` | Types TypeScript du front | Read, Grep, Glob, Edit, Write, Bash |
| accessibility-tester | VoltAgent/awesome-claude-code-subagents, commit ed74d115, MIT, `categories/04-quality-security/accessibility-tester.md` | Audit WCAG 2.1 AA (lecture seule) | Read, Grep, Glob, Bash |
| test-automator | VoltAgent/awesome-claude-code-subagents, commit ed74d115, MIT, `categories/04-quality-security/test-automator.md` | Tests pytest, dbt, front | Read, Grep, Glob, Edit, Write, Bash |
| debugger | VoltAgent/awesome-claude-code-subagents, commit ed74d115, MIT, `categories/04-quality-security/debugger.md` | Diagnostic de défauts | Read, Grep, Glob, Edit, Write, Bash |
| code-reviewer | wshobson/agents, commit 42203085, MIT, `plugins/comprehensive-review/agents/code-reviewer.md` | Relecture de code (lecture seule) | Read, Grep, Glob, Bash |
| modelisateur-dbt-snowflake | écrit pour le projet | Seeds, staging, faits, marts dbt | Read, Grep, Glob, Edit, Write, Bash |
| gardien-scene-carte | écrit pour le projet | `app/src/scene/`, invariants I1 à I5 | Read, Grep, Glob, Edit, Write, Bash |
| ingenieur-export-pdf | écrit pour le projet | Export PDF jsPDF, capture de carte, A4 | Read, Grep, Glob, Edit, Write, Bash |
| verificateur-independant | écrit pour le projet | Vérification d'une phase, constats classés, aucune correction | Read, Grep, Glob, Bash |

Adaptations communes des agents importés : protocole « context manager » JSON, compteurs et messages de livraison chiffrés fictifs, objectifs chiffrés arbitraires, CI/CD, déploiement, Husky et « Use PROACTIVELY » retirés.

## Agents rejetés

| Nom | Raison |
|---|---|
| healthcare-admin (VoltAgent, `categories/07-specialized-domains/`) | Contenu douteux : demande d'installer par `curl … install.sh \| bash` depuis un dépôt tiers ; hors sujet de toute façon |
| data-engineer (les deux collections) | Redondant avec sql-pro et modelisateur-dbt-snowflake ; orienté pipelines (Spark, Airflow, Kafka) absents du projet |
| backend-architect (wshobson, 6 copies) | Trop large (microservices, 18 Ko) ; fastapi-pro suffit |
| python-pro (les deux) | Redondant avec fastapi-pro (seul code Python : `api/`) |
| fastapi-developer (VoltAgent) | Doublon ; version wshobson retenue |
| frontend-developer (les deux) | Redondant avec react-specialist et typescript-pro |
| ui-designer (les deux) | Risque de nouvelles couleurs ou cartes, contraire aux règles ; l'accessibilité suffit |
| qa-expert (VoltAgent) | Doublon de test-automator et verificateur-independant |
| code-reviewer (VoltAgent), typescript-pro et debugger (wshobson) | Doublons ; versions wshobson (relecteur) et VoltAgent retenues, plus complètes |

Limite de 8 agents importés respectée. Aucun script des dépôts exécuté.

## Phase A

### Phase A3 — Cadre harmonisé (ingestion)

Source : HDX `cadre_harmonise_caf_ipc_mars26.xlsx` (CILSS/IPC, CC BY), dans `data/raw/cadre_harmonise/`. Scripts : `ingestion/collecte/cadre_harmonise/preparer_ch.py`, `charger_snowflake.py` ; DDL `snowflake/40_cadre_harmonise_raw.sql` ; sortie `data/modules/e_cadre_harmonise_departement.csv`.

- **Colonnes réelles** : une feuille `Sheet1`, 41 357 lignes × 61 colonnes. Colonnes attendues toutes présentes, sens conforme : `adm0_name`, `adm1_name`, `adm2_name` (texte), `population`, `phase_class`, `phase1` à `phase5`, `phase35` (réels), `exercise_label` (texte, `Jan-May` / `Sep-Dec`), `exercise_year` (entier), `chtype` (`current` / `projected`), `usethisperiod` (`Y` / `N`). En plus : codes `adm0_pcod2/3`, `adm1_pcod2`, `adm2_pcod2` (ex. `SN1201`), `adm0_5/1_5/2_5/adm3` (vides pour le Sénégal : grain = département), `exercise_code` (1 = Sep-Dec, 2 = Jan-May), `reference_label` / `reference_year` (période couverte : current = cycle, projected = Jun-Aug), phases par résultat (`foodconsumption_phase`, `livelihoods_phase`, `nutrition_phase`, souvent nulles), 28 indicateurs détaillés FCG/HDDS/HHS/LhCSI/rCSI (rarement remplis, non repris), `notes` (vide).
- `usethisperiod = N` : uniquement les projections des cycles Sep-Dec (Jun-Aug de l'année suivante, remplacée par la projection du cycle Jan-May). Gardé en booléen `periode_a_utiliser`.
- Population : phase 1 + … + 5 ≠ `population` (> 1 personne) sur 13 lignes, laissé tel quel ; `phase35` = 3 + 4 + 5.
- **Cycles retenus** : 25 cycles, Jan-May 2014 à Jan-May 2026, current et projected ; 2 127 lignes. Jan-May 2025 n'a pas de « current » dans la source (projection seule). Dakar, Guédiawaye, Pikine absents de 2014 à 2019 (42 départements) ; Kédougou, Salémata, Saraya absents en Sep-Dec 2015 (39).
- **Correspondance** (nom normalisé sans accents, casse, espaces, tirets) : 45/45 dans le dernier cycle (current et projected). Exceptions : Birkelane → Birkilane, Malem Hodar → Malème Hodar, Medina Yoro Foulah → Médina Yoro Foula, Ranerou → Ranérou Ferlo, Koumpentoum → Koupentoum. « Nioro Du Rip » / « Nioro du Rip » réglé par la casse.
- **Département du fichier hors de nos 45** : Keur Massar (7 lignes, depuis Sep-Dec 2024), créé en 2021 par division de Pikine, absent de GADM 4.1. **Décision de l'utilisateur (19/11/2026)** : rattaché au code GADM de Pikine, en lignes séparées (`nom_departement_source` = nom du CH, ex-`departement_ch`) ; la fusion (somme des effectifs, phase la plus haute, colonne `fusion_keur_massar`) est faite dans dbt, pas dans Python. Grain de RAW : département source × cycle × type de période (clé `code_departement, nom_departement_source, annee_cycle, code_cycle, type_periode`). Keur Massar est en phase 1 au dernier cycle (pop. 814 863 ; phases 3-5 : 8 149 courant, 16 297 projeté).
- **Phase 3 ou plus, dernier cycle (Jan-May 2026)** :
  - projeté (Jun-Aug 2026) : Bambey phase 3, 90 593 personnes en phases 3-5 (pop. 411 787) ; Goudiry phase 3, 38 619 (183 898) ; Salémata phase 3, 7 623 (30 490). Total national phases 3-5 projeté : 836 787 avec Keur Massar, 820 489 sans ;
  - courant (Jan-May 2026) : Salémata seul en phase 3 (6 403) ; total phases 3-5 : 490 588 avec Keur Massar, 482 439 sans.
- **Comparaison avec la presse 2026** (Goudiry, Salémata, Bambey, Matam, Podor, Ranérou) : Goudiry, Salémata et Bambey confirmés en phase 3 projetée. Matam (42 138 en phases 3-5), Podor (67 772) et Ranérou (8 994) sont en phase 2 au niveau du département dans ce fichier : la presse cite sans doute des populations en crise ou une autre version de l'analyse, pas la phase du département.
- **Vérification** (`charger_snowflake.py` sans `--confirmer`) : aucune erreur (colonnes = DDL, codes GADM connus, grain unique, 45 départements au dernier cycle, phases 1-5, populations ≥ 0, phase 3-5 cohérente).
- **Chargement** (`--confirmer`, 19/11/2026) : table créée par le DDL sans commentaires, 2 127 lignes chargées dans `SALTIS.RAW.E_CADRE_HARMONISE_DEPARTEMENT`. Lecture de contrôle : 2 127 lignes, 45 départements, 25 cycles (2014-2026), 3 départements en phase 3+ projetée au dernier cycle, 820 489 personnes en phases 3-5 projetées. Aucun modèle dbt (source à déclarer par l'agent dbt).
- **Rechargement avec Keur Massar** (`--confirmer`, 19/11/2026) : vérification sans erreur (45 codes, Keur Massar présent, 7 lignes) ; le DDL passe en `create or replace` (table recréée à chaque chargement, clé élargie) et le chargeur refuse un DDL qui ne donne pas 4 instructions (un `;` dans un commentaire de colonne couperait le `create`). Lecture de contrôle : 2 134 lignes, 45 codes, 25 cycles, 7 lignes Keur Massar ; phases 3-5 projetées au dernier cycle : 836 787 (avec Keur Massar), 820 489 (sans).

## Phase B

## Phase C

## Phase D

## Phase E

## Constats ouverts

- ~~`jspdf` absent de `app/package.json`~~ : résolu, jsPDF 4.2.1 ajouté en phase D1 (demandé par la mission).

## Décisions de l'utilisateur (19/11/2026) — Cadre harmonisé

1. **Keur Massar** : n'est plus écarté. Ses effectifs (population, phase1 à phase5, phase35) sont ajoutés à Pikine, car Pikine GADM couvre son territoire. Phase de Pikine = la plus haute des deux. Colonne `fusion_keur_massar` (booléen) et note affichée dans le détail : « Pikine et Keur Massar réunis (Keur Massar, créé en 2021, n'existe pas dans GADM) ». Test : total national des personnes en phases 3 à 5 identique avant et après la fusion.
2. **Période affichée** : dans le dernier cycle, la période marquée `usethisperiod` ; à défaut, la projection. Libellé toujours exposé et affiché (« mars 2026, projection juin-août 2026 »). Si la fin de la période est passée : mention « période terminée, prochain cycle attendu ».
3. **Spécification corrigée** :
   - Scénario Urgence (C5) : tri par phase décroissante, puis par personnes en phases 3 à 5 décroissantes, puis par score de vulnérabilité.
   - Étape 1 : la checklist montre le nombre de départements en phase 3 ou plus ET le total des personnes en phases 3 à 5, avec les 3 départements qui en comptent le plus.
4. **Citation CC BY (phase E)** : « Cadre harmonisé, CILSS et partenaires ; données via HDX (Food Security and Nutrition Working Group, Afrique de l'Ouest et du Centre) ».

## Décisions de l'utilisateur (19/11/2026) — produits absents de la formule retenue

- **DAP, NPK et urée absents de la formule retenue** : besoin = 0, libellé « pas dans la formule ». Note sur le DAP : « phosphate de fond (400 kg tous les 3 ans) volontairement exclu du besoin annuel ».
- **Fumier** : ni 0 ni total. Valeur NULL, libellé « non chiffré : fumure organique conseillée si possible ». Le fumier sort des totaux nationaux, du budget, de la répartition et du PDF ONG ; il reste visible, à titre de conseil, dans le détail agriculteur.
- **Contrôle Cadre harmonisé** : 836 787 personnes en phases 3 à 5 (projection juin-août 2026, Keur Massar compris) = chiffre officiel annoncé, à une personne près.

## Phase A1-A2 — Doses PIA et prix (modelisateur-dbt-snowflake)

- Fichiers : seeds `ref_doses_pia`, `ref_intrants` (11 intrants), `ref_prix_intrants` (copiés sans modification) ; `int_reference_dose` ; `dim_prix_intrant` ; `fact_reference_agronomique`, `fact_besoin_reference`, `mart_besoins`, `mart_territoires_agrodistrib`, yml et tests.
- Priorité : 1 recherche propre à la zone (Tounkara 2022 mil Casamance, Faye 2020 riz Vallée), 2 PIA national, 3 NON_VERIFIEE. Une source par zone × culture × groupe (engrais, semences, eau).
- Contrôles : Kaffrine × arachide NPK 6-20-10 = 54 999,67 × 150 / 1000 = 8 249,95 t ; Podor × riz urée = 9 847,67 × 300 / 1000 = 2 954,30 t. Superficie couverte : engrais 30,6 % → 95,4 % ; semences 2,3 % → 95,4 %.
- Besoins nationaux (t) : NPK 15-15-15 132 780 ; 15-10-10 129 490 ; 6-20-10 221 084 ; urée 214 237 ; DAP 4 928 ; fumier non chiffré ; semences 125 053.
- Prix 2026 (coût réel du sac) : 6-20-10 19 250 ; 15-15-15 21 500 ; 15-10-10 20 250 FCFA ; urée et DAP à saisir.
- Build : 292 nœuds, 0 erreur.

## Revue de la phase A (verificateur-independant)

- Verdict : acceptable, aucun constat bloquant ; `dbt test` PASS=128.
- Importants : documentation `etat-modelisation.md` / `contrat-donnees.md` à mettre à jour (confiée au modelisateur) ; API sans les deux nouveaux NPK (traité en phase B).
- Mineurs corrigés ou ouverts : voir « Constats ouverts ». Mineur non corrigé par décision : les 5 lignes PIA arachide « phosphogypse 400 kg/ha fumure de fond » n'ont pas de note d'exclusion (la décision ne visait que le DAP) ; `openpyxl` sans version figée (comme les autres dépendances).
- Corrections après revue (modelisateur) : macro `source_semis_faye_extrapole()`, tests de priorité capables d'échouer, `mention_periode`, colonnes documentées avec `accepted_values` ; `etat-modelisation.md` (sections 3, 4, 6, 7, nouvelle section 10) et `contrat-donnees.md` (sections 9 et 10) à jour.
- Contrôle final de la phase A (chef de projet) : `dbt test` sur toute la sélection, PASS=279, 0 erreur. **Phase A close.**

## Phase B — API (fastapi-pro)

- Fichiers : `api/schemas/` (besoins, agrodistrib, commun, referentiels, prix, cadre_harmonise), `api/cache/` (construction, cles), `api/marts.py`, `api/routes/` (donnees, outils, cadre_prix), `api/voix/repondre.py`, `api/docs.py`, `api/README.md`, `docs/technique/guide-api.md`, tests.
- Routes : `GET /prix-intrants?campagne=`, `GET /cadre-harmonise` et `/{code_departement}`, `GET /referentiels/intrants`, `GET /referentiels/phases-cadre-harmonise` ; marts facultatifs → 404 dédiés.
- `COLONNES_ADDITIVES` : + NPK 15-10-10 et 6-20-10, − fumier. Populations CH arrondies à 0,01. Constantes CH (libellés, mention) centralisées.
- Contrôles sur API locale : coûts réels 19 250 / 20 250 / 21 500 FCFA, urée/DAP à saisir ; CH 45 départements, 836 787 personnes en phases 3 à 5 ; Kaffrine × arachide 8 249,95 t de NPK 6-20-10.
- Revue (verificateur-independant) : conforme, 0 bloquant ; 1 important (README) et 3 mineurs corrigés. `pytest` : 97 tests OK (revérifié par le chef de projet), ruff CI OK. **Phase B close.**
- Ouvert : palette officielle des phases sans document source cité (valeurs données par l'utilisateur).

## Phase D1 — Moteur d'export PDF (ingenieur-export-pdf)

- Fichiers : `app/package.json` / `package-lock.json` (`jspdf` 4.2.1, version exacte, publiée le 17/03/2026), `app/src/export/` (types, texte, capture, pdf, dossierNational, ficheDepartement, index). jsPDF chargé à la demande (chunk séparé, 130 kB gzip).
- Capture : `once('render')` → `triggerRepaint()` → `toDataURL`, sans `preserveDrawingBuffer` ; note « carte non disponible sur cet appareil » sans WebGL ; vue restaurée même en cas d'erreur.
- Banc de test hors dépôt (Chrome headless, pdftotext) : dossier 11 pages, fiche 1 page ; accents, pied de page et numéros, page des sources contrôlés ; fumier filtré ; aucune valeur absente écrite 0.
- Pour D2 : `Carte.tsx` doit exposer l'instance unique (prop `onCarte` ou ref) ; barre de progression et branchement de l'étape 7 à faire ; dates des sources CH et PIA à fournir par l'appelant.

## Phase C — Espace ONG en 7 étapes (gardien-scene-carte)

- Fichiers (app/src) : nouveaux `scene/ong.tsx`, `scene/cadreHarmonise.ts`, `scene/vueVulnerabilite.tsx`, `scene/dossier.ts`, `scene/registreExport.ts`, `scene/modes/Potentiel.tsx`, `scene/modes/Exporter.tsx`, `api/mock/cadrePrix.ts` ; modifiés `pages/Scene.tsx`, `auth/AuthContext.tsx`, `scene/` (cadre, FicheReponse, fiche, ui, Carte, couleurs, besoinsPays, repartition, modes Campagne, Saison, AlerteRecolte, BesoinsPays, Repartir, ContreSaison), `api/index.ts`, `hooks/donnees.ts`, `types/marts.ts`, `api/mock/*` ; `scene/modes/Vulnerabilite.tsx` supprimé (vue intégrée à l'étape 1).
- Tests (vraie API et démo, 1 440 et 375 px, 2026 et 2030) : sélection partagée, Urgence = Bambey, Goudiry, Salémata ; Production suit le potentiel ; aucune part > besoin ; 0 erreur, 0 réponse 4xx ; espace agriculteur inchangé.
- Revues : vérificateur (3 importants), relecteur de code (8 importants, 4 mineurs), accessibilité (2 bloquants, 4 importants) — tous corrigés ; seconde passe du vérificateur : 0 bloquant, 0 important. Dernier texte sous `text-white/60` (libellé du profil, `pages/Scene.tsx`) corrigé par le chef de projet. **Phase C close.**
- Décisions du chef de projet : stock d'exemple supprimé (« Saisissez votre stock pour voir la répartition ») ; Proportionnel = prorata pur par défaut (réglage avancé à 0) ; dates limites : 6 appels au plus, appel témoin compris (5 cultures interrogées).
- Ouverts : en tonnes, la somme des sacs arrondis par département dépasse légèrement le stock (signalé à l'écran) ; CH compté seulement l'année de son cycle ; mineurs : double tri des phases non revérifié ; dates limites réelles et répartition avec stock saisi à recontrôler en D2.

## Phase D2 — Branchement PDF (ingenieur-export-pdf)

- Fichiers : `app/src/scene/modes/Exporter.tsx`, `app/src/export/ong.ts`, `app/src/export/progression.ts` ; retouches de `types.ts`, `pdf.ts`, `dossierNational.ts`, `ficheDepartement.ts`.
- Tests sur vraie API, 2026, Urgence, arachide, NPK 6-20-10, stock 20 000 t, prix saisi 15 000 FCFA : dossier 10 pages en ~47 s, fiche en ~37 s, à 1 440 et 375 px, 0 erreur ; chiffres identiques à l'écran ; aucun fumier.
- Ouverts : branche sans WebGL non testée ; vue Saison jamais « idle » (attente de 7 s au plus) ; police Helvetica (WinAnsi) ; dates des marts non fournies par l'API.

## Phase E — Documentation

- Étape 4 ONG (`scene/modes/BesoinsPays.tsx`) : un département sans superficie de référence (Guédiawaye, Pikine) affiche « pas de superficie agricole de référence » au titre et dans la checklist ; plus de total du pays sous son nom, aucun 0.
- Page « Données et sources » (`app/src/pages/site/Donnees.tsx`) : + doses IFDC-CORAF (PIA, fiches ISRA, à confirmer), Cadre harmonisé (citation exacte, CC BY), prix des intrants 2026 (APS, circulaire du 30 avril 2026).
- `docs/technique/etat-modelisation.md` : sections 6 et 10 vérifiées ; ajout « Front et API » en fin de section 10.

## Phrases à traduire en wolof

À faire traduire par l'équipe ; rien n'est traduit ici. `{…}` = valeur insérée par l'application.

- Commun : « saisi par vous ».
- Étape 1 (Où agir en priorité ?) — titre : « {n} départements à surveiller en {année} », « Campagne {année} » ; checklist : « Saison la plus probable : {classe} ({x} % de chances) », « Saison {année} non disponible », « Signaux {année} non disponibles », « Alerte récolte non disponible pour {année} », « Cadre harmonisé : {phase} », « Cadre harmonisé non disponible (ici) », « Vulnérabilité : {score} / 100 », « Vulnérabilité non notée (données insuffisantes) ».
- Étape 3 (Où la récolte peut-elle chuter ?) — titre : « {n} départements en alerte », « Alerte récolte » ; checklist : « {n} départements … », « {département} : {x} %, contre {y} % d'habitude », « En tête : {départements} », « Risque de chute : {x} % ({culture}) », « Risque habituel : {x} % · rang {r} sur {n} », « Alerte fiable à ce moment de la saison », « Risque habituel : pas encore une prévision de l'année ».
- Étape 4 (Combien faut-il, et pour quel budget ?) — titre : « {n} sacs de {intrant} pour {culture} », « Besoin en {intrant} non calculé », « {département} : pas de superficie agricole de référence » ; checklist : « Besoin : {n} sacs de 50 kg, soit {t} », « Besoin non calculé : dose à saisir », « Budget à votre prix : {x} (saisi par vous) », « Budget : {x} subventionné, {y} en coût réel », « Prix {intrant} à saisir : budget non calculé », « Doses connues pour {x} % des surfaces », « Pas de superficie de référence ici ».
- Étape 5 (Comment répartir mon stock, et livrer quand ?) — titre : « {q} de {intrant} pour {n} départements », « Rien à répartir en {intrant} », « Répartir le stock », « Saisissez votre stock pour voir la répartition » ; checklist : « Le stock couvre {x} % du besoin », « Première date limite : {date} ({département}) », « Date limite non disponible (pour {année}) », « Date limite : chargement ».
- Étape 6 (Où sont les zones à fort potentiel ?) — titre : « {n} départements avec de l'eau pour la contre-saison », « Zones à fort potentiel », « Fort potentiel : contre-saison non disponible » ; checklist : « Contre-saison : d'abord {département} », « Contre-saison : non disponible (ici) », « Gain de rendement : +{x} kg/ha ({culture}) », « Gain de rendement : non disponible », « Gain de rendement : non repéré ici ».
- Étape 7 (Exporter le dossier) — titre : « Exporter le dossier » ; checklist : « Campagne {année}, {culture} », « Le dossier reprend les {n} étapes du parcours », « Scénario {scénario} · {n} prix saisis ».
- Espace agriculteur : aucune liste dans ce journal ; voir les rapports des phases de l'espace agriculteur.
