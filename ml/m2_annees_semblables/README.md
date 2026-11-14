# Modèle 2 — Années semblables

**Bouton dans l'application : « La saison qui vient »** (agriculteur et ONG), à côté du modèle 1.

## La question
Quelles années passées ressemblent le plus à celle-ci dans mon département, et comment leur saison a-t-elle fini ?

Exemple : « À Kaolack, fin juillet 2024 ressemble à 2010 (66 %), 1995 (61 %) et 2023 (55 %). En 2010, la saison a été humide (682 mm). »

## Comment ça marche
Le modèle ne s'entraîne pas : il compare. Pour un département et une année donnés, il cherche parmi **les années précédentes du même département** celles dont la situation était la plus proche.

La situation dépend du moment de la saison :

| Moment | Ce qui est comparé |
|---|---|
| Fin mai | Océan de mars à mai : El Niño (ONI) et Atlantique sud (TSA), les mêmes indices que le modèle 1 |
| Fin juin (décade 18) | Océan + pluie tombée depuis le 1er juin, comparée à la normale |
| Fin juillet (décade 21) | Idem, avec la pluie jusqu'à fin juillet |
| Fin août (décade 24) | Idem, avec la pluie jusqu'à fin août |

- Chaque variable est mise à la même échelle (en écarts-types). En saison, l'océan pèse au total **moitié moins** que la pluie tombée.
- On garde les **8 années les plus proches**. Les probabilités sèche, normale et humide sont la part de ces 8 années dans chaque classe, lissée vers la moyenne des années passées pour ne jamais afficher 0 % ni 100 %.
- L'application montre les **3 plus proches**.
- Seules les années **antérieures** sont candidates : c'est ce qu'on saurait réellement ce jour-là. Les recherches commencent en 1991, pour avoir au moins 10 années de comparaison.
- Guédiawaye n'a pas de pluie décadaire : la comparaison n'y porte que sur l'océan.

**Ressemblance** : 100 % = situation identique ; 61 % = un écart-type d'écart en moyenne ; 14 % = deux écarts-types.

## Est-ce qu'il marche ?
On le compare à la climatologie (la fréquence passée de chaque classe). Le gain se lit comme pour le modèle 1 (RPSS : 0 = pas mieux, 1 = parfait).

| Moment | 2001-2015 | Test 2016-2025 |
|---|---|---|
| Fin mai (océan seul) | −0,09 | +0,10 |
| Fin juin | +0,01 | +0,07 |
| Fin juillet | **+0,15** | **+0,17** |
| Fin août | **+0,33** | **+0,38** |

**Ce qu'il faut retenir** :
- **fin mai**, les années semblables prévoient moins bien que le modèle 1. L'application affiche donc **les probabilités du modèle 1** et montre les années semblables comme illustration : leurs probabilités sont laissées vides à fin mai ;
- **à partir de fin juillet**, la prévision devient vraiment utile, car la pluie déjà tombée en dit long sur la fin de la saison. Elle ne remplace pas le suivi décadaire : elle le complète en disant comment se sont terminées les saisons qui avaient commencé de la même façon.

## Réglages essayés
Choisis sur 2001-2015, sans regarder le test :

| Réglage | Essais | Retenu |
|---|---|---|
| Nombre d'années semblables | 5, 8, 12 | 8 |
| Poids total de l'océan en saison (pluie tombée = 1) | 0, 0,5, 1, 2 | 0,5 |

Sans l'océan, la validation est la même, mais le test est moins bon et le lien avec la prévision de fin mai disparaît. Le fichier d'évaluation donne aussi les scores « pluie tombée seule ».

## Ce qu'il produit
`ml/sorties/annees_semblables.csv` : 45 départements × 1991-2025 × 4 moments × 3 rangs, soit 18 900 lignes.

| Colonne | Contenu |
|---|---|
| `code_departement`, `departement`, `annee`, `moment_prevision` | `FIN_MAI`, `FIN_JUIN`, `FIN_JUILLET`, `FIN_AOUT` |
| `variables_utilisees` | `océan` ou `océan + pluie tombée` |
| `rang`, `annee_semblable`, `ressemblance_pct` | Les 3 années les plus proches |
| `pluie_saison_semblable_mm`, `anomalie_saison_semblable_pct`, `classe_saison_semblable` | Comment cette saison a fini |
| `debut_saison_jour_semblable`, `plus_longue_sequence_seche_semblable_j` | Son démarrage et sa plus longue période sèche |
| `alerte_secheresse_semblable`, `alerte_exces_pluie_semblable` | Ses alertes |
| `proba_seche_pct`, `proba_normale_pct`, `proba_humide_pct`, `classe_prevue` | Probabilités tirées des 8 années semblables (**vides à fin mai**) |
| `version_modele`, `date_calcul` | Traçabilité |

Plus `ml/sorties/evaluation_m2.csv` : la fiabilité moment par moment, avec et sans l'océan.

## Dans l'application
- **Fenêtre** : « Cette année ressemble à 2010, 1995 et 2023 », chaque année sous forme d'une petite carte (ressemblance, pluie, classe, alerte). Un clic sur une année **rejoue cette saison sur la carte** à partir de `mart_carte_agroclimat`.
- **Carte** : à partir de fin juin, chaque département est coloré selon sa probabilité de saison sèche. Les années semblables étant propres à chaque département, la carte n'est plus uniforme comme avec le modèle 1.
- **Méthode**, repliée : « Comparaison avec les années passées du même département ; fiable à partir de fin juillet. »

## Relancer
```bash
venv/bin/python -m ml.m2_annees_semblables.entrainer
```
Environ 25 secondes. Les tables sont lues dans `ml/donnees/`, ou dans Snowflake la première fois.
