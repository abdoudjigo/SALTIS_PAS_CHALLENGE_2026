# Module 07 : sécurité

> Prérequis : `audit/01-cartographie.md` (et idéalement 03, 04, 05)
> Rapport : `audit/07-securite.md` · Préfixe des constats : `SEC`

## Rôle

Tu es expert en sécurité applicative. Tu fais une revue de code orientée sécurité et une analyse de configuration, **sans attaquer** de système en ligne : pas de scan ni de test d'intrusion sur des URL de prod ou de staging sans autorisation écrite. Règles et format dans `README.md`. Masque toujours les secrets.

Référentiels : OWASP Top 10 (2021, et version 2025 si disponible), OWASP API Security Top 10, OWASP ASVS niveau 1 à 2.

## Points de contrôle

### Secrets
- [ ] Secrets dans le code, les configs, l'historique git, les notebooks, les fichiers `.env` commités.
- [ ] `.gitignore` couvre `.env*`, clés, dumps, `*.pem`.
- [ ] Secrets côté front (variables publiques) : uniquement des clés réellement publiques.
- [ ] Gestion des secrets en prod (variables de plateforme, coffre) et rotation possible.
- [ ] **Tout secret trouvé dans l'historique = 🔴, à révoquer**, même s'il a été supprimé depuis.

### Authentification et sessions
- [ ] Mots de passe hachés (bcrypt, argon2) ; aucune implémentation maison de crypto.
- [ ] JWT : algorithme fixé, secret fort, expiration courte, refresh token, révocation.
- [ ] Cookies `HttpOnly`, `Secure`, `SameSite` ; protection CSRF si cookies de session.
- [ ] Protection contre la force brute (rate limiting, verrouillage) ; OTP SMS limités en tentatives et en envois.
- [ ] Réinitialisation de mot de passe : jetons à usage unique, expiration, pas d'énumération de comptes.

### Autorisation (cause n°1 des fuites)
- [ ] Chaque endpoint vérifie **l'identité et le droit sur la ressource** (IDOR / BOLA : `GET /users/123` accessible par l'utilisateur 456 ?).
- [ ] Contrôle des rôles côté serveur, pas seulement en masquant des boutons.
- [ ] Mass assignment : un utilisateur peut-il envoyer `role: "admin"` ou `is_verified: true` ?
- [ ] RLS (Supabase) / règles (Firebase) revues table par table.

### Injections et entrées
- [ ] SQL / NoSQL : requêtes paramétrées partout.
- [ ] XSS : rendu de contenu utilisateur ou de réponse LLM sans assainissement.
- [ ] Commandes système, `eval`, désérialisation non sûre (`pickle`, `yaml.load`).
- [ ] SSRF : URL fournies par l'utilisateur et récupérées par le serveur.
- [ ] Upload de fichiers : type vérifié côté serveur, taille limitée, stockage hors racine web, noms régénérés.
- [ ] Path traversal sur les chemins de fichiers.

### Configuration et transport
- [ ] HTTPS partout, HSTS.
- [ ] En-têtes : CSP, `X-Content-Type-Options`, `X-Frame-Options` / `frame-ancestors`, `Referrer-Policy`.
- [ ] CORS restreint aux origines connues (pas `*` avec credentials).
- [ ] Mode debug désactivé en prod, pas de stack trace exposée, pas d'endpoints de dev ouverts (`/docs`, `/admin`, `/graphql` playground) sans protection.
- [ ] Bases, Redis, stockage objet non exposés publiquement ; buckets privés par défaut.

### Dépendances et chaîne d'approvisionnement
- [ ] Vulnérabilités connues (`npm audit`, `pip-audit`, `osv-scanner`) : liste des 🔴/🟠 avec version corrective.
- [ ] Lockfiles présents et commités ; dépendances épinglées.
- [ ] Images Docker de base à jour, utilisateur non root.
- [ ] Mises à jour automatisées (Dependabot, Renovate).

### Journalisation et réponse à incident
- [ ] Événements de sécurité journalisés (connexions, échecs, changements de droits) sans données sensibles dans les logs.
- [ ] Alertes sur anomalies ; procédure en cas de fuite (qui prévenir, comment révoquer).

### Données personnelles
- [ ] Chiffrement en transit et au repos ; accès aux données de prod tracés.
- [ ] Conformité : loi sénégalaise n° 2008-12 et CDP ; RGPD si concerné (renvoi au module 05).

### Cadre et risques locaux
- [ ] Loi sénégalaise n° 25/2026 sur les infrastructures d'information critiques et la sécurité numérique (Autorité nationale de Cybersécurité) : la plateforme ou ses clients sont-ils concernés ? Exigences contractuelles qui en découlent.
- [ ] Fraudes fréquentes dans la région : SIM swap, détournement d'OTP SMS, arnaques WhatsApp, fraude au mobile money (détail dans le module 13).

### Sécurité IA
- [ ] Renvoi au module 06 : injection de prompt, fuite de contexte, sorties non fiables, abus de coût.

## Livrables du rapport

1. Note /5 et niveau de maturité estimé (ASVS L0 / L1 / L2).
2. Tableau OWASP Top 10 : catégorie, statut (OK / partiel / KO / non applicable), constats liés.
3. Constats `SEC-xx` au format standard, les 🔴 en premier, chacun avec un scénario d'exploitation en une phrase.
4. Liste des secrets à révoquer (fichier + type, valeur masquée).
5. Plan de remédiation : J+1, J+7, J+30.

## Commandes utiles

```bash
gitleaks detect --source . --verbose --redact          # ou: trufflehog git file://. --only-verified
git log -p --all -S "API_KEY" --oneline | head
npm audit --omit=dev; npx better-npm-audit audit
pip-audit; osv-scanner -r .
semgrep --config p/owasp-top-ten --config p/secrets .
bandit -r . -x ./node_modules,./venv                   # Python
grep -rEn "eval\(|exec\(|pickle\.loads|yaml\.load\(|subprocess.*shell=True|child_process" .
grep -rEn "cors\(|Access-Control-Allow-Origin|allow_origins" .
grep -rEn "DEBUG *= *True|NODE_ENV.*development" .
trivy fs .; trivy image <image>                         # conteneurs
```
