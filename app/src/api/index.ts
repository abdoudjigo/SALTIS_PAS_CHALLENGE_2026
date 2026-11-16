// Point d'entrée unique des données. Les écrans n'appellent QUE ces fonctions.
// Données : l'API (marts et prévisions) ; en mode démonstration (config.donneesDemo), le faux serveur de api/mock.
// Entrée par profil : session locale (api/mock/comptes.ts), l'API n'a pas de comptes.
import { config } from '../config'
import { sessionStore } from '../auth/session'
import type { Session, Utilisateur } from '../types/auth'
import type {
  Departement, LigneBesoin, LigneCarte, LigneChoixCulture, LigneTerritoireAgrodistrib, LigneVulnerabilite, Referentiels,
} from '../types/marts'
import type { CodeModele, EvaluationModele, Moment, Prevision, PrevisionRendement, PrevisionSaison, RisqueSemis } from '../types/previsions'
import { ApiError, requete, type OptionsRequete } from './client'

// Routes servies par le faux serveur du front (mêmes formats que le contrat attendu)
async function exemple<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
  const { requeteMock } = await import('./mock/serveur')
  try {
    return (await requeteMock(chemin, { ...options, token: sessionStore.token() })) as T
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) sessionStore.clear('expiree')
    throw e
  }
}

// Entrée par profil (agriculteur, ou ONG et services de l'État) : l'API n'a pas de comptes, la session reste locale.
const auth = <T,>(chemin: string, options: OptionsRequete = {}) => exemple<T>(chemin, options)

// Données des marts : API réelle sous /api/v1, réponses { meta, donnees }.
// Le jeton de démonstration n'est pas envoyé à l'API de données, qui ne le connaît pas.
async function marts<T>(chemin: string, params?: OptionsRequete['params']): Promise<T> {
  const reponse = await requete<{ donnees: T }>(`/api/v1${chemin}`, { params, sansJeton: config.authDemo })
  return reponse.donnees
}

const enc = encodeURIComponent


// Résultats des modèles d'IA (SALTIS.ML) : on garde `meta.avertissements`, les rappels d'affichage honnête.
// Les données d'exemple n'ont pas de prévisions : même réponse que l'API quand SALTIS.ML n'est pas chargé.
async function previsions<T>(chemin: string, params?: OptionsRequete['params']): Promise<Prevision<T>> {
  if (config.donneesDemo)
    throw new ApiError('Les prévisions ne font pas partie des données de démonstration.', { status: 404, details: { erreur: { code: 'prevision_indisponible' } } })
  const reponse = await requete<{ meta: { avertissements?: string[]; source?: string }; donnees: T[] }>(`/api/v1/previsions${chemin}`, { params, sansJeton: config.authDemo })
  return { donnees: reponse.donnees, avertissements: reponse.meta.avertissements ?? [], source: reponse.meta.source ?? '' }
}

async function referentielsReels(): Promise<Referentiels> {
  const [departements, zones, cultures, periodes, { INTRANTS, VARIETES }] = await Promise.all([
    marts<Departement[]>('/referentiels/departements'),
    marts<{ zone_agroecologique: string }[]>('/referentiels/zones'),
    marts<{ culture: string }[]>('/referentiels/cultures'),
    marts<{ campagnes_agroclimat: number[] }>('/referentiels/periodes'),
    // L'API n'expose pas encore dim_intrant ni dim_variete : libellés repris du référentiel du front
    import('./mock/referentiel'),
  ])
  return {
    departements,
    zones: zones.map((z) => z.zone_agroecologique),
    cultures: cultures.map((c) => c.culture),
    campagnes: periodes.campagnes_agroclimat,
    intrants: INTRANTS,
    varietes: VARIETES,
  }
}

// Pas de route « tous les départements » : on lit les 45 réponses, déjà précalculées par l'API
async function besoinsReels({ code_departement, culture }: { code_departement?: string; culture?: string }): Promise<LigneBesoin[]> {
  if (code_departement) return marts<LigneBesoin[]>(`/besoins/departements/${enc(code_departement)}`, { culture })
  const departements = await marts<Departement[]>('/referentiels/departements')
  const parDepartement = await Promise.all(departements.map((d) => marts<LigneBesoin[]>(`/besoins/departements/${enc(d.code_departement)}`, { culture })))
  return parDepartement.flat()
}

// Guédiawaye n'a pas de série décadaire : l'API répond 404, l'écran attend une liste vide
const reel = !config.donneesDemo

export const api = {
  // Authentification (PostgreSQL côté API)
  login: (email: string, password: string) => auth<Session>('/auth/login', { method: 'POST', body: { email, password } }),
  moi: () => auth<Utilisateur>('/auth/me'),

  // Référentiels : départements, zones, cultures, intrants, variétés, campagnes disponibles
  referentiels: () => (reel ? referentielsReels() : exemple<Referentiels>('/referentiels')),

  // Module A — mart_carte_agroclimat
  carte: (campagne: number) =>
    reel ? marts<LigneCarte[]>(`/agroclimat/campagnes/${campagne}`) : exemple<LigneCarte[]>('/carte', { params: { campagne } }),

  // Module B — mart_choix_cultures
  choixCultures: (code: string) =>
    reel ? marts<LigneChoixCulture[]>(`/choix-cultures/${enc(code)}`) : exemple<LigneChoixCulture[]>(`/choix-cultures/${enc(code)}`),

  // Module C — mart_besoins
  besoins: (filtres: { code_departement?: string; culture?: string } = {}) =>
    reel ? besoinsReels(filtres) : exemple<LigneBesoin[]>('/besoins', { params: filtres }),

  // Module D — mart_vulnerabilite_departement, mart_territoires_agrodistrib
  vulnerabilite: () => (reel ? marts<LigneVulnerabilite[]>('/vulnerabilite') : exemple<LigneVulnerabilite[]>('/vulnerabilite')),
  territoires: (culture?: string | null) =>
    reel
      ? marts<LigneTerritoireAgrodistrib[]>('/agrodistrib/territoires', { culture })
      : exemple<LigneTerritoireAgrodistrib[]>('/agrodistrib/territoires', { params: { culture } }),

  // IA — résultats des 3 modèles (SALTIS.ML), voir ml/MODELES.md
  previsionSaison: (annee: number) => previsions<PrevisionSaison>(`/saison/${annee}`),
  previsionRendement: (code: string, annee: number) => previsions<PrevisionRendement>(`/rendement/${enc(code)}/${annee}`),
  alerteRecolte: (annee: number, moment: Moment, culture?: string | null) => previsions<PrevisionRendement>(`/alerte-recolte/${annee}`, { moment, culture }),
  /** sans `annee` : année type */
  risqueSemis: (code: string, annee: number | null, culture?: string | null) => previsions<RisqueSemis>(`/semis/departements/${enc(code)}`, { annee, culture }),
  carteSemis: (culture: string, annee: number | null) => previsions<RisqueSemis>('/semis/carte', { culture, annee }),
  fiabilite: (modele: CodeModele) => previsions<EvaluationModele>('/fiabilite', { modele }),

  // Voix wolof de la mascotte « WLF » : texte wolof → audio (Space Hugging Face, voir voix/README.md)
  voixParler: (texte: string) =>
    requete<{ audio_wo_base64: string }>('/api/v1/voix/parler', { method: 'POST', body: { texte }, sansJeton: true, timeout: 900000 }),
}

export { ApiError }
