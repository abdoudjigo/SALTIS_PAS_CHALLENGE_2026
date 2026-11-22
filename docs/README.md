# Documentation

| Dossier | Contenu | Pour qui |
|---|---|---|
| [`technique/`](technique/) | Contrat de données des marts, dictionnaire des données, guide de l'API, état de la modélisation (décisions, règles, questions pour l'ISRA), carte des opportunités, comparaison des modèles, architecture décisionnelle cible | Développeurs, data, partenaires techniques |
| [`projet/`](projet/) | Cahier des charges de la V1, équipe, pitch (script et diapositives), business model, plan de départ | Équipe, jury, partenaires |
| [`audit/`](audit/) | Audit technique du 21/11/2026 : synthèse, rapports par module, kit utilisé | Équipe, relecteurs |
| [`visuels/`](visuels/) | Logo (version d'origine et notes de dessin), logos d'origine des sources de données | Équipe |
| [`outils-ia/`](outils-ia/) | Consignes et briefs donnés aux assistants IA pendant le développement, journal d'une mission | Équipe (usage interne) |

Points d'entrée les plus utiles :
- Comprendre les données servies : [`technique/contrat-donnees.md`](technique/contrat-donnees.md)
- Appeler l'API : [`technique/guide-api.md`](technique/guide-api.md) (et `http://localhost:8080/docs` en local)
- Savoir ce qui est décidé, fait et ouvert : [`technique/etat-modelisation.md`](technique/etat-modelisation.md)
- Fiabilité des modèles : [`../ml/MODELES.md`](../ml/MODELES.md) et [`technique/rapport-comparaison-modeles.md`](technique/rapport-comparaison-modeles.md)
- Ce que la V1 doit faire : [`projet/v1-cahier-des-charges.md`](projet/v1-cahier-des-charges.md)
- Ce que mesure la plateforme (audience, sans donnée personnelle) : [`technique/plan-de-marquage.md`](technique/plan-de-marquage.md)

Chaque dossier du code a aussi son propre `README.md` : `api/`, `app/`, `dbt/`, `ml/`, `ingestion/collecte/`, `voix/`, `deploy/`.
