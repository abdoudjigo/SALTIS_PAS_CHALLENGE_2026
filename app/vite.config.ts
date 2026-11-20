import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { ACCUEIL, PAGES, titreComplet, type InfosPage } from './src/lib/pages'

// Tout ce qui s'appelle VITE_* est écrit en clair dans le JavaScript envoyé au navigateur.
// On arrête donc le build (et le serveur de dev) si une de ces variables ressemble à un secret.
// Le seul jeton admis est le jeton PUBLIC Mapbox (pk.…), à restreindre au domaine dans le compte Mapbox.
const NOM_SECRET = /SECRET|PASSWORD|PASSWD|MOT_DE_PASSE|PRIVATE|PRIVEE|SNOWFLAKE|REDIS|HF_TOKEN|API_KEY|CLE_API|ADMIN/i
const VALEUR_SECRETE = /^(sk\.|sk-|hf_|ghp_|github_pat_|xox[abp]-|AKIA|-----BEGIN)/

function refuserLesSecrets(env: Record<string, string>) {
  const fautes = Object.entries(env)
    .filter(([nom, valeur]) => nom.startsWith('VITE_') && valeur && (NOM_SECRET.test(nom) || VALEUR_SECRETE.test(valeur.trim())))
    .map(([nom]) => nom)
  if (fautes.length) {
    throw new Error(
      `Secret dans une variable du front : ${fautes.join(', ')}. Les variables VITE_* sont publiques (visibles dans le navigateur). ` +
        "Un secret va dans le .env de l'API, jamais dans le front ; pour Mapbox, utiliser le jeton public (pk.…).",
    )
  }
}

// Adresse publique du site (https://domaine, sans / final) : les aperçus de partage (Open Graph) exigent
// des adresses complètes. Sans elle (développement), ces balises ne sont pas écrites.
function balisesDePartage(urlSite: string): Plugin {
  return {
    name: 'balises-de-partage',
    transformIndexHtml() {
      if (!urlSite) return []
      const image = `${urlSite}/pwa-512x512.png`
      return [
        { tag: 'meta', attrs: { property: 'og:image', content: image }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '512' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '512' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'twitter:image', content: image }, injectTo: 'head' },
      ]
    },
  }
}

// Les deux polices du site (jeu latin) sont demandées dès la lecture de index.html, sans attendre la feuille
// de style : le premier texte s'affiche tout de suite dans la bonne police (titre de l'accueil = plus grand élément).
function prechargerLesPolices(): Plugin {
  return {
    name: 'precharger-les-polices',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        return Object.keys(ctx.bundle ?? {})
          .filter((f) => /-latin-wght-normal-[\w-]+\.woff2$/.test(f))
          .map((f) => ({
            tag: 'link',
            attrs: { rel: 'preload', href: `/${f}`, as: 'font', type: 'font/woff2', crossorigin: '' },
            injectTo: 'head' as const,
          }))
      },
    },
  }
}

// Pré-rendu des balises : l'application n'a qu'un index.html, et un robot qui n'exécute pas JavaScript
// (aperçus WhatsApp, LinkedIn, Facebook…) n'en lirait que les balises de l'accueil. Au build, on écrit donc une
// page HTML par adresse (a-propos.html, methode.html…, 404.html), copie de index.html avec son titre, sa
// description, ses balises de partage et son adresse canonique. Le contenu reste rendu par React dans le navigateur.
// Valeurs : src/lib/pages.ts. Service : deploy/Caddyfile (et cleanUrls de vercel.json).
const TOUTES_LES_PAGES: InfosPage[] = [ACCUEIL, ...Object.values(PAGES)]

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function remplacer(html: string, motif: RegExp, valeur: string) {
  if (!motif.test(html)) throw new Error(`Pré-rendu : balise introuvable dans index.html (${motif})`)
  return html.replace(motif, valeur)
}

/** index.html avec les balises d'une page */
function avecLesBalisesDe(html: string, page: InfosPage, urlSite: string) {
  const titre = echapper(titreComplet(page))
  const description = echapper(page.description)
  const meta = (attr: 'name' | 'property', cle: string, valeur: string) => (h: string) =>
    remplacer(h, new RegExp(`<meta ${attr}="${cle}" content="[^"]*"\\s*/?>`), `<meta ${attr}="${cle}" content="${valeur}" />`)
  let h = remplacer(html, /<title>[^<]*<\/title>/, `<title>${titre}</title>`)
  for (const appliquer of [
    meta('name', 'description', description),
    meta('name', 'robots', page.indexable === false ? 'noindex, follow' : 'index, follow'),
    meta('property', 'og:title', titre),
    meta('property', 'og:description', description),
    meta('name', 'twitter:title', titre),
    meta('name', 'twitter:description', description),
  ]) h = appliquer(h)
  // Adresse de la page (partage) et adresse canonique : seulement avec l'adresse publique du site
  h = h.replace(/\s*<meta property="og:url"[^>]*>/g, '').replace(/\s*<link rel="canonical"[^>]*>/g, '')
  if (urlSite && page.indexable !== false) {
    const url = echapper(`${urlSite}${page.chemin}`)
    h = h.replace('</head>', `  <meta property="og:url" content="${url}" />\n    <link rel="canonical" href="${url}" />\n  </head>`)
  }
  return h
}

