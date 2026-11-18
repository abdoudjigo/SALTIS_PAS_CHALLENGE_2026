# Modèle 3 — Rendement prévu et alerte récolte

**Boutons dans l'application : « Quelle culture »** (agriculteur) et **« Alerte récolte »** (ONG).

## La question
- Agriculteur : dans mon département, cette campagne, combien puis-je attendre de chaque culture — en année difficile, en année moyenne, en bonne année ?
- ONG : dans quels départements la récolte risque-t-elle de **chuter**, c'est-à-dire de tomber sous 80 % de son niveau habituel ?

La réponse est mise à jour à quatre moments : fin mai, fin juin, fin juillet, fin août (mêmes décades que le modèle 2 : 18, 21, 24).

## Ce que le modèle regarde
Cinq cultures pluviales assez observées : arachide, mil, sorgho, niébé, maïs.

| Moment | Ce qui est connu et utilisé |
|---|---|
| Fin mai | La culture ; le département (latitude, pluie normale) ; son **rendement habituel** et l'irrégularité de ses rendements passés ; les probabilités « saison sèche » et « saison humide » du **modèle 1** |
| Fin juin, fin juillet, fin août | Idem, plus la pluie tombée jusque-là : cumul depuis juin comparé à la normale, nombre de décades sèches depuis juin, jour de démarrage de la saison |

**Le rendement habituel (la « tendance »)** d'une campagne est la moyenne des rendements observés des 10 campagnes précédentes du même département et de la même culture (au moins 5 observées). Il n'utilise que le passé : on peut donc le calculer en conditions réelles. La tendance fournie par la source (`tendance_rendement_kg_ha`) n'est pas utilisée, car elle est ajustée sur toute la série, années futures comprises.

**Aucune information du futur** :
- le démarrage de la saison n'est utilisé que s'il a déjà eu lieu ; sinon, le modèle sait seulement « pas encore démarrée » ;
- les probabilités du modèle 1 sont recalculées, pour chaque année jusqu'en 2015, avec les seules années antérieures (le fichier `prevision_saison.csv` n'est pas repris tel quel : sa validation « une année de côté » voit des années postérieures) ;
- aucune variable de fin de saison (pluie totale, séquences sèches de la saison, NDVI, satisfaction en eau).

Le script le vérifie à chaque lancement (`verifier_absence_de_fuite`) et s'arrête sinon.

## Comment il apprend
- Données : `FACT_RENDEMENT_DEPARTEMENT` (lignes avec `rendement_kg_ha` renseigné), `FACT_PLUVIOMETRIE_DECADAIRE`, `FACT_SAISON_DEPARTEMENT`, `MART_ML_PREVISION_PLUIE`.
- Cible : le rapport rendement / tendance, **de 1991 à 2015 seulement** (à partir de 2016, les superficies sont semées et non plus récoltées : les rendements ne sont plus comparables). 3 796 observations.
- Méthode : une seule mécanique pour les deux boutons. Pour 12 seuils (25 % à 260 % de la tendance), une régression logistique fortement régularisée donne la probabilité que le rendement passe sous le seuil. On obtient ainsi toute la distribution prévue :
  - la **fourchette** = ses centiles 10, 50 et 90 ;
  - l'**alerte** = la probabilité de passer sous le seuil de 80 %.
- Les années ne sont jamais mélangées : chaque année de 2001 à 2015 est prévue par un modèle entraîné sur les années d'avant (depuis 1991). **2001-2008 = validation** (sert à choisir les réglages), **2009-2015 = test** (jamais regardé pour choisir).

## Est-ce qu'il marche ?
**Peu, et il faut le dire.** Référence : « rendement = tendance » et « probabilité de chute = fréquence passée des chutes de la culture ».

Toutes cultures confondues :

| Moment | Erreur sur le rendement (MAE, kg/ha) : modèle / tendance | Fourchette contient l'observé (but 80 %) | Alerte : gain sur la référence (Brier skill score) | Alerte : AUC | AUC à l'intérieur d'une année |
|---|---|---|---|---|---|
| | validation · test | validation · test | validation · test | validation · test | validation · test |
| Fin mai | 245 / 242 · 230 / 228 | 77 % · 81 % | +0,04 · **−0,01** | 0,62 · 0,48 | 0,66 · 0,66 |
| Fin juin | 243 / 242 · 232 / 228 | 77 % · 80 % | +0,06 · **−0,04** | 0,65 · 0,49 | 0,66 · 0,67 |
| Fin juillet | 238 / 242 · 226 / 228 | 77 % · 81 % | +0,07 · **0,00** | 0,69 · 0,56 | 0,66 · 0,65 |
| Fin août | 237 / 242 · 222 / 228 | 77 % · 82 % | +0,09 · **+0,03** | 0,71 · 0,56 | 0,67 · 0,65 |

