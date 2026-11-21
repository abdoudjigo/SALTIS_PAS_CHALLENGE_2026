# Module 11 : protection des données personnelles (loi sénégalaise 2008-12 et RGPD)

> Prérequis : `audit/01-cartographie.md` et `audit/05-data.md` (registre des données)
> Rapport : `audit/11-donnees-personnelles.md` · Préfixe des constats : `PRIV`

> ⚠️ Ce module est un **audit technique de conformité**, pas un avis juridique. Les conclusions doivent être validées par un juriste ou un DPO avant toute démarche officielle (déclaration CDP, réponse à une autorité, notification de violation).

## Rôle

Tu es à la fois privacy engineer et auditeur conformité. Tu vérifies, preuves à l'appui dans le code, la configuration et la documentation, que la plateforme traite les données personnelles de façon licite, minimale, sécurisée et transparente. Lecture seule. Règles et format dans `README.md`. **Tu ne copies jamais de donnée personnelle réelle dans le rapport** : tu cites la table et la colonne, ou le fichier, et tu masques les valeurs.

## 0. Cadre juridique à déterminer en premier

Indique quels textes s'appliquent et pourquoi :

| Texte | S'applique si… | Autorité |
|---|---|---|
| **Loi n° 2008-12 du 25 janvier 2008** sur la protection des données à caractère personnel, et son **décret d'application n° 2008-721** | Le responsable du traitement est établi au Sénégal, ou les traitements y sont réalisés | **CDP** (Commission de protection des données personnelles) |
| **RGPD** (règlement UE 2016/679) | Le responsable ou un sous-traitant est établi dans l'UE, **ou** la plateforme cible des personnes situées dans l'UE (offre de service, suivi de comportement), par exemple la diaspora, des partenaires ou bailleurs européens | Autorité du pays UE concerné (ex. CNIL) |
| Convention de Malabo (Union africaine), en vigueur depuis le 8 juin 2023 | Cadre continental, ratifié par le Sénégal | — |
| Acte additionnel CEDEAO A/SA.1/01/10 (2010) | Harmonisation de la protection des données en Afrique de l'Ouest | — |
| Lois des autres pays visés (Côte d'Ivoire, Mali, Nigeria…) | La plateforme cible des utilisateurs dans ces pays | Autorité de chaque pays (voir module 13) |
| Textes sectoriels | Données de santé, financières (BCEAO pour le paiement mobile), télécoms (ARTP), cybersécurité (loi n° 25/2026) | Selon le secteur |

Points à garder en tête :
- La loi 2008-12 est toujours en vigueur. Une réforme est en préparation depuis plusieurs années ; vérifie si elle a été adoptée à la date de l'audit et signale-le.
- Quand les deux régimes s'appliquent, applique **la règle la plus exigeante** sur chaque point.
- Les contrats avec bailleurs, partenaires ou organisateurs de concours peuvent imposer leurs propres exigences : demande-les.

## 1. Cartographie des traitements

Pour chaque traitement (inscription, chatbot, géolocalisation, paiement, analytics, newsletter, entraînement de modèle…), remplis :

| Traitement | Finalité | Personnes concernées | Données collectées | Données sensibles ? | Base légale | Source | Stockage (pays, fournisseur) | Destinataires / sous-traitants | Transfert hors Sénégal / UE ? | Durée de conservation |
|---|---|---|---|---|---|---|---|---|---|---|

Méthode : reconstitue-le depuis le schéma de BDD, les formulaires du front, les payloads d'API, les SDK tiers, les logs et les prompts envoyés aux LLM. Signale tout écart entre ce que la politique de confidentialité annonce et ce que le code collecte réellement.

**Données sensibles** à repérer en priorité : santé, biométrie (empreintes, visage, **voix** si elle sert à identifier), opinions politiques ou religieuses, origine ethnique, données d'enfants, géolocalisation précise, données financières, numéros d'identification nationale.

## 2. Points de contrôle

### Licéité et formalités
- [ ] Chaque traitement a une base légale identifiée (consentement, contrat, obligation légale, intérêt légitime, mission d'intérêt public…).
- [ ] **Sénégal** : formalité préalable auprès de la CDP effectuée ou prévue (déclaration, ou demande d'autorisation pour les traitements les plus sensibles comme les données de santé, biométriques ou à grande échelle). Numéro de récépissé ou d'autorisation conservé ? Statut `À vérifier` si l'info n'est pas dans le dépôt.
- [ ] **RGPD** : registre des activités de traitement tenu ; DPO désigné si obligatoire ; représentant dans l'UE si le responsable est hors UE et cible des personnes dans l'UE.
- [ ] Analyse d'impact (AIPD / DPIA) réalisée pour les traitements à risque élevé : données sensibles, profilage, IA à grande échelle, géolocalisation, personnes vulnérables.

### Minimisation et finalité
- [ ] Chaque champ collecté sert une finalité déclarée ; liste les champs collectés mais jamais utilisés.
- [ ] Champs « au cas où » (date de naissance complète, numéro de pièce d'identité, GPS précis) remplaçables par moins intrusif (tranche d'âge, localisation à la commune).
- [ ] Données réutilisées pour une autre finalité (ex. conversations du chatbot réutilisées pour entraîner un modèle) : information et base légale prévues ?

### Transparence et consentement
- [ ] Politique de confidentialité accessible, compréhensible, **dans la langue des utilisateurs** (français, et wolof à l'oral ou à l'écrit si l'audience le demande), cohérente avec le code.
- [ ] Mentions d'information au moment de la collecte (formulaires, première ouverture du chatbot, collecte vocale).
- [ ] Consentement libre, spécifique, éclairé, **préalable** et aussi simple à retirer qu'à donner ; preuve du consentement stockée (date, version du texte).
- [ ] Cases non pré-cochées ; pas de consentement forcé pour accéder au service s'il n'est pas nécessaire.
- [ ] Cookies et traceurs : aucun traceur non essentiel (analytics, pixels publicitaires, replay de session) déposé avant consentement. Vérifie les scripts chargés au premier affichage. Détail de la mesure d'audience dans le module 14.
- [ ] Mineurs : âge minimal défini ; consentement parental si nécessaire ; interfaces adaptées.

### Droits des personnes
- [ ] Moyen simple d'exercer ses droits : accès, rectification, suppression, opposition, et sous RGPD portabilité et limitation.
- [ ] **Suppression réelle** : supprimer un compte efface ou anonymise les données dans la BDD principale, les fichiers stockés, les index vectoriels (RAG), les logs, les caches, les outils tiers ; les sauvegardes expirent dans un délai défini.
- [ ] Export des données d'un utilisateur possible (format lisible).
- [ ] Décisions automatisées avec effet important (score, éligibilité, recommandation qui engage) : explication et possibilité d'intervention humaine.
- [ ] Délai de réponse aux demandes suivi (1 mois sous RGPD).

### Sécurité des données personnelles
- [ ] Chiffrement en transit (TLS) et au repos (BDD, stockage objet, sauvegardes).
- [ ] Accès aux données de prod restreint, nominatif, journalisé ; principe du moindre privilège.
- [ ] Pseudonymisation ou anonymisation pour l'analytique, les dashboards, les jeux de test et les notebooks.
- [ ] **Aucune donnée réelle** dans le dépôt, les seeds, les fixtures, les notebooks commités, les captures d'écran, les tickets.
- [ ] Logs : pas de numéros de téléphone, e-mails, tokens, contenus de conversation ou coordonnées GPS en clair ; masquage automatique.
- [ ] Renvoi au module 07 pour les contrôles de sécurité applicative.

### Sous-traitants et transferts
- [ ] Liste des sous-traitants qui reçoivent des données : hébergeur, BDD managée, fournisseur LLM, STT/TTS, SMS, e-mail, paiement, analytics, monitoring (Sentry capture souvent des données perso).
- [ ] Contrat ou conditions de traitement (DPA) disponibles pour chacun ; options de non-rétention ou de non-entraînement activées chez les fournisseurs IA quand elles existent.
- [ ] Pays de stockage identifiés. **Transfert hors du Sénégal** : la loi 2008-12 l'encadre (pays offrant un niveau de protection suffisant, sinon garanties ou autorisation de la CDP). **Transfert hors UE** sous RGPD : décision d'adéquation, clauses contractuelles types, etc.
- [ ] Région d'hébergement choisie quand le fournisseur le permet.

### Conservation
- [ ] Durée de conservation définie par type de donnée et **appliquée techniquement** (jobs de purge, TTL, expiration des logs et des sauvegardes).
- [ ] Comptes inactifs : règle de purge ou d'anonymisation.
- [ ] Conversations de chatbot et enregistrements vocaux : durée explicite et courte par défaut.

### Violations de données
- [ ] Procédure écrite : détection, qualification, confinement, information.
- [ ] Notification : sous RGPD, à l'autorité dans les **72 heures** après en avoir pris connaissance si la violation présente un risque, et aux personnes si le risque est élevé ; côté Sénégal, information de la CDP et respect des obligations de la loi sur la cybersécurité si applicable.
- [ ] Registre des violations, même mineures.

### Spécifique IA et données
- [ ] Données personnelles envoyées dans les prompts : minimisées, masquées si possible (noms, téléphones, numéros d'identité).
- [ ] Index RAG et jeux d'entraînement : pas de données personnelles non nécessaires ; suppression possible par utilisateur.
- [ ] Le modèle ne peut pas restituer les données d'un autre utilisateur (isolation, tests de fuite).
- [ ] Voix : si elle permet d'identifier une personne, la traiter comme une donnée sensible (consentement explicite, conservation courte).
- [ ] Si des utilisateurs sont dans l'UE : vérifier si l'AI Act (règlement UE sur l'IA) impose des obligations de transparence (ex. informer qu'on parle à une IA).

### Privacy by design et gouvernance
- [ ] Paramètres les plus protecteurs par défaut.
- [ ] Une personne responsable de la conformité identifiée dans l'équipe.
- [ ] Revue « données personnelles » prévue dans le processus de dev (template de PR, checklist).
- [ ] Équipe sensibilisée ; accès retirés au départ d'un membre.

## 3. Livrables du rapport

1. **Cadre applicable** : quels textes, pourquoi, et les points où le plus exigeant a été retenu.
2. Note /5 et synthèse : Licéité · Minimisation · Transparence · Droits · Sécurité · Sous-traitants · Conservation · Violations · IA.
3. **Registre des traitements** (tableau de la section 1), prêt à être repris pour la déclaration CDP ou le registre RGPD.
4. **Carte des flux de données personnelles** (Mermaid) : collecte → stockage → sous-traitants → pays.
5. Constats `PRIV-xx` au format standard, avec pour chacun le texte concerné (2008-12, RGPD, les deux).
6. **Écarts entre la politique de confidentialité et le code réel.**
7. Liste des documents manquants : politique de confidentialité, mentions d'information, registre, AIPD, DPA, procédure de violation, récépissé CDP.
8. Plan de mise en conformité : immédiat / 30 jours / 90 jours.
9. Questions à poser à un juriste.

## 4. Commandes utiles

```bash
# Champs de données personnelles dans le schéma et le code
grep -rEin "phone|telephone|tel\b|email|mail|nom|prenom|first_?name|last_?name|birth|naissance|cni|nin|passport|address|adresse|gps|lat(itude)?|lng|lon(gitude)?|location|ip_?address|voice|audio|sante|health|religion" \
  --include=*.{sql,prisma,py,ts,tsx,js} . | grep -v node_modules | head -100

# Données réelles commitées (fichiers de données, dumps, notebooks avec sorties)
git log --all --name-only --pretty=format: | grep -Ei "\.(csv|xlsx|json|sql|dump|parquet|ipynb|wav|mp3|m4a)$" | sort -u
grep -rEn "\+221 ?[0-9]{2} ?[0-9]{3} ?[0-9]{2} ?[0-9]{2}|7[05678][0-9]{7}" --include=*.{json,csv,sql,py,ts,js,ipynb,md} . | grep -v node_modules | head   # numéros sénégalais

# Données perso dans les logs
grep -rEn "(console\.log|logger\.(info|debug)|print)\(.*(phone|email|user|token|password|message|prompt)" . | grep -v node_modules

# Traceurs chargés côté front
grep -rEn "googletagmanager|gtag\(|google-analytics|facebook\.net|fbq\(|hotjar|clarity\.ms|mixpanel|segment|posthog|sentry" --include=*.{html,tsx,ts,js,jsx} . | grep -v node_modules

# Purge et durée de conservation
grep -rEin "retention|ttl|expire|purge|delete.*older|cron" --include=*.{py,ts,js,sql,yml,yaml} . | grep -v node_modules

# Données envoyées aux LLM et services tiers
grep -rEn "messages *[:=]|prompt *[:=]|\.create\(|\.invoke\(" --include=*.{py,ts,js} . | grep -v node_modules | head -40

# Suppression de compte : est-ce que tout est nettoyé ?
grep -rEin "delete.*(user|account|compte)|destroy.*user|remove.*user" --include=*.{py,ts,js} . | grep -v node_modules
```

## 5. Ressources

- CDP Sénégal : site officiel de la Commission, pour les formalités et modèles de déclaration.
- Texte de la loi n° 2008-12 et du décret n° 2008-721.
- RGPD et guides pratiques de la CNIL (registre, AIPD, cookies, sécurité), réutilisables comme méthode même hors UE.
- OWASP Top 10 Privacy Risks, et OWASP Top 10 for LLM Applications pour la partie IA.
