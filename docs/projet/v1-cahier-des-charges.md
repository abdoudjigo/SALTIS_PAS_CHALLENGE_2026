# Version 1 de la plateforme — cahier des charges (13/11/2026)

Rédigé à partir de la demande d'Abdou. C'est la référence pour finaliser la V1 avant la présentation devant les autorités.

## Le besoin, en une phrase
Le plus grand défi de l'agriculteur et du décideur : **savoir comment sera la pluie de la saison prochaine, pour préparer sa campagne**. La plateforme doit répondre à cette question pour **l'année que l'utilisateur choisit**, et en tirer tout le reste : récolte, semis, besoins.

## Règle de l'année (partout)
- **Années passées (1981-2025)** : on les choisit dans une liste. Elles servent de **vérification** : ce que le modèle avait prévu, face à ce qui s'est réellement passé.
- **Années à venir (2026 et après)** : l'utilisateur **tape l'année** (ex. 2027). La plateforme **prédit**.
- Deux niveaux de prévision, toujours affichés :
  - **prévision océan** : l'année dont on connaît l'océan de mars à mai (aujourd'hui 2026). C'est le modèle 1 ;
  - **prévision de tendance** : les autres années (2027…). Elle s'appuie sur la moyenne des 15 dernières saisons. Erreur mesurée : 115 mm à 1 an, 117 mm à 5 ans, contre 122 mm pour la normale. Elle est remplacée par la prévision océan dès la fin mai de l'année visée.
- Plage saisissable : 2026 à 2035. Au-delà, un message clair.

## Ce qui reste, ce qui part

| Bouton | Décision |
|---|---|
| Ma parcelle (agriculteur) | Garder : tout sur le lieu où l'on est, pour l'année choisie |
| La saison qui vient (les deux profils) | Garder : **cœur de la plateforme**. Année saisie → pluie attendue (mm, fourchette), sèche / normale / humide |
| Quand semer (agriculteur) | Garder : année saisie → période de semis conseillée par culture |
| Quelle culture (agriculteur) | Garder tel quel, avec la récolte attendue pour l'année choisie |
| Mes besoins (agriculteur) | **Refaire** : l'utilisateur saisit **culture + surface + année** et obtient ce qu'il lui faut (semences, NPK 15-15-15, urée, DAP, fumier…), selon les conditions climatiques prévues (récolte attendue, besoin en eau si irrigation requise) |
| Préparer la campagne (ONG) | Garder : année saisie → tableau par département : **pluie attendue (mm), risque récolte, vulnérabilité (/100)** |
| Alerte récolte (ONG) | Garder : année saisie → départements en alerte, en rouge clignotant sur la carte |
| Vulnérabilité, Besoins du pays, Répartir un stock (ONG) | Garder (le stock convient) |
| **Comment finira la saison** | **Retirer** : redondant |
| **Suivi de la pluie** | **Retirer** : sans utilité ici |

## Exigences de présentation
- Lire = comprendre : la réponse en une phrase et 1 à 3 chiffres. Détail replié derrière un bouton visible « Voir le détail ».
- Chaque prévision dit d'où elle vient (océan ou tendance) et sa fiabilité, en une ligne.
- Une valeur inconnue s'affiche « non disponible » ou « dose à saisir », jamais 0.
- Professionnel, sobre, sans jargon : c'est présenté devant des autorités.

## Répartition du travail
| Qui | Quoi |
|---|---|
| Données et modèles (`ml/`) | Prévisions 2026-2035 pour les modèles 1, 3 et 4, avec `type_prevision` : `PREVISION_OCEAN` (2026) ou `PREVISION_TENDANCE` (2027-2035) |
| API (`api/`) | Accepter ces années et ces types ; sans autre changement de route |
| Front (`app/`) | Saisie de l'année, retrait des 2 boutons, refonte de « Mes besoins » et de « Préparer la campagne » |
