# Kit d'audit plateforme AKAI

Un ensemble de prompts pour faire auditer une plateforme complète par un agent IA (Claude Code, Cursor ou autre) qui a accès au dépôt : front, back, data, IA, architecture, sécurité, DevOps et qualité.

## Contenu

| Fichier | Domaine | Sortie attendue |
|---|---|---|
| `00-prompt-maitre.md` | Orchestration de tout l'audit | Plan, puis lancement des modules dans l'ordre |
| `01-cadrage-cartographie.md` | Inventaire et carte du système | `audit/01-cartographie.md` |
| `02-architecture.md` | Architecture, découpage et structure des dossiers | `audit/02-architecture.md` |
| `03-frontend.md` | UI, perf web, accessibilité, SEO | `audit/03-frontend.md` |
| `04-backend-api.md` | API, logique métier, robustesse | `audit/04-backend.md` |
| `05-data.md` | BDD, pipelines, qualité, gouvernance | `audit/05-data.md` |
| `06-ia-llm.md` | Chatbots, RAG, modèles ML | `audit/06-ia.md` |
| `07-securite.md` | Sécurité applicative et données perso | `audit/07-securite.md` |
| `08-devops-infra.md` | CI/CD, infra, observabilité, coûts | `audit/08-devops.md` |
| `09-qualite-tests.md` | Code, tests, dette technique, docs | `audit/09-qualite.md` |
| `11-protection-donnees-rgpd.md` | Données personnelles : loi sénégalaise 2008-12, RGPD | `audit/11-donnees-personnelles.md` |
| `12-gouvernance-donnees.md` | Gouvernance, provenance, licences et droits sur données et modèles | `audit/12-gouvernance.md` |
| `14-analytics-collecte-clics.md` | Mesure d'audience, collecte des clics visiteurs, plan de marquage, consentement | `audit/14-analytics.md` |
| `13-contexte-senegal-afrique.md` | Grille locale appliquée à **tous** les modules : lois sénégalaises et africaines, réseau, langues, paiement mobile, souveraineté | Section dédiée du rapport final |
| `10-rapport-final.md` | Modèle de synthèse (à lancer en dernier) | `audit/RAPPORT-AUDIT.md` |

## Comment s'en servir

1. Copiez le dossier à la racine du projet (ou à côté), par exemple dans `docs/audit-prompts/`.
2. Ouvrez l'agent à la racine du dépôt.
3. **Audit complet** : collez le contenu de `00-prompt-maitre.md`.
   **Audit ciblé** : lancez `01-cadrage-cartographie.md` en premier (les autres modules s'appuient dessus), puis seulement les modules utiles.
4. Remplissez le bloc **Contexte** de `00-prompt-maitre.md` avant de lancer : il guide la priorisation.
5. Relisez chaque rapport intermédiaire avant de passer au suivant ; corrigez l'agent s'il s'est trompé sur le contexte.

## Contexte local

Le kit est pensé pour des plateformes déployées au **Sénégal et en Afrique**. Le module 13 est une grille transversale : l'agent la lit au début et l'applique dans chaque module (réseau lent, Android d'entrée de gamme, wolof et langues locales, WhatsApp/SMS/USSD, Wave et Orange Money, CDP, loi n° 25/2026 sur la cybersécurité, Convention de Malabo, cloud souverain).

## Règles communes à tous les modules

Ces règles sont rappelées dans chaque prompt :

- **Preuves obligatoires** : chaque constat cite `fichier:ligne`, une commande et sa sortie, ou une config. Pas de constat sans preuve.
- **Lecture seule** : l'agent ne modifie pas le code, ne pousse rien et ne lance aucune commande destructive ni aucune migration. Il peut lancer linters, tests, builds et scanners en local.
- **Aucun secret dans le rapport** : si un secret est trouvé, citer le fichier et masquer la valeur (`sk-****`).
- **Distinguer** : `Constaté` (vérifié), `Probable` (fort indice), `À vérifier` (besoin d'accès ou d'info).

### Échelle de sévérité

| Niveau | Signification | Délai indicatif |
|---|---|---|
| 🔴 Critique | Faille exploitable, perte de données, panne probable en prod | Immédiat |
| 🟠 Élevé | Risque sérieux de sécurité, de fiabilité ou de coût | Sous 2 semaines |
| 🟡 Moyen | Dette qui ralentit l'équipe ou dégrade l'expérience | Sous 1 à 2 mois |
| 🔵 Faible | Amélioration, bonne pratique | Backlog |

### Notation par domaine (0 à 5)

0 absent · 1 critique · 2 fragile · 3 acceptable · 4 solide · 5 exemplaire

### Format d'un constat

```
### [ID] Titre court
- Sévérité : 🔴/🟠/🟡/🔵   Statut : Constaté / Probable / À vérifier
- Où : chemin/fichier.ext:42
- Constat : ce qui est observé (1 à 3 phrases)
- Preuve : extrait court, commande + sortie
- Impact : conséquence concrète (utilisateur, sécurité, coût, équipe)
- Recommandation : action précise
- Effort : S (< 1 j) / M (1 à 5 j) / L (> 5 j)
```

Préfixes d'ID : `ARC`, `FE`, `BE`, `DATA`, `IA`, `SEC`, `OPS`, `QUA`, `PRIV`, `GOV`, `ANA`, `LOC`.