function preRendu(urlSite: string): Plugin {
  return {
    name: 'pre-rendu',
    enforce: 'post',
    // L'accueil : index.html lui-même (en développement aussi)
    transformIndexHtml: { order: 'pre', handler: (html) => avecLesBalisesDe(html, ACCUEIL, urlSite) },
    // Les autres pages : une copie de index.html (déjà construit, avec scripts et styles) par adresse
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const index = bundle['index.html']
        if (!index || index.type !== 'asset') return
        for (const page of TOUTES_LES_PAGES) {
          if (page.chemin === '/') continue
          this.emitFile({ type: 'asset', fileName: `${page.chemin.slice(1)}.html`, source: avecLesBalisesDe(String(index.source), page, urlSite) })
        }
      },
    },
  }
}

// robots.txt et sitemap.xml, écrits au build. Le plan du site exige des adresses complètes :
// sans VITE_URL_SITE, seul robots.txt est écrit, sans ligne « Sitemap ».
function plansDuSite(urlSite: string): Plugin {
  return {
    name: 'plans-du-site',
    apply: 'build',
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', "# L'API sert des données, pas des pages", 'Disallow: /api/']
      if (urlSite) {
        const jour = new Date().toISOString().slice(0, 10)
        const urls = TOUTES_LES_PAGES.filter((p) => p.priorite && p.indexable !== false).map(
          (p) => `  <url>\n    <loc>${urlSite}${p.chemin}</loc>\n    <lastmod>${jour}</lastmod>\n    <priority>${p.priorite}</priority>\n  </url>`,
        )
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
        })
        robots.push('', `Sitemap: ${urlSite}/sitemap.xml`)
      } else {
        this.warn('VITE_URL_SITE absente : sitemap.xml non généré, robots.txt sans ligne Sitemap.')
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots.join('\n') + '\n' })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  refuserLesSecrets(env)
  const apiUrl = env.VITE_API_URL || 'http://localhost:8080'
  const urlSite = (env.VITE_URL_SITE || '').replace(/\/$/, '')
  // Anti-spam : l'adresse de contact n'est pas écrite en clair dans le JavaScript (les robots ramasseurs
  // d'adresses lisent le code et les pages). Elle y est retournée puis codée en base64, et n'est reconstituée
  // dans la page qu'au clic du visiteur (src/lib/contact.ts). La variable s'appelle EMAIL_CONTACT, sans le préfixe
  // VITE_ : sinon Vite la recopierait en clair avec les autres dans import.meta.env (src/config.ts lit l'objet entier).
  const contactCode = Buffer.from([...(env.EMAIL_CONTACT || '').trim()].reverse().join(''), 'utf8').toString('base64')

  return {
    define: { __CONTACT_CODE__: JSON.stringify(contactCode) },
    plugins: [
      react(),
      tailwindcss(),
      balisesDePartage(urlSite),
      preRendu(urlSite),
      plansDuSite(urlSite),
      prechargerLesPolices(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Assaman & Suuf — Ciel & Terre',
          short_name: 'Assaman & Suuf',
          description: "Aide à la décision agricole au Sénégal : pluie, cultures, besoins et répartition des intrants.",
          lang: 'fr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#1f5f3a',
          background_color: '#f7f5ef',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // Mapbox (~1,7 Mo) n'est pas préchargé : connexions faibles. Il est mis en cache à la première ouverture de la carte.
          // Polices : seuls les jeux latins (français, wolof) sont préchargés
          globIgnores: ['**/mapbox-*.js', '**/mapbox-*.css', '**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
          navigateFallback: '/index.html',
          // Ces deux fichiers sont de vrais fichiers, pas des pages de l'application
          navigateFallbackDenylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/],
          runtimeCaching: [
            {
              // Contours de la carte et logos des sources : servis du cache, rafraîchis en arrière-plan
              urlPattern: ({ url }) => /^\/(geo|logos)\//.test(url.pathname),
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'fonds-et-logos', expiration: { maxEntries: 30 } },
            },
            {
              urlPattern: ({ url }) => /\/assets\/mapbox-.*\.(js|css)$/.test(url.pathname),
              handler: 'CacheFirst',
              options: { cacheName: 'mapbox-lib', expiration: { maxEntries: 6 } },
            },
            {
              // Données de l'API : réseau d'abord, cache si hors ligne (terrain, connexion faible)
              urlPattern: ({ url, request }) =>
                request.method === 'GET' && url.href.startsWith(apiUrl) && !url.pathname.startsWith('/auth'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-donnees',
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    server: { port: 5173 },
    preview: { port: 4173 },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          // Groupes par priorité : un module va au groupe le plus prioritaire qui le capte. Rolldown range aussi
          // dans un groupe les dépendances de ses modules ; sans priorité, React partait dans « charts » (recharts
          // en dépend), et chaque page préchargeait alors les graphiques (108 Ko compressés)
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler|clsx)[\\/]/, priority: 30 },
              { name: 'mapbox', test: /mapbox-gl|react-map-gl/, priority: 20 },
              { name: 'charts', test: /recharts|d3-/, priority: 10 },
            ],
          },
        },
      },
    },
  }
})
