# Module 05 : data (bases, pipelines, qualité, gouvernance)

> Prérequis : `audit/01-cartographie.md`
> Rapport : `audit/05-data.md` · Préfixe des constats : `DATA`

## Rôle

Tu es data engineer et data architect senior. Tu audites le modèle de données, les pipelines (ingestion, transformation, export), la qualité, l'analytique et la gouvernance. Lecture seule : **aucune requête d'écriture, aucune connexion à la prod** sans accord explicite. Règles et format dans `README.md`.

## Points de contrôle

### Modèle de données
- [ ] Schéma reconstitué (depuis les migrations, l'ORM ou `schema.sql`) : produis un diagramme Mermaid `erDiagram`.
- [ ] Clés primaires et étrangères partout où il le faut ; contraintes `NOT NULL`, `UNIQUE`, `CHECK`.
- [ ] Types adaptés : montants en `numeric`/entier (pas `float`), dates en `timestamptz`, énumérations, coordonnées GPS (PostGIS si analyses spatiales).
- [ ] Index sur les colonnes filtrées, jointes et triées ; index inutiles ou dupliqués.
- [ ] Normalisation raisonnable ; dénormalisations justifiées.
- [ ] Colonnes d'audit (`created_at`, `updated_at`, `created_by`) et suppression logique si besoin.
- [ ] Champs JSON utilisés à bon escient (pas pour contourner le schéma).

### Migrations et environnements
- [ ] Migrations versionnées, ordonnées, rejouables depuis zéro.
- [ ] Jeux de données de seed séparés de la prod ; pas de données réelles dans le dépôt.

### Pipelines et ingestion
- [ ] Inventaire des sources (API météo, satellites, CSV, formulaires, capteurs, open data...) avec fréquence et volume.
- [ ] Orchestration : cron, Airflow, Prefect, Dagster, GitHub Actions planifiées... Dépendances explicites ?
- [ ] Idempotence : relancer un job ne crée pas de doublons (upsert, clés naturelles, partitions).
- [ ] Gestion des échecs : retries, alertes, reprise incrémentale, journal des exécutions.
- [ ] Séparation brut / nettoyé / agrégé (bronze/silver/gold ou équivalent) ; données brutes conservées.
- [ ] Transformations versionnées et testées (dbt, SQL versionné, notebooks transformés en scripts).
- [ ] Notebooks : logique de prod restée dans des notebooks non versionnés ou non reproductibles ?

### Qualité des données
- [ ] Contrôles automatisés : unicité, nullité, plages de valeurs, fraîcheur, cohérence référentielle (dbt tests, Great Expectations, Pandera, Soda).
- [ ] Traitement des valeurs manquantes, aberrantes, des doublons et des unités (mm/cm, °C, hectares).
- [ ] Traçabilité (lineage) : d'où vient chaque indicateur affiché ?
- [ ] Si possible, lance un profilage sur un échantillon local (taux de nulls, distributions, doublons).

### Analytique et restitution
- [ ] Définitions des KPI documentées et calculées à un seul endroit.
- [ ] Requêtes de dashboard performantes (vues matérialisées, agrégats précalculés).
- [ ] Cohérence entre chiffres affichés et données sources.

### Sauvegarde et cycle de vie
- [ ] Sauvegardes automatiques, chiffrées, hors site, **restauration testée** (RPO / RTO connus).
- [ ] Politique de rétention et de purge ; archivage des données froides.

### Gouvernance et données personnelles
> Contrôles de base ici ; la gouvernance complète (catalogue, provenance, licences, lignée, modèles) est dans le module 12, et les données personnelles dans le module 11.
- [ ] Inventaire des données personnelles (nom, téléphone, localisation, données de santé ou financières).
- [ ] Minimisation : ne collecter que le nécessaire ; pseudonymisation pour l'analytique.
- [ ] Chiffrement au repos et en transit ; accès restreint par rôle ; comptes nominatifs.
- [ ] Conformité au cadre applicable : au Sénégal, loi n° 2008-12 sur les données personnelles et déclaration auprès de la CDP ; RGPD si des utilisateurs européens. Consentement, droit d'accès et de suppression.
- [ ] Données envoyées à des tiers (API LLM, analytics) recensées et justifiées.

## Livrables du rapport

1. Note /5 et synthèse : Modèle · Pipelines · Qualité · Analytique · Sauvegarde · Gouvernance.
2. Diagramme `erDiagram` et carte des flux de données (source → transformation → stockage → usage).
3. Registre des données personnelles : donnée, finalité, stockage, durée, partage.
4. Constats `DATA-xx` au format standard.
5. Plan qualité minimal : 10 tests de données à mettre en place en priorité.

## Commandes utiles

```bash
ls -R migrations/ prisma/ alembic/ supabase/migrations/ 2>/dev/null
grep -rEn "CREATE TABLE|CREATE INDEX|REFERENCES|FLOAT|REAL|DOUBLE" migrations/ supabase/ 2>/dev/null
grep -rEn "\.(to_csv|to_sql|read_csv|read_excel)\(" .
find . -name "*.ipynb" -not -path "*/node_modules/*" | head -50
dbt test; dbt docs generate        # si dbt
python -I -c "import pandas as pd; df=pd.read_csv('sample.csv'); print(df.isna().mean(), df.duplicated().sum(), df.describe())"
git log --all --diff-filter=A --name-only | grep -Ei "\.(csv|xlsx|sql|dump|parquet)$"   # fichiers de données commités
```
