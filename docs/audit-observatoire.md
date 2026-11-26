# Audit Observatoire Sénégal 2050 (phase 0)

Lecture seule, 26/11/2026. Aucune écriture dans Snowflake, dbt, ml, api ni app.
Sources officielles : SSA 2025-2034 (87 p.) et LPSAE 2025-2029 (55 p.), sur vie-publique.sn. Dans les deux PDF, la page du fichier est la page imprimée (« Page | n »).

## 1. Branche et déploiement

- `dev/front-djigo` = `origin/main` = `e195be8` (22/11/2026 20:09 UTC), dépôt propre.
- Le VPS se met à jour par `git pull` puis `docker compose … up -d --build` (`deploy/README.md`, partie 4). **Impossible de savoir d'ici quel commit tourne sur le VPS.** Il faut le vérifier sur le serveur (`git -C <dépôt> log -1`).

## 2. Couverture des données

Source unique : `RAW.C_RENDEMENTS_DEPARTEMENT` → `stg_rendements` → `MARTS.FACT_RENDEMENT_DEPARTEMENT` (22 905 lignes, grille 1981-2024 × 45 départements × 12 cultures, mesures NULL quand rien n'est observé).
Origine : HarvestStat (DAPSA) 1981-2015, FEWS NET (DAPSA/ANSD) 2016-2021.
**Aucune route de l'API ne sert ce fait aujourd'hui** : l'API ne sert que des dérivés (vulnérabilité, AgroDistrib, choix des cultures).

### Matrice (production / surface / rendement au niveau département)

| Culture | Années observées | Départements par an (max 45) | Région, pays (somme) | Rendement national FAOSTAT |
|---|---|---|---|---|
| Arachide | 1981-2021 | 6 à 42 (souvent 36-42) | calculable, souvent incomplet | 1981-2024 |
| Mil (souna) | 1981-2021 | 9 à 42 | idem | 1981-2024 |
| Sorgho | 1982-2021 | 7 à 42 | idem | 1981-2024 |
| Niébé | 1981-2021 | 10 à 41 | idem | 1981-2024 |
| Maïs | 1981-2021 | 6 à 41 | idem | 1981-2024 |
| Riz (libellé « irrigué ») | 1981-2021 | 9 à 35 | idem | 1981-2024 |
| Manioc | 1996, 2002-2021 | 2 à 40 | idem | 1981-2024 |
| Sésame | 1996, 2003-2016 | 3 à 22 | trop partiel | 1994-2024 |
| Coton, pastèque, tomate | 2016 seulement | 3 à 30 | non | 1981-2024 (pastèque 1987) |
| Oignon | jamais | 0 | non | 1981-2024 |
| Fonio, patate douce, pomme de terre… | absentes | - | non | absentes |

Trous et pièges :
- **2022-2025 : aucune donnée départementale** (production, surface, rendement). Seul le rendement national FAOSTAT existe pour 2022-2024. Il n'y a **pas de production ni de surface nationale FAOSTAT** dans nos tables.
- 1982-1985 : très peu de départements (6 à 17). 2000-2004 : couverture réduite (15 à 28).
- Guédiawaye et Pikine ne sont jamais observés. Au maximum 42 départements par culture, et 35 pour le riz. Avec la règle « incomplet si un département manque », **tous les totaux nationaux seraient incomplets**. Il faut une liste des départements attendus par culture (voir 6 d).
- **Rupture 2016** : superficie récoltée jusqu'en 2015, superficie **semée** ensuite (`type_superficie`). Le rendement 2016+ est donc sous-estimé par rapport à la série d'avant. En 2016, la couverture est aussi plus faible (32-35 départements).
- **Riz 2021 suspect** : 287 135 t sur 117 482 ha (35 départements), contre 1 148 863 t en 2020. La SSA (tableau 1) donne environ 1,33 Mt. La saison irriguée manque probablement.
- Contrôles : 14 lignes ont une production sans surface, 58 une surface sans production, 132 une production et une surface sans rendement, et 52 lignes ont un rendement fourni qui s'écarte de plus de 5 kg/ha de production/surface. Pour l'Observatoire, il faut recalculer le rendement (`sum(production)*1000/sum(surface)`).

## 3. Chiffres officiels vérifiés

### LPSAE, annexe 3 (cadre de performance)

| Valeur demandée | Verdict | Page réelle |
|---|---|---|
| Couverture céréales 48 % → 78 % en 2029 | **Confirmée.** La liste est « riz, mil, **fonio**, sorgho, maïs » (pas de sésame) | p.50 |
| Couverture riz 41 % → 64 % | Confirmée | p.50 |
| Semences certifiées arachide/niébé : cible 100 % | Confirmée (référence vide) | p.49 |
| Semences certifiées céréales (riz, mil, sorgho, sésame, maïs) : 100 % | Confirmée (le document range le sésame parmi les céréales) | p.49 |
| « Système agropastoral de suivi-évaluation fonctionnel » | **Corrigé** : « Système de suivi évaluation du secteur agropastoral fonctionnel », Non → Oui | p.51 |
| (autres) Semences horticoles 25 % ; superficies aménagées 150 101 → 200 433 ha/an ; viande 93 → 96 % ; lait 34 → 40 % | relevés | p.49-50 |

### SSA, objectifs et passages

| Valeur | Verdict | Page réelle |
|---|---|---|
| 320 000 ha irrigués avant 2029 | Confirmée | **p.52** (pas p.53) |
| 130 000 ha déjà aménagés (potentiel 350 000 ha) | Confirmée | p.16 |
| Pertes post-production < 20 % (moyenne africaine « près de 60 % ») | Confirmée | **p.57** |
| 240 000 producteurs climato-intelligents, dont 40 % de femmes, d'ici 2029 | Confirmée | **p.59** |
| Géoréférencement de toutes les parcelles d'ici 2029 | Confirmée | **p.53** |
| ~70 % des besoins importés | Confirmée. **Contradiction** : p.7 dit « 70 % sur les dix premiers biens, 1 070 Mds FCFA » sans année ; p.35 dit « 1 070 Mds FCFA en 2022, 70 % des besoins » ; p.15 et p.35 donnent 979,14 Mds FCFA en 2023 | **p.7, p.35** (pas p.15) |
| Mi-parcours 2027, évaluation finale fin 2029 | Confirmée | **p.76** |
| Plateforme intégrée de suivi-évaluation (MASAE) | Confirmée | **p.76** |
| Diagnostic (FFOM) | Confirmé | p.39-40, p.43 |
| « Insuffisances relatives aux statistiques » | p.40 ; promotion de « statistiques agropastorales de qualité » | **p.61** (pas p.62) |
| « Informations climatiques de qualité » (tableau des risques) | Confirmée | **p.80** (pas p.81) |

Autres contradictions internes à la SSA : terres arables 3,4 Mha (p.16) contre 3,8 Mha (p.53) ; première phase 2024-2029 (p.8) contre 2025-2029 (p.64).

### Productions 2019 / 2023 (tonnes)

| Culture | Texte LPSAE p.20-21 (SSA p.21-25 pour 2023) | SSA tableau 1, p.26 | Verdict |
|---|---|---|---|
| Céréales | 2 768 798 / 4 015 165 | - | Confirmé. 2019 = somme de la colonne « 2020 » du tableau 1 (fonio compris) |
| Riz paddy | 1 155 730 / 1 525 464 | « Riz (Eq blanchi) » : 1 155 730 en « 2020 », 1 409 120 en « 2023 » | Confirmé. **Libellé faux dans le tableau 1** : ce sont des tonnes de paddy, pas de riz blanchi |
| Maïs | **50 705** / 855 033 | 530 705 en « 2020 », 787 750 en « 2023 » | **Coquille dans la LPSAE p.20 : lire 530 705.** C'est la seule valeur qui redonne le total céréales, et la DAPSA 2019 donne 530 857 |
| Sorgho | 270 168 / 364 577 | 270 168 en « 2020 », 363 164 en « 2023 » | Confirmé |
| Mil 2023 | 1 260 709 (LPSAE p.20, SSA p.21) | 1 097 033 | Contradiction réelle, à afficher (voir le décalage d'année ci-dessous) |
| Arachide 2023 | 1 675 329 (LPSAE p.21, SSA p.24) | 1 677 804 | Contradiction ; 1 677 804 est aussi la valeur du tableau pour « 2022 » (recopiée) |
| Niébé | 184 137 / 221 798 | 184 137 en « 2020 », 239 194 en « 2023 » | Confirmé (texte) ; tableau « 2023 » = « 2022 » recopié |
| Manioc | 1 030 592 / 1 388 741 | 1 328 889 en « 2023 » = « 2022 » | Confirmé (texte) ; tableau recopié |
| Sésame | 24 304 / 60 036 | 37 586 en « 2023 » = « 2022 » | Confirmé (texte) ; tableau recopié |
| Légumes | 1 229 225 / 1 274 750 | - | Confirmé (LPSAE p.20, SSA p.21) |

**Décalage d'année dans le tableau 1 de la SSA.** Ses colonnes « 2019 », « 2020 », « 2021 », « 2022 » égalent nos campagnes DAPSA **2018, 2019, 2020, 2021** (mil 897 571 / 807 045 / 1 144 853 / 1 039 861 chez nous, contre 897 574 / 807 044 / 1 144 855 / 1 039 860 dans le tableau). Le texte, lui, désigne la campagne 2019/20 par « 2019 ». Le tableau semble donc nommer chaque campagne par son année de fin, et sa colonne « 2023 » recopie 2022 pour 4 cultures. Il faut afficher les deux valeurs en le disant, sans choisir en silence.

### SSA tableau 8 (p.52), rendements

Colonnes (positions vérifiées dans le PDF) : **Rendement moyen Sénégal | Moyenne africaine | Moyenne mondiale**.

| Culture | Sénégal | Moyenne africaine | Moyenne mondiale |
|---|---|---|---|
| Mil | 1 253 kg/ha | 1,9 t/ha | non disponible |
| Sorgho | 1 319 kg/ha | « 1,9,t /Ha » | non disponible |
| Maïs | 3 074 kg/ha | 4 964 kg/ha | « 5,2 Kg/ ha » (unité fausse, sans doute t/ha) |
| Arachide | 1 336 kg/ha | 2000 kg/ha | non disponible |

- La colonne Sénégal correspond **exactement au rendement national FAOSTAT 2023** de nos tables (1 253,3 ; 1 319,0 ; 3 074,0 ; 1 336,5). Ce sont donc des chiffres FAOSTAT 2023, bien que le tableau ne cite ni source ni année.
- Les moyennes africaines n'ont **ni source ni année**. Elles paraissent élevées (un maïs africain à 4 964 kg/ha dépasse le maïs sénégalais). Il faut les afficher comme « valeur citée par la SSA, non vérifiée », ou les contrôler dans FAOSTAT avant de les afficher.

## 4. Nos séries comparées aux points officiels

Somme des départements (DAPSA), campagne 2019, comparée au texte de la LPSAE pour « 2019 » :

| Culture | Notre somme | Officiel | Écart |
|---|---|---|---|
| Riz paddy | 1 155 730 | 1 155 730 | 0 % |
| Sorgho | 270 168 | 270 168 | 0 % |
| Niébé | 184 139 | 184 137 | < 0,01 % |
| Manioc | 1 030 594 | 1 030 592 | < 0,01 % |
| Maïs | 530 857 | 50 705 (coquille) ; 530 705 au tableau 1 | +0,03 % contre 530 705 |
| Mil | 807 045 | 807 044 (tableau 1, « 2020 ») | < 0,01 % |
| Arachide | 1 421 289 | 1 421 288 (tableau 1, « 2020 ») | < 0,01 % |
| Céréales (4 cultures) | 2 763 800 | 2 768 798 | −0,18 % (le fonio manque chez nous : 5 151 t au tableau 1) |
| Sésame | non disponible | 24 304 | - |

- **2019 : nos sommes reproduisent les chiffres officiels**, malgré 40-42 départements sur 45. Les départements manquants ne produisent rien ou presque.
- **2023 : comparaison impossible en production** (aucune donnée après 2021). En rendement, FAOSTAT 2023 = SSA tableau 8 (écart 0 %).
- 2021 : comparaison avec le tableau 1 (« 2022 ») : arachide 1 677 802 contre 1 677 804, manioc identique, mil 1 039 861 contre 1 039 860. **Riz : 287 135 contre 1 326 761 (−78 %)**, une donnée incomplète chez nous.
- Les écarts viennent surtout du **libellé de l'année de campagne** (décalé d'un an dans le tableau 1), pas de la couverture. Le libellé « Eq blanchi » est faux (paddy en réalité). La rupture récoltée → semée change le sens du rendement à partir de 2016. Le rendement DAPSA recalculé et celui de FAOSTAT divergent aussi certaines années (exemple niébé 2015 : 638 contre 405 kg/ha). Il faut donc les afficher comme deux séries distinctes, jamais fusionnées.

## 5. Prévisions existantes

- Modèle 3 (`ml/m3_rendement`, `SALTIS.ML.PREVISION_RENDEMENT`, routes `/previsions/rendement/{dep}/{annee}` et `/previsions/alerte-recolte/{annee}`) : **rendement seulement** (bas / médian / haut en kg/ha, probabilité de chute), **aucune prévision de production ni de surface**.
- 5 cultures pluviales : arachide (42 départements), mil (42), sorgho (42), niébé (41), maïs (39). Pas de riz, ni de manioc, ni de sésame.
- Niveau département. Années : rétrospective 2001-2015, projection `PROJECTION_NON_EVALUEE` 2022-2035 (4 moments, fin mai à fin août).
- Fiabilité : `rendement_fiable` est faux partout sauf pour une partie du sorgho (22 % des lignes). Le modèle ne bat pas la tendance (`ml/MODELES.md`). Toute courbe « prévue » doit donc être étiquetée comme projection non évaluée et tracée en pointillé.
- Le modèle 1 (pluie) et le modèle 4 (semis) ne donnent ni production ni rendement.

## 6. Décisions à prendre

**(a) Objectifs officiels : seed dbt `ref_objectifs_souverainete.csv` ou JSON servi par l'API.**
Je recommande le **seed dbt** : il est versionné, testable (`not_null`, `accepted_values`), et chaque ligne porte sa source (document, page, valeur de référence, cible, année). C'est le seul moyen de garder les contradictions côte à côte (une ligne par document). L'API le lit comme un mart.

**(b) Carte : SVG léger ou Mapbox.**
`departements.geojson` : 45 entités (GADM 4.1, `GID_2`, `NAME_2`), 10 099 points, 196 Ko (51 Ko compressé). Après simplification à environ 2 000 points, le SVG pèserait environ 25-35 Ko (10-15 Ko compressé). C'est une estimation, à mesurer. Mapbox est déjà une dépendance, mais il demande un jeton public et pèse lourd sur une page publique. Je recommande le **SVG** : il est rapide, s'imprime tel quel dans le PDF et rend la navigation au clavier plus simple.

**(c) Routes `/observatoire/*`, précalculées dans `api/cache/construction.py`.**
Proposition : `/observatoire/referentiel` (cultures, années, zones, avec la couverture de chacune), `/observatoire/series/{culture}?niveau=pays|region|departement&code=` (1981-2021, plus le rendement FAOSTAT 2022-2024), `/observatoire/carte/{culture}/{annee}`, `/observatoire/objectifs`. Toutes sont précalculables (environ 12 cultures × 44 ans × 60 zones). Les agrégats sont des sommes, avec un drapeau `complet` et le nombre de départements. Il faut ajouter une `DefinitionMart` pour `FACT_RENDEMENT_DEPARTEMENT` (non servi aujourd'hui).

**(d) Ce qui demande une nouvelle table ou un nouveau seed (accord requis).**
1. Le seed des objectifs et des chiffres officiels (point a).
2. Un seed des départements attendus par culture : sans lui, tout total serait « incomplet ».
3. Un mart `mart_observatoire_series`, ou un calcul dans le cache. Ce mart serait nouveau, sans modifier `fact_rendement_departement`.
4. Une production et une surface nationales FAOSTAT (aujourd'hui seul le rendement existe), si l'on veut combler 2022-2024.

**(e) Données à demander au ministère (DA / DAPSA).**
- Résultats départementaux des campagnes 2021/22 à 2025/26 (production, surface semée et récoltée).
- Riz 2021 complet (saison irriguée), en distinguant pluvial et irrigué.
- Séries fonio, sésame 2017+, oignon, pastèque, pomme de terre, patate douce.
- La convention d'année du tableau 1 de la SSA et les valeurs 2023 définitives (mil, arachide).
- Les valeurs de référence et la méthode de calcul des indicateurs de l'annexe 3 de la LPSAE (taux de couverture céréales et riz).

---

## Décisions de l'utilisateur (définitives)

1. Objectifs officiels : seed dbt `ref_objectifs_souverainete.csv` (une ligne par valeur, document, page, url, note ; mil et arachide 2023 : deux lignes avec note de contradiction).
2. Carte : SVG léger des 45 départements (simplifié depuis `app/public/geo/departements.geojson`, GADM 4.1).
3. Accord pour : seed des objectifs ; seed des départements attendus par culture (Guédiawaye et Pikine exclus des totaux) ; mart des séries ; FAOSTAT 2022-2025 au niveau national seulement, étiqueté FAOSTAT, jamais mélangé aux sommes des départements.
4. Riz : total national arrêté en 2020 + point officiel SSA ; départements 2021 visibles avec « incomplet ».
5. Chiffres officiels erronés : valeur du document telle quelle + note « erreur probable » (ex. maïs 2019). Tableau 8 : « référence indiquée par la SSA, origine non précisée ».
6. Aucune prévision dans l'observatoire.

### Règles d'affichage des limites (obligatoires)
- On n'invente rien : pas de donnée = « non disponible », jamais 0, jamais une estimation. Aucun objectif s'il n'existe pas dans la SSA ou la LPSAE.
- Courbes : ligne verticale « Nos données par département s'arrêtent en 2021 » ; après 2021, seul le rendement national FAOSTAT, tracé à part et étiqueté.
- Filtre année : années sans donnée pour la culture visibles mais grisées, infobulle « Pas de donnée pour cette année ».
- Filtre culture : sésame « données jusqu'en 2016 » ; oignon et fonio absents ; ligne en pied de filtre « Oignon, fonio : pas de données disponibles ».
- Chiffres clés : valeur manquante → « Non disponible · dernière donnée : {année} ».
- Carte : départements sans donnée hachurés en gris, légende « Pas de donnée ».
- Encadré « Couverture des données » en haut de page : 7 cultures par département de 1981 à 2021 (manioc depuis 1996), national FAOSTAT (rendement seul) de 2022 à 2025, avec les sources. Le même encadré en page 1 du PDF.
