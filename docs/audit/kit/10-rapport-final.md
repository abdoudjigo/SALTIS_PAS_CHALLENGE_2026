# Module 10 : rapport final d'audit

> Prérequis : tous les rapports de `audit/`
> Sortie : `audit/RAPPORT-AUDIT.md`

## Rôle

Tu es le responsable de l'audit. Tu consolides les rapports des modules en un document lisible par deux publics : **la direction ou le jury** (pages 1 et 2) et **l'équipe technique** (le reste). Tu ne rajoutes aucun constat nouveau sans preuve ; tu dédoublonnes les constats vus dans plusieurs modules et tu gardes la sévérité la plus haute.

## Consignes

- Langage clair, phrases courtes, pas de jargon dans la synthèse exécutive.
- Chaque recommandation est rattachée à un ou plusieurs ID de constats.
- Les chiffres (notes, comptes) sont recalculés à partir des rapports, pas estimés.

## Modèle à remplir

```markdown
# Rapport d'audit technique : <Projet>
Date : <AAAA-MM-JJ> · Version du code auditée : <commit / tag> · Auditeur : <nom / agent>

## 1. Synthèse exécutive (1 page max)
**Verdict** : <une phrase : ex. « Plateforme fonctionnelle pour une démo, pas prête pour la prod en l'état. »>

**Note globale : X,X / 5**

| Domaine | Note /5 | Tendance | Commentaire en une ligne |
|---|---|---|---|
| Architecture | | | |
| Frontend | | | |
| Backend / API | | | |
| Data | | | |
| IA / LLM | | | |
| Sécurité | | | |
| DevOps / Infra | | | |
| Qualité / Tests | | | |
| Données personnelles | | | |
| Gouvernance des données | | | |
| Mesure d'audience / clics | | | |
| Adéquation Sénégal / Afrique | | | |

**Constats par sévérité** : 🔴 n · 🟠 n · 🟡 n · 🔵 n

**Les 3 forces**
1. …
**Les 5 risques majeurs**
1. … (ID)
**Décision recommandée** : <ex. « Corriger les 4 points critiques avant toute ouverture publique. »>

## 2. Contexte et périmètre
Objectif de la plateforme, utilisateurs, contraintes terrain, ce qui a été audité, ce qui ne l'a pas été, limites (accès manquants).

## 3. Cartographie
Diagramme Mermaid de l'architecture actuelle (repris du module 01/02).

## 4. Constats critiques et élevés
Tous les 🔴 puis 🟠, au format standard, triés par sévérité puis par effort.

## 5. Plan d'action
### Immédiat (cette semaine) : 🔴
| # | Action | Constats | Effort | Responsable |
|---|---|---|---|---|
### Court terme (30 jours) : 🟠 + gains rapides
### Moyen terme (90 jours) : 🟡 et chantiers structurants
### Architecture cible
Diagramme et étapes de migration (repris du module 02).

## 5 bis. Adéquation au contexte Sénégal / Afrique
Note /5, tableau des thèmes, 5 actions locales prioritaires et démarches à faire (voir `13-contexte-senegal-afrique.md`, section 3).

## 6. Matrice impact / effort
| | Effort S | Effort M | Effort L |
|---|---|---|---|
| Impact fort | à faire tout de suite | à planifier | projet dédié |
| Impact moyen | | | |
| Impact faible | | | |
(Placer les ID des constats dans les cases.)

## 7. Indicateurs à suivre
Les 5 à 8 indicateurs qui montreront le progrès : ex. couverture des parcours critiques, nombre de vulnérabilités 🔴/🟠, LCP mobile, taux d'erreur API, coût LLM par utilisateur, score du jeu d'évaluation IA.

## 8. Annexes
- A. Liste complète des constats (tous niveaux)
- B. Inventaire des endpoints
- C. Schéma de données
- D. Registre des données personnelles
- D bis. Registre des sources et des modèles (licences, droits)
- D ter. Plan de marquage analytics
- E. Mesures brutes (lint, tests, bundle, Lighthouse, scans)
- F. Secrets à révoquer (valeurs masquées)
- G. Questions ouvertes et accès manquants
```

## Contrôle final avant de rendre

- [ ] Chaque 🔴 et 🟠 a une preuve vérifiable et une recommandation précise.
- [ ] Aucun secret en clair dans le rapport.
- [ ] Les notes de la synthèse correspondent à celles des rapports de modules.
- [ ] Pas de constat dupliqué.
- [ ] La synthèse exécutive se lit en 2 minutes par quelqu'un de non technique.

Termine en me donnant : le verdict, la note globale, les 3 actions à faire en premier.
