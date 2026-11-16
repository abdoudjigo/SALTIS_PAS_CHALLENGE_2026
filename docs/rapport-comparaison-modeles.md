# Rapport — comparaison des modèles (16/11/2026)

Pour chacune des trois parties de [`ml/README.md`](../ml/README.md), 6 modèles différents ont été comparés à une prévision de référence, avec la même validation pour tous. Ce rapport donne le modèle à prendre pour chaque partie et ce que les chiffres permettent de dire.

Méthode détaillée (familles, réglages, mesures, règle de choix) : [`ml/comparaison/README.md`](../ml/comparaison/README.md). Tous les chiffres viennent de `ml/sorties/comparaison_*.csv` et se recalculent avec les trois scripts de `ml/comparaison/`.

## 1. Résultat

| Partie | Tâche | Modèle à prendre | Bat la référence sur le test ? |
|---|---|---|---|
| 1. Pluie de saison | Pluie en mm | **Linéaire régularisé** (ridge) | Oui contre la normale 1991-2020 (gain +17 %, intervalle +8 à +30 %). Non prouvé contre la moyenne des 15 dernières saisons (+11 %, intervalle −4 à +31 %) |
| 1. Pluie de saison | Classe sèche / normale / humide | **Linéaire régularisé** (logistique) | Oui : RPSS +0,22 (intervalle +0,09 à +0,32) |
| 2. Rendement | Rendement en kg/ha | **Linéaire régularisé** parmi les 6 ; en pratique, la **tendance** | Non. Aucune des 6 familles ne fait mieux que la tendance |
| 2. Rendement | Chute de la récolte | **Linéaire régularisé** (logistique) | Non prouvé : gain net en validation, absent sur le test |
| 3. AgroDistrib | Répartition d'un stock | **Prorata multicritère** | Sans objet (aucune vérité observée) : seule méthode à ne faire moins bien que le prorata ni sur le ciblage, ni sur la valeur indicative |

Trois constats :

1. **Le modèle linéaire régularisé est retenu partout.** XGBoost, le gradient boosting, la forêt aléatoire, les plus proches voisins et le réseau de neurones ne font mieux nulle part de façon prouvée.
2. **Les modèles en service sont déjà de cette famille** (`m1-v1` : ridge et logistique ; `m3-v1` : logistiques). La comparaison confirme le choix : **aucun moteur n'est à remplacer**.
3. **Ce qui limite, ce sont les données, pas l'algorithme** : 35 situations océaniques pour la pluie, des rendements départementaux très bruités pour la récolte.

## 2. Ce qui a été comparé

Six familles, de la plus simple à la plus complexe : linéaire régularisé, k plus proches voisins, forêt aléatoire, gradient boosting (scikit-learn), XGBoost, réseau de neurones.

- **Jamais d'années mélangées** : un modèle ne prévoit une année qu'avec les années d'avant.
- **Validation** : choix du réglage de chaque famille, puis de la famille. **Test** : jamais utilisé pour choisir.
- **Règle de choix**, fixée avant de regarder le test : la famille la meilleure en validation ; si d'autres ne s'en distinguent pas du hasard, la plus simple d'entre elles.
- **Gain** = 1 − erreur du modèle / erreur de la référence. Les intervalles sont à 90 % et calculés sur des années entières : les 45 départements d'une année se ressemblent, il n'y a donc que 10 années de test pour la pluie et 7 pour le rendement.

## 3. Partie 1 — Pluie de saison (prévision de fin mai)

Données : `MART_ML_PREVISION_PLUIE`, 1982-2025. Validation 2001-2015 (5 blocs de 3 années), test 2016-2025.

### Pluie en mm

