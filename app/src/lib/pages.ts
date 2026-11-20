// Titre et description de chaque page publique : une seule source pour
//   - l'affichage dans le navigateur (useMeta, src/lib/meta.ts) ;
//   - le pré-rendu au build (une page HTML par adresse, avec ses balises : vite.config.ts) ;
//   - le plan du site (sitemap.xml).
// Ce fichier est aussi lu par vite.config.ts (Node) : aucun import de React ni du navigateur ici.
// Une nouvelle page s'ajoute ici, dans src/App.tsx (route) et dans @page de deploy/Caddyfile.

export const NOM_SITE = 'Assaman & Suuf'

export type InfosPage = {
  chemin: string
  /** Titre de la page ; l'onglet affiche « titre · Assaman & Suuf » (sauf l'accueil, déjà complet) */
  titre: string
  /** Pour les moteurs de recherche et les aperçus de partage : 120 à 160 caractères */
  description: string
  /** Priorité dans le plan du site ; absente = page hors plan */
  priorite?: string
  /** false : page non proposée aux moteurs de recherche */
  indexable?: boolean
}

export const ACCUEIL: InfosPage = {
  chemin: '/',
  titre: `${NOM_SITE} · Pluie, cultures et intrants au Sénégal`,
  description:
    'Aide à la décision agricole pour les 45 départements du Sénégal : pluie attendue, cultures adaptées, dates de semis et répartition des intrants.',
  priorite: '1.0',
}

export const PAGES = {
  aPropos: {
    chemin: '/a-propos',
    titre: 'À propos',
    description: "Assaman & Suuf, « le ciel et la terre » en wolof : une plateforme de l'équipe AKAI pour préparer la campagne agricole au Sénégal, du ciel à la parcelle.",
    priorite: '0.8',
  },
  methode: {
    chemin: '/methode',
    titre: 'Méthode et fiabilité',
    description: "Trois modèles d'intelligence artificielle, entraînés sur 45 ans de pluie et 25 ans de rendements, testés sur des années qu'ils n'ont jamais vues.",
    priorite: '0.8',
  },
  donnees: {
    chemin: '/donnees',
    titre: 'Données et sources',
    description: 'Les sources publiques de la plateforme : CHIRPS, NASA POWER, SoilGrids, DAPSA, FAOSTAT, NOAA et GADM. Des données nettoyées, contrôlées et testées.',
    priorite: '0.8',
  },
  contact: {
    chemin: '/contact',
    titre: 'Contact',
    description: "Contacter l'équipe AKAI : une question sur Assaman & Suuf, une donnée agricole à partager ou une collaboration à proposer pour le Sénégal.",
    priorite: '0.6',
  },
  mentionsLegales: {
    chemin: '/mentions-legales',
    titre: 'Mentions légales',
    description: "Mentions légales d'Assaman & Suuf : l'éditeur de la plateforme, la portée indicative de ses estimations et les crédits des données utilisées.",
    priorite: '0.3',
  },
  confidentialite: {
    chemin: '/confidentialite',
    titre: 'Politique de confidentialité',
    description: "Politique de confidentialité d'Assaman & Suuf : aucune création de compte, des saisies gardées dans votre navigateur, et vos droits sur vos données.",
    priorite: '0.3',
  },
  conditionsGenerales: {
    chemin: '/conditions-generales',
    titre: "Conditions générales d'utilisation",
    description: "Les règles d'usage de la plateforme : ce qu'elle propose, ce qu'elle ne garantit pas, et ce qu'on peut faire de ses contenus.",
    priorite: '0.3',
  },
  /** Servie avec le statut 404 pour toute adresse inconnue (deploy/Caddyfile) */
  introuvable: {
    chemin: '/404',
    titre: 'Page introuvable',
    description: 'Cette adresse ne mène à aucune page.',
    indexable: false,
  },
} satisfies Record<string, InfosPage>

/** Titre complet de l'onglet */
export function titreComplet(page: Pick<InfosPage, 'chemin' | 'titre'>) {
  return page.chemin === '/' ? page.titre : `${page.titre} · ${NOM_SITE}`
}
