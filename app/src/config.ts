// Configuration lue au build (variables VITE_*). Aucune de ces valeurs n'est secrète.
const env = import.meta.env

export const config = {
  apiUrl: (env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, ''),
  useMock: String(env.VITE_USE_MOCK ?? 'true') === 'true',
  mapboxToken: env.VITE_MAPBOX_TOKEN || '',
  mapboxStyle: env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/light-v11',
  /** Profil « association de producteurs de semences » (option B, cible à confirmer) */
  activerSemenciers: String(env.VITE_ACTIVER_SEMENCIERS ?? 'true') === 'true',
  /** Campagne proposée par défaut dans AgroDistrib : dernière campagne avec des données */
  campagneParDefaut: 2026,
} as const