| Modèle | Variables choisies | RMSE validation | RMSE test | Gain test / normale | Gain test / moyenne 15 saisons |
|---|---|---|---|---|---|
| *Référence : normale 1991-2020* | — | *112,8* | *121,8* | *0* | *−0,07* |
| *Référence : moyenne des 15 dernières saisons* | — | *118,0* | *117,9* | *+0,06* | *0* |
| *Référence : moyenne de tout le passé* | — | *127,7* | *132,9* | *−0,19* | *−0,27* |
| *Référence : pluie de l'année précédente* | — | *158,5* | *167,6* | *−0,90* | *−1,02* |
| **Linéaire régularisé** (retenu) | océan (ONI, TNA, TSA) | 122,4 | **111,1** | **+0,17** (+0,08 à +0,30) | +0,11 (−0,04 à +0,31) |
| k plus proches voisins | océan + département | 120,7 | 121,2 | +0,01 (−0,10 à +0,17) | −0,06 |
| Forêt aléatoire | océan + département | 120,5 | 117,2 | +0,07 (−0,17 à +0,24) | +0,01 |
| Gradient boosting | océan + département | 122,6 | 119,0 | +0,05 (−0,11 à +0,24) | −0,02 |
| XGBoost | océan + département | 124,7 | 118,3 | +0,06 (−0,05 à +0,20) | −0,01 |
| Réseau de neurones | océan (ONI, TSA) | 123,9 | 140,1 | −0,32 (−1,52 à +0,28) | −0,41 |

RMSE en mm.

- **En validation, les 6 familles sont équivalentes** : de 120,5 à 124,7 mm, des écarts que le hasard suffit à expliquer. La forêt aléatoire est devant de 2 mm ; la règle retient donc la plus simple, le linéaire.
- **En validation, aucune famille ne bat les références.** La normale 1991-2020 (112,8 mm) n'est pas une comparaison équitable : elle contient les années 2001-2015 sur lesquelles on la juge. Mais la moyenne des 15 dernières saisons, calculée avec le seul passé, fait aussi bien (118,0 mm).
- **Sur le test, le linéaire est le seul dont le gain sur la normale est prouvé** (intervalle au-dessus de 0). Face à la moyenne des 15 dernières saisons, le gain de 11 % n'est pas prouvé.
- Le réseau de neurones se trompe lourdement sur le test (140 mm) : il extrapole mal hors des années vues.

### Classe de saison

| Modèle | Variables choisies | RPSS validation | RPSS test | Bonne classe (test) |
|---|---|---|---|---|
| *Référence : climatologie* | — | *0* | *0* | *38,4 %* |
| **Linéaire régularisé** (retenu) | océan (ONI, TNA, TSA) | **+0,04** (−0,11 à +0,17) | **+0,22** (+0,09 à +0,32) | **58,7 %** |
| k plus proches voisins | océan + département | +0,03 | +0,11 (+0,04 à +0,18) | 48,2 % |
| Forêt aléatoire | océan + département | +0,03 | +0,13 (−0,06 à +0,29) | 48,2 % |
| Gradient boosting | océan + département | −0,02 | −0,11 (−0,46 à +0,16) | 33,1 % |
| XGBoost | océan + département | 0,00 | +0,11 (0,00 à +0,20) | 44,7 % |
| Réseau de neurones | océan (ONI, TSA) | −0,03 | +0,14 (−0,10 à +0,34) | 54,0 % |

- Le linéaire est le meilleur en validation et sur le test, avec un gain prouvé sur le test.
- **Le gain de validation est faible et non prouvé** (+0,04, intervalle à cheval sur 0). Le bon score du test tient en partie aux années récentes, plus humides : le modèle sert à pencher la balance, pas à donner une certitude. C'est déjà ce que dit la fiche du modèle 1.

### Par rapport au modèle en service (`m1-v1`)

`m1-v1` est un linéaire régularisé sur ONI et TSA, pénalité 100. Le réglage arrivé en tête ajoute le TNA.

| | RMSE validation | RPS validation | RMSE test | RPSS test |
|---|---|---|---|---|
| `m1-v1` (ONI, TSA) | 123,0 | 0,2272 | 112,8 | +0,17 |
| Réglage en tête (ONI, TNA, TSA) | 122,4 | 0,2250 | 111,1 | +0,22 |

