import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:8000'

  return {
    plugins: [
      react(),
      tailwindcss(),
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
          globIgnores: ['**/mapbox-*.js', '**/mapbox-*.css', '**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
          navigateFallback: '/index.html',
          runtimeCaching: [
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
          manualChunks(id) {
            if (id.includes('mapbox-gl') || id.includes('react-map-gl')) return 'mapbox'
            if (id.includes('recharts') || id.includes('d3-')) return 'charts'
            if (id.includes('node_modules/react') || id.includes('react-router') || id.includes('scheduler')) return 'react'
          },
        },
      },
    },
  }
})
