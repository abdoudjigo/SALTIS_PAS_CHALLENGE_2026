/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_USE_MOCK?: string
  readonly VITE_MAPBOX_TOKEN?: string
  readonly VITE_MAPBOX_STYLE?: string
  readonly VITE_ACTIVER_SEMENCIERS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
