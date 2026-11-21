# Module 13 : contexte Sénégal et Afrique (grille transversale)

> **À lire par l'agent dès le début de l'audit**, puis à appliquer dans **tous** les modules : ce n'est pas un module de plus, c'est le filtre local de tout l'audit.
> Rapport : section « Adéquation au contexte Sénégal / Afrique » dans `audit/RAPPORT-AUDIT.md`, et constats préfixés `LOC` quand ils ne rentrent dans aucun autre module.

> ⚠️ Les textes et institutions cités sont à jour à la date de rédaction de ce kit (novembre 2026). L'agent doit signaler qu'ils sont **à revérifier** au moment de l'audit, et les questions juridiques restent à valider par un juriste.

## Rôle

Tu audites une plateforme conçue pour des utilisateurs au Sénégal et, potentiellement, en Afrique de l'Ouest et au-delà. Une plateforme peut être correcte selon les standards européens ou américains et pourtant **inutilisable ou non conforme sur le terrain**. Pour chaque module, tu ajoutes les contrôles ci-dessous et tu pondères la sévérité selon la réalité des utilisateurs.

## 1. Cadre juridique et institutionnel

### Sénégal
| Domaine | Texte ou institution | Pour l'audit |
|---|---|---|
| Données personnelles | Loi n° 2008-12 du 25 janvier 2008 et décret n° 2008-721 ; **CDP** | Toujours en vigueur ; réforme annoncée mais non adoptée à ce jour. Modules 11 et 12 |
| Cybersécurité | **Loi n° 25/2026** sur la protection des infrastructures d'information critiques et la sécurité numérique (adoptée le 20 août 2026) ; **Autorité nationale de Cybersécurité** | Obligations renforcées pour les opérateurs d'infrastructures critiques ; vérifier si la plateforme ou ses clients (État, banques, télécoms, énergie, santé) sont concernés. Module 07 |
| Socle numérique de 2008 | Lois sur les transactions électroniques, la cybercriminalité et la cryptologie (paquet de 2008) | Signature et contrats électroniques, infractions, usage du chiffrement. À vérifier avec un juriste |
| Droit d'auteur | Loi n° 2008-09 sur le droit d'auteur et les droits voisins ; Accord de Bangui (**OAPI**) | Données, contenus, modèles. Module 12 |
| Télécoms | Code des communications électroniques ; **ARTP** | SMS, USSD, numéros courts, services à valeur ajoutée |
| Stratégie de l'État | **New Deal technologique** (lancé en février 2025) : souveraineté numérique, cloud souverain, IA | Projets avec l'État ou les collectivités : hébergement des données sensibles sur le territoire national (centres de données de Diamniadio notamment). Module 08 |

### Afrique de l'Ouest et Union africaine
| Texte | Portée |
|---|---|
| **Convention de Malabo** (UA) sur la cybersécurité et la protection des données personnelles, en vigueur depuis le 8 juin 2023 | Cadre continental, ratifié par le Sénégal |
| **Acte additionnel CEDEAO A/SA.1/01/10** (2010) relatif à la protection des données personnelles | Harmonisation en Afrique de l'Ouest |
| Réglementation **BCEAO / UEMOA** sur les systèmes de paiement et la monnaie électronique | Dès qu'il y a paiement, portefeuille, crédit ou collecte de fonds : passer par un acteur agréé (Wave, Orange Money, Free Money, agrégateurs) |
| Cadre de politique des données de l'UA (2022) et Stratégie continentale de l'UA sur l'IA (2024) | Références de bonnes pratiques, utiles pour les dossiers de financement et les partenaires |

### Si la plateforme s'étend à d'autres pays
Chaque pays a sa propre loi et son autorité, par exemple : Côte d'Ivoire (ARTCI), Mali, Burkina Faso, Bénin (Code du numérique, APDP), Nigeria (NDPA 2023, NDPC), Ghana, Kenya (ODPC), Maroc (CNDP), Afrique du Sud (POPIA). L'agent liste les pays visés et signale les formalités à prévoir **par pays**. Le RGPD s'ajoute dès qu'on cible des personnes dans l'UE (diaspora, partenaires).

## 2. Réalité du terrain : contrôles à ajouter par module

