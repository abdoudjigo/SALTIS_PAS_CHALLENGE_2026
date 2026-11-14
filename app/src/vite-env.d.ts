/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_USE_MOCK?: string
  readonly VITE_AUTH_DEMO?: string
  readonly VITE_DONNEES_DEMO?: string
  readonly VITE_MAPBOX_TOKEN?: string
  readonly VITE_MAPBOX_STYLE?: string
  readonly VITE_ACTIVER_SEMENCIERS?: string
  readonly VITE_EMAIL_CONTACT?: string
  readonly VITE_LIEN_LINKEDIN?: string
  readonly VITE_LIEN_FACEBOOK?: string
  readonly VITE_LIEN_X?: string
  readonly VITE_LIEN_YOUTUBE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
