# Pitch de 2 minutes : Assaman & Suuf

Présentation orale pour le jury du SALTIS PAS Challenge 2026 : la problématique, la solution et le modèle économique.

- Slides : [`presentation-pitch.pptx`](presentation-pitch.pptx) (5 slides, le script de chaque slide est aussi dans les notes de l'orateur).
- Durée : environ 2 minutes (environ 300 mots, débit posé).

| Slide | Contenu | Temps |
|---|---|---|
| 1 | Titre | 0:00 – 0:05 |
| 2 | La problématique | 0:05 – 0:35 |
| 3 | La solution | 0:35 – 1:20 |
| 4 | Le modèle économique | 1:20 – 1:50 |
| 5 | Conclusion | 1:50 – 2:00 |

---

## Slide 1 : titre (0:00 – 0:05)

> Bonjour, nous sommes l'équipe AKAI, et voici Assaman & Suuf, « le ciel et la terre ».

## Slide 2 : la problématique (0:05 – 0:35)

> Au Sénégal, l'agriculture vit au rythme de la pluie. Chaque année, avant de semer, un producteur fait un pari : la saison sera-t-elle courte ou longue, abondante ou sèche ? De ce pari dépendent la culture, la variété et les intrants qu'il achète.
>
> Les services de l'État et les ONG font le même pari à une autre échelle : où envoyer des intrants limités, et en quelle quantité ?
>
> Les données existent : pluie, sols, rendements depuis plus de 40 ans. Mais elles sont dispersées, techniques, et personne ne les relie à la décision du terrain.

## Slide 3 : la solution (0:35 – 1:20)

> Assaman & Suuf est une plateforme d'aide à la décision agricole. Elle croise le climat, le sol et les rendements pour les 45 départements du pays, sur 1981 à 2025, et répond à quatre questions :
>
> 1. Quelle saison s'annonce ? Une prévision saisonnière de la pluie, puis un suivi décade par décade, comparé à la normale.
> 2. Que semer ? L'adéquation de chaque culture et de chaque cycle avec la pluie réellement disponible.
> 3. De combien d'intrants a-t-on besoin ? Les besoins en engrais et en semences, pour le producteur comme pour le département.
> 4. Comment répartir ? Une organisation saisit son stock, la plateforme propose plusieurs scénarios, de la priorité au rendement à la priorité aux territoires vulnérables, et c'est elle qui choisit.
>
> Le tout sur une carte interactive, sur ordinateur comme sur téléphone.

## Slide 4 : le modèle économique (1:20 – 1:50)

> Notre modèle repose sur un principe simple : ceux qui décident à grande échelle financent l'accès des producteurs.
>
> Pour les producteurs, la plateforme est gratuite : carte, conseils et assistant vocal.
>
> Les services de l'État et les ONG paient un abonnement annuel par organisation, pour les scénarios de répartition, les exports et l'accompagnement.
>
> Les bailleurs et les investisseurs achètent des études sur mesure, par exemple la carte des terres irrigables en contre-saison.
>
> Nos coûts restent bas : des données ouvertes et un seul serveur, avec des réponses précalculées.

## Slide 5 : conclusion (1:50 – 2:00)

> Nos résultats sont des estimations, pas des garanties, et nous l'affichons : chaque dose porte son statut de validation, à confirmer avec l'ISRA et les conseillers agricoles. Notre ambition : que chaque décision de campagne s'appuie sur la donnée plutôt que sur le hasard. Merci.

---

## Si le jury pose des questions

- **La prévision est-elle fiable ?** Sur 2016-2025, années jamais vues à l'entraînement, elle se trompe en moyenne de 111 mm sur la pluie de saison, contre 122 mm pour la normale. Elle reste indicative.
- **D'où viennent les données ?** CHIRPS (pluie), NASA POWER (climat), SoilGrids (sols), DAPSA (rendements), puis Snowflake et dbt.
- **Qui valide les doses ?** Aucune dose n'est présentée comme validée tant qu'un spécialiste (ISRA) ne l'a pas confirmée.
- **Pourquoi pas les coopératives ?** Retirées du périmètre par l'équipe : la plateforme vise les producteurs, l'État et les ONG.

## Points à trancher par l'équipe

- Le modèle économique est une **proposition** : il ne figure pas encore dans la documentation du projet. Les montants des abonnements et des études ne sont pas fixés.
- Les études pour les bailleurs s'appuient sur la carte des opportunités de contre-saison ([`carte-opportunites.md`](carte-opportunites.md)), encore en cours d'intégration.