Les chiffres de test de `m1-v1` sont ceux de `evaluation_m1.csv` (entraînement depuis 1981). L'écart de validation est de 0,6 mm : **il ne justifie pas de changer `m1-v1`**. De plus, prévoir 2026 avec le TNA demanderait d'ajouter l'indice TNA de mars-mai 2026 à `ml/entrees/indices_ocean.csv`, qui ne contient que l'ONI et le TSA.

## 4. Partie 2 — Rendement

Données et préparation du modèle 3 : 5 cultures pluviales (arachide, mil, sorgho, niébé, maïs), cible = rendement / moyenne des 10 campagnes précédentes, 1991-2015, quatre moments (fin mai, fin juin, fin juillet, fin août). Validation 2001-2008, test 2009-2015, chaque année prévue avec les années d'avant. Les chiffres ci-dessous regroupent les quatre moments.

### Rendement en kg/ha

| Modèle | MAE validation | MAE test | Gain test / tendance |
|---|---|---|---|
| *Référence : tendance (moyenne des 10 campagnes précédentes)* | *242,2* | *228,1* | *0* |
| *Référence : médiane passée de la culture* | *245,7* | *228,3* | *0,00* |
| *Modèle en service `m3-v1`* | *240,3* | *227,1* | *0,00 (−0,05 à +0,07)* |
| **Linéaire régularisé** (retenu parmi les 6) | **244,1** | 247,7 | −0,09 (−0,17 à 0,00) |
| k plus proches voisins | 251,3 | 243,0 | −0,07 (−0,13 à +0,01) |
| Forêt aléatoire | 257,5 | 239,0 | −0,05 (−0,11 à +0,02) |
| Gradient boosting | 255,1 | 240,8 | −0,06 (−0,13 à +0,02) |
| XGBoost | 257,6 | 239,2 | −0,05 (−0,12 à +0,03) |
| Réseau de neurones | 254,0 | 250,2 | −0,10 (−0,21 à +0,01) |

MAE en kg/ha.

- **Aucune des 6 familles ne bat la tendance**, ni en validation ni sur le test. Toutes font 5 à 10 % moins bien sur le test.
- Le linéaire est le meilleur des 6 en validation, et le seul retenu : les cinq autres sont nettement derrière lui.
- `m3-v1` fait jeu égal avec la tendance (+0,4 %). Sa mécanique par seuils résiste mieux aux rendements extrêmes qu'une régression directe.
- **Conclusion : le rendement affiché reste la tendance et sa fourchette habituelle**, comme le prévoit déjà le drapeau `rendement_fiable`.

### Chute de la récolte (rendement < 80 % de la tendance)

| Modèle | Brier skill score validation | Brier skill score test | AUC test |
|---|---|---|---|
| *Référence : fréquence passée des chutes de la culture* | *0* | *0* | *0,52* |
| *Modèle en service `m3-v1`* | *+0,07 (+0,03 à +0,11)* | *−0,01 (−0,09 à +0,08)* | *0,52* |
| **Linéaire régularisé** (retenu) | **+0,08** (+0,05 à +0,12) | −0,05 (−0,19 à +0,09) | 0,51 |
| k plus proches voisins | +0,04 | −0,02 (−0,07 à +0,04) | 0,53 |
| Forêt aléatoire | +0,03 | +0,02 (−0,04 à +0,08) | 0,56 |
| Gradient boosting | +0,04 | 0,00 (−0,06 à +0,07) | 0,54 |
| XGBoost | +0,04 | +0,01 (−0,06 à +0,07) | 0,55 |
| Réseau de neurones | +0,06 | −0,04 (−0,13 à +0,07) | 0,51 |

Test, moment par moment (Brier skill score) :

