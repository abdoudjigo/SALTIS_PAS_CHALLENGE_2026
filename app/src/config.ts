// Configuration lue au build (variables VITE_*). Aucune de ces valeurs n'est secrète.
const env = import.meta.env

export const config = {
  // Vide (production derrière le serveur web) : l'API est à la même adresse que le site. Absent : l'API locale.
  apiUrl: (env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/$/, ''),
  /** Comptes de démonstration (le back d'authentification n'existe pas encore). Défaut : VITE_USE_MOCK */
  authDemo: String(env.VITE_AUTH_DEMO ?? env.VITE_USE_MOCK ?? 'true') === 'true',
  /** Données d'exemple intégrées au front, au lieu de l'API. Défaut : VITE_USE_MOCK */
  donneesDemo: String(env.VITE_DONNEES_DEMO ?? env.VITE_USE_MOCK ?? 'true') === 'true',
  mapboxToken: env.VITE_MAPBOX_TOKEN || '',
  /** Vue satellite sous la parcelle : demande un compte Mapbox qui sert les tuiles satellite */
  mapboxSatellite: String(env.VITE_MAPBOX_SATELLITE ?? 'false') === 'true',
  mapboxStyle: env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/light-v11',
  /** Profil « association de producteurs de semences » (option B, cible à confirmer) */
  activerSemenciers: String(env.VITE_ACTIVER_SEMENCIERS ?? 'true') === 'true',
  /** Adresse de contact publique (pages Contact et Confidentialité). Vide = « bientôt disponible » */
  emailContact: env.VITE_EMAIL_CONTACT || '',
  /** Réseaux sociaux du pied de page. Un lien vide est affiché « bientôt » */
  reseaux: [
    { nom: 'LinkedIn', url: env.VITE_LIEN_LINKEDIN || '' },
    { nom: 'Facebook', url: env.VITE_LIEN_FACEBOOK || '' },
    { nom: 'X', url: env.VITE_LIEN_X || '' },
    { nom: 'YouTube', url: env.VITE_LIEN_YOUTUBE || '' },
  ],
  /** Campagne proposée par défaut dans AgroDistrib : dernière campagne avec des données */
  campagneParDefaut: 2026,
} as const