Brier skill score : 0 = pas mieux que la référence, 1 = parfait, négatif = moins bien. AUC : 0,5 = hasard.

Alerte par culture (Brier skill score, validation · test) :

| Culture | Fin mai | Fin juin | Fin juillet | Fin août |
|---|---|---|---|---|
| Arachide | +0,02 · +0,05 | +0,05 · +0,03 | **+0,05 · +0,06** | **+0,07 · +0,10** |
| Mil | +0,04 · −0,04 | +0,06 · −0,06 | +0,08 · 0,00 | +0,10 · +0,02 |
| Sorgho | +0,06 · −0,01 | +0,07 · −0,05 | +0,09 · −0,04 | +0,10 · 0,00 |
| Niébé | +0,06 · +0,02 | +0,07 · −0,03 | +0,10 · −0,03 | +0,12 · −0,01 |
| Maïs | +0,03 · −0,07 | +0,04 · −0,08 | +0,05 · −0,02 | +0,06 · +0,01 |

**Ce qu'il faut dire honnêtement** :
- **le gain vu en validation n'est pas confirmé sur le test**, sauf pour l'arachide à partir de fin juillet et, faiblement, toutes cultures confondues fin août. Avant fin juillet, l'alerte ne fait pas mieux que la fréquence passée ;
- **le rendement prévu ne bat presque pas la tendance** : 2 à 3 % d'erreur en moins fin août, rien avant fin juillet. La fourchette est bien calibrée (77 à 82 % des observations dedans), mais elle n'est pas plus étroite que celle de la référence : elle décrit surtout l'irrégularité habituelle des rendements ;
- **ce qui tient** : à l'intérieur d'une même année, le modèle classe correctement les départements et cultures les plus à risque (AUC ≈ 0,66, stable entre validation et test, dès fin mai). Ce classement vient des caractéristiques du département et de la culture (niveau et irrégularité des rendements passés), pas de la pluie de l'année. En revanche, le modèle ne sait pas dire si l'année sera bonne ou mauvaise pour tout le pays : sur 2009-2015, il a jugé 2011 peu risquée (46 % de chutes observées) et 2012 risquée (7 %) ;
- **pourquoi** : les rendements départementaux sont très bruités (écart médian à la tendance d'environ 25 %, une chute dans 3 cas sur 10 en moyenne) et même la pluie totale de la saison, connue seulement en octobre, n'explique qu'une petite part de leurs variations (corrélation de rang 0,19 sur 1991-2008). Aucun modèle de pluie ne peut faire beaucoup mieux avec ces données.

**Drapeaux dans la sortie** : `alerte_fiable` et `rendement_fiable`, par moment × culture, ne sont vrais que si le gain est présent en validation **et** confirmé en test (alerte : Brier skill score > 0,02 et AUC ≥ 0,55 ; rendement : erreur réduite de plus de 2 % par rapport à la tendance). Aujourd'hui : alerte fiable pour l'**arachide fin juillet et fin août** ; rendement fiable pour le sorgho fin août seulement (gain de 2 à 4 %, à prendre avec prudence). Partout ailleurs, l'application doit présenter la sortie comme la fourchette habituelle, pas comme une prévision de l'année.

## Ce qui a été testé et écarté
Tout a été choisi sur la validation 2001-2008, sans regarder le test. Le test a été regardé une seule fois, avec les réglages figés ; il n'a servi qu'à fixer les drapeaux « fiable ».

| Essai | Résultat en validation | Décision |
|---|---|---|
| Tendance : moyenne des 5, 8, 10, 15 dernières années ou de tout le passé ; médiane ; droite ajustée sur 15 ans | La moyenne sur 10 ans a la plus faible erreur (RMSE 367 kg/ha ; droite : 416) | Moyenne sur 10 ans |
| XGBoost (arbres peu profonds) | Colle aux années d'entraînement : AUC 0,50 à 0,58, erreur supérieure à la tendance | Écarté |
| Régression ridge sur le logarithme du rapport, puis distribution des erreurs passées | Alerte presque sans gain (Brier skill score ≤ +0,03) : quelques rendements extrêmes dominent | Écarté au profit des seuils |
| Rendement de l'année précédente | Dégrade l'alerte | Écarté (et n'est pas toujours publié à temps) |
| Indices océaniques bruts à la place des probabilités du modèle 1 | Équivalent | Modèle 1 gardé, pour le lien avec « La saison qui vient » |
| Effet de la pluie différent selon la latitude ; cumul écrêté ; pluie des 3 dernières décades | N'améliorent rien | Écartés |
| Plus longue séquence sèche jusque-là | La table décadaire ne donne que la plus longue séquence à l'intérieur de chaque décade (10 jours au plus, presque toujours atteinte) : inutilisable | Remplacée par le nombre de décades sèches |
| Référence : fréquence des chutes par département × culture | Moins bonne que la fréquence par culture (Brier 0,212 contre 0,211) | Référence par culture, la plus exigeante |

**Piège à connaître** : beaucoup de variantes ont été essayées sur seulement 8 années de validation. Le score de validation de la variante retenue est donc optimiste ; c'est ce que montre le test.

## Ce qu'il produit
`ml/sorties/prevision_rendement.csv`, une ligne par département × culture × campagne × moment (14 036 lignes, 43 départements, 5 cultures) :

| Colonne | Contenu |
|---|---|
| `code_departement`, `departement`, `zone_agroecologique`, `culture`, `annee` | Le territoire, la culture, la campagne |
| `moment_prevision` | `FIN_MAI`, `FIN_JUIN`, `FIN_JUILLET`, `FIN_AOUT` |
| `type_prevision` | `RETROSPECTIVE_VALIDATION` (2001-2008), `RETROSPECTIVE_TEST` (2009-2015), `PROJECTION_NON_EVALUEE` (2022-2035) |
| `tendance_kg_ha` | Rendement habituel (moyenne des 10 campagnes précédentes) |
| `rendement_bas_kg_ha`, `rendement_median_kg_ha`, `rendement_haut_kg_ha` | Année difficile (1 sur 10), médiane, bonne année (1 sur 10) |
| `proba_chute_pct` | Probabilité que le rendement passe sous 80 % de la tendance |
| `proba_chute_reference_pct` | Fréquence passée des chutes pour cette culture (la référence) |
| `explication` | Les variables (3 au plus) qui poussent le plus la probabilité de chute, avec leur sens |
| `rendement_fiable`, `alerte_fiable` | Le modèle bat-il la référence pour ce moment × cette culture (validation et test) ? |
| `rendement_observe_kg_ha`, `chute_observee` | Pour comparer ; **vides** quand le rendement n'est pas observé |
| `version_modele`, `date_calcul` | Traçabilité |

Exemple d'explication : « rendement habituel récent de 3697 kg/ha (risque en hausse) ; 3 décade(s) sèche(s) depuis juin (risque en hausse) ; prévision de saison : 14 % de chances d'une saison humide (risque en hausse) ».

Plus `ml/sorties/evaluation_m3.csv` : 48 lignes, période × moment × culture (et `TOUTES`), modèle et référence côte à côte.

**Campagnes absentes ou particulières** :
- 1991-2000 : servent seulement à l'apprentissage ;
- 2016-2021 : pas de prévision, car la tendance mélangerait superficies récoltées et semées ;
- 2022-2025 : pas de rendement observé. Le modèle appris sur 1991-2015 est appliqué à une tendance calculée sur 2016-2021 (superficies semées). Ces lignes ne peuvent pas être vérifiées ;
- 2026 à 2035 (campagnes à venir) : mêmes projections, **à fin mai seulement** (aucune pluie observée), 190 lignes par année. La tendance est celle des dernières campagnes observées (2016-2021), la même pour les dix années ;
- pour ces années, les probabilités de saison sont **reprises de `prevision_saison.csv`** (modèle 1, par département : prévision océan pour 2026, prévision de tendance pour 2027-2035), pour rester cohérent avec « La saison qui vient ». L'`explication` le dit : « prévision de saison 2027 (tendance) : 15 % de chances d'une saison sèche ». Lancer le modèle 1 avant le modèle 3 ;
- Guédiawaye et Pikine : aucun rendement, donc aucune ligne.

## Dans l'application
- **« Quelle culture »** (agriculteur) : pour le département, une barre par culture allant de l'année difficile à la bonne année, avec la médiane. Libellé : « fourchette habituelle dans votre département », sauf quand `rendement_fiable` est vrai. Ne pas comparer les cultures en kg/ha seulement : les prix diffèrent.
- **« Alerte récolte »** (ONG) : carte des départements colorés par `proba_chute_pct`, à lire comme un **classement** (où le risque est le plus fort cette année), mis à jour à chaque moment. Afficher la probabilité comme prévision de l'année seulement quand `alerte_fiable` est vrai (arachide, à partir de fin juillet) ; sinon, écrire « risque habituel du département ».
- **Fenêtre** : la phrase `explication`, puis « Fiabilité : faible avant fin juillet ».
- **Méthode**, repliée : le tableau de fiabilité ci-dessus, sans l'embellir.

## Relancer
```bash
venv/bin/python -m ml.m3_rendement.entrainer
```
Environ 30 secondes. Les tables sont lues dans `ml/donnees/`, ou dans Snowflake la première fois.