| Modèle | Fin mai | Fin juin | Fin juillet | Fin août |
|---|---|---|---|---|
| `m3-v1` (en service) | −0,01 | −0,04 | 0,00 | +0,03 |
| Linéaire régularisé | −0,05 | −0,10 | −0,05 | −0,02 |
| Forêt aléatoire | +0,01 | −0,02 | +0,03 | +0,04 |
| XGBoost | +0,01 | −0,03 | +0,01 | +0,03 |

- **En validation, le linéaire est devant et son gain est prouvé** (+0,08). Le réseau de neurones et les plus proches voisins ne s'en distinguent pas ; la forêt, le gradient boosting et XGBoost sont nettement derrière.
- **Sur le test, aucun gain n'est prouvé, pour aucune famille** : tous les intervalles contiennent 0.
- Les modèles à arbres font un peu mieux sur le test (+0,01 à +0,02, AUC 0,55) alors qu'ils étaient derrière en validation. L'écart est dans le bruit de 7 années de test : **le prendre pour argument reviendrait à choisir le modèle sur le test**.
- Le réglage choisi pour le linéaire (pénalité 1) est moins prudent que celui de `m3-v1` (pénalité 100), et `m3-v1` tient mieux sur le test. **On garde `m3-v1` tel quel.**
- Conclusion inchangée par rapport à la fiche du modèle 3 : l'alerte ne se présente comme une prévision que là où `alerte_fiable` est vrai.

## 5. Partie 3 — AgroDistrib

AgroDistrib propose une répartition : il n'y a ni « bonne réponse » observée, ni donnée de réponse aux engrais. **Ce n'est donc pas une validation au sens des parties 1 et 2**, mais une comparaison de 6 méthodes au prorata du besoin, sur des critères vérifiables.

Cas du README : **20 000 t de NPK 15-15-15 pour le mil**, 41 départements, besoin de 120 318 t (16,6 % du besoin couvert).

| Méthode | Départements servis | Couverture min – max | Inégalité (Gini) | Ciblage vulnérabilité | Valeur indicative | Stock déplacé si scores ± 10 % |
|---|---|---|---|---|---|---|
| *Référence : prorata du besoin* | *41* | *16,6 – 16,6 %* | *0,00* | *0* | *0* | *0 %* |
| Parts égales plafonnées | 41 | 5,3 – 100 % | 0,45 | −3,1 % | +14,8 % | 0 % |
| Prorata pondéré par la vulnérabilité | 41 | 9,5 – 24,6 % | 0,12 | +4,5 % | −4,2 % | 1,2 % |
| Prorata pondéré par la valeur indicative | 41 | 12,4 – 26,1 % | 0,11 | −3,1 % | +6,4 % | 1,0 % |
| **Prorata multicritère** (retenu) | **41** | **12,7 – 21,6 %** | **0,06** | **+1,0 %** | **+0,6 %** | **0,8 %** |
| Priorité stricte (glouton) | 17 | 0 – 100 % | 0,59 | −6,8 % | +60,9 % | 24,9 % |
| Optimisation linéaire bornée | 41 | 8,3 – 49,9 % | 0,39 | −2,0 % | +26,4 % | 11,9 % |

« Ciblage vulnérabilité » et « valeur indicative » : écart au prorata de la vulnérabilité moyenne, et de la valeur indicative moyenne, d'une tonne répartie. Toutes les méthodes répartissent exactement 20 000 t et ne dépassent jamais le besoin.