### Réseau et coût des données (modules 02, 03, 04)
- [ ] La plateforme reste utilisable en **3G lente ou réseau instable** : tester avec un profil de bridage réseau, pas seulement en fibre.
- [ ] Poids de la première page **sous 500 Ko** si possible (le forfait data coûte cher à l'utilisateur) ; images compressées ; pas de vidéo en lecture automatique.
- [ ] Reprise après coupure : brouillons sauvegardés localement, envoi différé, retries, pas de perte de saisie.
- [ ] Mode hors ligne ou PWA pour les usages terrain (agriculteurs, agents, enquêteurs) ; synchronisation au retour du réseau, avec gestion des conflits.
- [ ] Réponses d'API paginées et légères ; compression activée ; pas de chargement de toute la base dans le navigateur.

### Appareils (module 03)
- [ ] Test sur **Android d'entrée de gamme** (2 à 3 Go de RAM, petit écran 360 px, navigateur Chrome ou navigateur intégré à WhatsApp/Facebook).
- [ ] JavaScript léger : pas de bundle de plusieurs Mo, pas d'animations lourdes.
- [ ] Application mobile : taille d'installation faible, fonctionne sur des versions Android anciennes encore répandues.

### Canaux d'accès (modules 02, 04, 06)
- [ ] Les utilisateurs sont-ils joignables là où ils sont ? **WhatsApp**, **SMS**, **USSD**, **appel vocal / serveur vocal (IVR)**, en plus ou à la place du web.
- [ ] Les canaux sont prévus dans l'architecture (couche commune, logique métier partagée), pas codés en double.
- [ ] Coûts des SMS et des API WhatsApp Business estimés au volume visé.

### Langues et alphabétisation (modules 03, 06)
- [ ] Langues des utilisateurs réellement couvertes : français, **wolof**, et selon les zones pulaar, sérère, diola, mandingue, soninké…
- [ ] Le wolof écrit varie beaucoup (orthographe officielle vs écriture « à la française » sur WhatsApp, mélange avec le français) : le chatbot et la recherche doivent tolérer ces variantes.
- [ ] Qualité réelle des modèles en langues locales **mesurée** avec un jeu de test local, pas supposée.
- [ ] Reconnaissance et synthèse vocales testées avec des accents et environnements réels (bruit, marché, champ).
- [ ] Interface utilisable par des personnes peu ou pas alphabétisées : icônes claires, audio, pictogrammes, parcours courts.
- [ ] Traductions relues par des locuteurs natifs, avec le vocabulaire du métier (agriculture, santé, administration).

### Paiement (modules 04, 07)
- [ ] Moyens de paiement locaux : Wave, Orange Money, Free Money, cartes, via agrégateurs (ex. PayDunya, CinetPay, PayTech ou équivalents).
- [ ] Webhooks de paiement : signature vérifiée, idempotence, rapprochement automatique, gestion des paiements en attente ou échoués.
- [ ] Montants en **FCFA (XOF), sans décimales** ; stockés en entiers.
- [ ] Aucune conservation de fonds par la plateforme sans agrément.

### Formats et données locales (modules 03, 05)
- [ ] Numéros de téléphone : format `+221` et 9 chiffres, préfixes opérateurs, validation tolérante (espaces, `00221`).
- [ ] Adresses souvent informelles : prévoir quartier, repère, point GPS plutôt qu'un format postal européen.
- [ ] Découpage administratif à jour : régions, départements, arrondissements, communes ; référentiel unique, codes officiels (ANSD).
- [ ] Dates au format local, fuseau `Africa/Dakar` (UTC+0, sans heure d'été) ; calendriers métier (hivernage et contre-saison pour l'agriculture, fêtes religieuses pour la charge).
- [ ] Sources de données locales identifiées et leurs conditions d'usage vérifiées : **ANSD** (statistique), **ANACIM** (météo), données ministérielles, open data, plus les sources mondiales (Copernicus, CHIRPS, FAO, NASA…). Module 12.

### Hébergement, souveraineté et électricité (module 08)
- [ ] Latence **mesurée depuis Dakar** vers les régions cloud candidates (Europe de l'Ouest, Afrique du Sud, autres régions africaines, centres de données locaux) ; choisir sur mesure, pas par habitude.
- [ ] Données sensibles ou données de l'État : hébergement exigé sur le territoire national ? (New Deal technologique, cloud souverain, clauses des marchés publics.) Prévoir une architecture **portable** (conteneurs, pas de verrouillage fort sur un fournisseur) pour pouvoir migrer.
- [ ] Lois extraterritoriales des fournisseurs (ex. accès possible des autorités du pays du fournisseur) prises en compte pour les données sensibles.
- [ ] Serveurs ou équipements locaux : onduleurs, coupures d'électricité, connexion de secours.
- [ ] Coûts suivis en **FCFA** et adaptés au budget réel (crédits cloud, offres startups, hébergeurs locaux).

### Sécurité et fraude locales (module 07)
- [ ] Risques fréquents dans la région : **SIM swap** et détournement d'OTP par SMS, arnaques par WhatsApp, usurpation d'identité, fraude au mobile money. OTP limités, alertes de changement de numéro, confirmation renforcée des opérations sensibles.
- [ ] Applicabilité de la loi n° 25/2026 vérifiée (clients ou partenaires classés infrastructures critiques → exigences contractuelles de sécurité plus fortes).
- [ ] Procédure de signalement d'incident adaptée (autorités nationales compétentes, CDP pour les données personnelles).

### IA responsable en contexte africain (module 06)
- [ ] Biais : les modèles mondiaux connaissent mal les réalités locales (cultures, noms, lieux, prix, saisons, pratiques). Évaluer sur des cas locaux.
- [ ] Conseils à fort enjeu (agriculture, santé, finance, juridique) : sources locales citées, renvoi vers un agent ou un expert humain, prudence quand le modèle n'a pas de données locales.
- [ ] Données collectées localement pour entraîner des modèles : consentement des communautés, retour de valeur, accords avec les partenaires (module 12).

### Organisation et pérennité (modules 08, 09)
- [ ] Documentation lisible par toute l'équipe (en français si c'est la langue de travail) ; un nouveau membre peut reprendre le projet.
- [ ] Dépendance à une seule personne ou à un seul compte personnel (carte bancaire, compte cloud, nom de domaine au nom d'un membre) : signaler et prévoir le transfert vers une structure.
- [ ] Projets nés en hackathon ou concours : règlement relu (droits, publication, données des organisateurs), et plan pour passer du prototype à un service maintenu.

## 3. Comment l'intégrer au rapport

Dans le rapport final, ajoute une section **« Adéquation au contexte Sénégal / Afrique »** avec :

1. Une note /5 sur l'adéquation au terrain.
2. Un tableau :

| Thème | État | Constats liés | Priorité |
|---|---|---|---|
| Cadre juridique (CDP, loi 25/2026, Malabo, BCEAO) | | | |
| Réseau et coût des données | | | |
| Appareils | | | |
| Canaux (WhatsApp, SMS, USSD, voix) | | | |
| Langues et alphabétisation | | | |
| Paiement mobile | | | |
| Formats et référentiels locaux | | | |
| Hébergement et souveraineté | | | |
| Fraude et sécurité locales | | | |
| IA adaptée au contexte | | | |
| Pérennité de l'équipe et du projet | | | |

3. Les 5 actions locales prioritaires.
4. Les textes à revérifier avec un juriste et les démarches à faire (CDP, ANC, ARTP, agrément paiement), avec la mention « à vérifier » quand l'information manque.

## Commandes utiles

```bash
# Simuler un réseau lent (Lighthouse, profil mobile bridé)
npx lighthouse http://localhost:3000 --form-factor=mobile --throttling.rttMs=300 --throttling.throughputKbps=700 --throttling.cpuSlowdownMultiplier=4

# Poids de la page d'accueil
curl -s -o /dev/null -w "%{size_download} octets\n" --compressed http://localhost:3000

# Latence vers des régions candidates depuis une machine à Dakar
for h in <host-region-1> <host-region-2>; do curl -o /dev/null -s -w "$h %{time_connect}s\n" https://$h; done

# Langues et traductions
find . -path "*/locales/*" -o -path "*/i18n/*" | grep -v node_modules | head
grep -rEn "['\"](fr|wo|ff|en)['\"]" --include=*.{ts,tsx,js,json} src/ | head

# Paiement local, canaux et formats
grep -rEin "wave|orange.?money|free.?money|paydunya|cinetpay|paytech|xof|fcfa" --include=*.{py,ts,js,json} . | grep -v node_modules
grep -rEin "whatsapp|twilio|ussd|sms|africastalking|ivr" --include=*.{py,ts,js,json} . | grep -v node_modules
grep -rEn "\+221|00221|Africa/Dakar" --include=*.{py,ts,js} . | grep -v node_modules
```
