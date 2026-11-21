# Module 03 : frontend

> Prérequis : `audit/01-cartographie.md`
> Rapport : `audit/03-frontend.md` · Préfixe des constats : `FE`

## Rôle

Tu es lead dev front (React / Next.js / Vue / mobile web), sensible à la performance sur réseau mobile et à l'accessibilité. Lecture seule ; règles et format dans `README.md`. Commence par les parcours critiques listés dans la cartographie.

## Points de contrôle

### Structure et code
- [ ] Organisation des composants (par fonctionnalité, design system, composants réutilisables vs copiés-collés).
- [ ] Taille des composants : signale ceux de plus de 300 lignes et ceux qui mélangent fetch, état et rendu.
- [ ] TypeScript : `strict` activé ? Nombre de `any`, `@ts-ignore`, `as unknown as`.
- [ ] Gestion d'état cohérente (un seul outil, pas d'état serveur dupliqué en global ; React Query / SWR pour le cache serveur).
- [ ] Appels API centralisés (client unique, gestion d'erreur et de token commune).

### Performance
- [ ] Poids du bundle et des pages : lance le build et relève les tailles (`next build`, `vite build`, analyseur de bundle).
- [ ] Code splitting et lazy loading des routes et des composants lourds (cartes, graphiques, éditeurs).
- [ ] Images : formats modernes (WebP/AVIF), dimensions, `loading="lazy"`, composant optimisé.
- [ ] Polices : nombre, `font-display`, auto-hébergement.
- [ ] Rendu : SSR/SSG/ISR utilisé à bon escient ; pas de re-rendus en cascade (dépendances de `useEffect`, objets recréés à chaque rendu).
- [ ] Cible Core Web Vitals : LCP < 2,5 s, INP < 200 ms, CLS < 0,1. Teste en profil « 3G lente / mobile moyen de gamme ».

### UX et robustesse
- [ ] États de chargement, d'erreur et de liste vide sur chaque écran qui charge des données.
- [ ] Comportement hors ligne ou en coupure réseau : message clair, retry, pas de perte de saisie.
- [ ] Formulaires : validation côté client (et rappel que le serveur doit revalider), messages compréhensibles.
- [ ] Responsive testé sur petits écrans (360 px).
- [ ] i18n : textes externalisés, pas de chaînes en dur, prise en charge du français et du wolof si prévu (formats de date, de nombre, de devise FCFA).

### Accessibilité (WCAG 2.2 AA)
- [ ] HTML sémantique, titres hiérarchisés, `alt` sur les images, labels sur les champs.
- [ ] Navigation clavier et focus visible.
- [ ] Contrastes suffisants (attention aux thèmes néon sur fond sombre).
- [ ] Composants interactifs custom avec rôles ARIA corrects.

### Sécurité côté client
- [ ] Aucun secret dans le bundle : cherche les clés dans les variables `NEXT_PUBLIC_*`, `VITE_*`, `REACT_APP_*` et dans le build.
- [ ] Pas de `dangerouslySetInnerHTML` / `v-html` sur du contenu non assaini (en particulier les réponses de chatbot rendues en Markdown).
- [ ] Tokens : stockage (cookie `HttpOnly` préférable au `localStorage`), expiration, déconnexion.

### SEO (si site public)
- [ ] Balises title/description, Open Graph, sitemap, robots.txt, URLs propres, données structurées.

## Livrables du rapport

1. Note /5 et tableau de synthèse : Code · Performance · UX · Accessibilité · Sécurité · SEO (note /5 chacun).
2. Mesures relevées (tailles de bundle, scores Lighthouse si possible).
3. Constats `FE-xx` au format standard.
4. Top 5 des gains rapides (effort S, impact visible).

## Commandes utiles

```bash
npm run lint; npx tsc --noEmit
npm run build                     # relever la taille des pages et des chunks
npx vite-bundle-visualizer        # ou ANALYZE=true next build avec @next/bundle-analyzer
npx lighthouse http://localhost:3000 --preset=desktop --output=json --quiet
npx lighthouse http://localhost:3000 --form-factor=mobile --throttling-method=simulate
npx @axe-core/cli http://localhost:3000
grep -rn "dangerouslySetInnerHTML\|v-html\|localStorage.setItem" src/
grep -rEn ": any\b|as any|@ts-ignore" src/ | wc -l
npx depcheck                      # dépendances inutilisées
```