- **Vulnérabilité et valeur indicative tirent en sens inverse** (corrélation de rang −0,56) : les zones les plus vulnérables (Vallée du fleuve, Ferlo, Bassin arachidier) sont aussi celles où la saison permet le moins de valoriser l'engrais. Aucune méthode ne gagne sur les deux à la fois ; il faut un arbitrage, et il revient au décideur.
- **La priorité stricte est à écarter** : 24 départements ne reçoivent rien, dont tout le Bassin arachidier (78 % du besoin), et un quart du stock change de destination quand les scores bougent de 10 %. Or ces scores sont relatifs et indicatifs.
- **L'optimisation linéaire** gagne 26 % de valeur indicative, mais elle sert chaque département soit au plancher, soit au plafond : le résultat dépend entièrement de bornes fixées à la main, et 12 % du stock se déplace quand les scores bougent.
- **Le prorata multicritère est retenu** : c'est la seule méthode à ne faire moins bien que le prorata ni sur le ciblage ni sur la valeur indicative, avec tous les départements servis et une répartition stable. Son paramètre α est exactement l'arbitrage rendement / équité prévu pour le décideur : α = 0 donne le prorata pondéré par la vulnérabilité, α = 1 le prorata pondéré par la valeur indicative.
- Son gain à α = 0,5 est faible (+1 % et +0,6 %) : au milieu, les deux critères se compensent. **L'intérêt de la méthode est de laisser le décideur déplacer α en voyant ce qu'il gagne et ce qu'il perd**, pas de proposer un optimum.

Limites : un seul cas testé (seul le mil a une dose dans toutes les zones) ; la « valeur indicative » repose sur un potentiel de gain de zone, non additif, qui ne distingue pas les départements d'une même zone ; la répartition est calculée par département, les niveaux zone et région s'obtenant par somme.

## 6. Ce qu'il faut retenir pour l'application

| Bouton | Moteur | Changement |
|---|---|---|
| La saison qui vient | `m1-v1`, linéaire régularisé | Aucun |
| Quelle culture, Alerte récolte | `m3-v1`, logistiques par seuils | Aucun ; les drapeaux `rendement_fiable` et `alerte_fiable` restent la règle d'affichage |
| Répartir un stock | Prorata multicritère, α réglé par le décideur | À construire quand `SALTIS.APP` existera |

Les sorties servies par l'API (`ml/sorties/prevision_*.csv`, `risque_semis.csv`, `evaluation_m*.csv`) n'ont pas été recalculées ni modifiées.

## 7. Limites de cette comparaison

- **Peu d'années.** 15 années de validation et 10 de test pour la pluie, 8 et 7 pour le rendement. La plupart des écarts entre familles sont plus petits que leur incertitude.
- **Grilles courtes.** Chaque famille a 3 ou 4 réglages. Une recherche plus large aurait surtout augmenté le risque de choisir un réglage par chance.
- **Variables.** Pour la pluie, l'AMO (série arrêtée en 2022) et l'humidité du sol (absente pour 6 départements côtiers) sont écartées pour toutes les familles. Pour le rendement, les familles reçoivent les variables du modèle 3, sans variable nouvelle.
- **Le rendement s'arrête en 2015** (rupture superficie récoltée / semée) : rien ne peut être vérifié après.
- **Modèle 4 (date de semis)** : absent de `ml/README.md`, non comparé.

## 8. Points à trancher

1. **Modèles 2 et 4**, hors `ml/README.md` : **tranché le 16/11/2026**. Le modèle 2 (années semblables) est retiré de `ml/`, du chargement Snowflake et de l'API. Le modèle 4 (date de semis) est gardé comme complément : il sert « Quand semer », « Ma parcelle », « Surface » et l'assistant vocal. Reste à l'ajouter à `ml/README.md`.
2. **Modèle 1** : garder ONI + TSA (`m1-v1`), ou passer à ONI + TNA + TSA ? Recommandation : garder `m1-v1`, l'écart est dans le bruit et le TNA 2026 n'est pas dans `ml/entrees/`.
3. **AgroDistrib** : valider le prorata multicritère comme moteur par défaut, la valeur de α proposée au départ (0,5) et la définition de la « valeur indicative ». Faut-il aussi proposer l'optimisation linéaire comme scénario « rendement d'abord », avec ses bornes affichées ?
4. **Cible du rendement** : `ml/README.md` nomme `anomalie_rendement_pct` ; le modèle 3 et cette comparaison utilisent le rapport à la moyenne des 10 campagnes précédentes, parce que la tendance de la source utilise les années futures. À écrire dans le README si l'équipe confirme.
