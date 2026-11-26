/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_USE_MOCK?: string
  readonly VITE_AUTH_DEMO?: string
  readonly VITE_DONNEES_DEMO?: string
  readonly VITE_MAPBOX_TOKEN?: string
  readonly VITE_MAPBOX_SATELLITE?: string
  readonly VITE_MAPBOX_STYLE?: string
  readonly VITE_ACTIVER_SEMENCIERS?: string
  readonly VITE_URL_SITE?: string
  readonly VITE_UMAMI_ID?: string
  readonly VITE_LIEN_LINKEDIN?: string
  readonly VITE_LIEN_FACEBOOK?: string
  readonly VITE_LIEN_X?: string
  readonly VITE_LIEN_YOUTUBE?: string
}

/** Adresse de contact codée au build (vite.config.ts), décodée par src/lib/contact.ts */
declare const __CONTACT_CODE__: string

interface ImportMeta {
  readonly env: ImportMetaEnv
}
