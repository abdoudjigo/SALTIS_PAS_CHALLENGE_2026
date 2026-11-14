// Point d'entrée unique des données. Les écrans n'appellent QUE ces fonctions :
// passer de l'exemple à la vraie API = VITE_USE_MOCK=false, sans toucher aux écrans.
// L'authentification et les données se règlent séparément (config.authDemo, config.donneesDemo).
import { config } from '../config'
import { sessionStore } from '../auth/session'
import type { DonneesInscription, Session, Utilisateur } from '../types/auth'
import type {
  Departement, LigneBesoin, LigneCarte, LigneChoixCulture, LigneSuivi, LigneTerritoireAgrodistrib, LigneVulnerabilite,
  OffreSemence, ParametresScenario, Referentiels, Scenario, Stock,
} from '../types/marts'
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

// Authentification : comptes de démonstration tant que le back n'existe pas (config.authDemo)
const auth = <T,>(chemin: string, options: OptionsRequete = {}) =>
  config.authDemo ? exemple<T>(chemin, options) : requete<T>(chemin, options)

// Données applicatives (stocks, scénarios, offre de semences) : PostgreSQL côté API, pas encore exposé.
// Elles restent sur le faux serveur, même quand les données des marts viennent de la vraie API.
const applicatif = exemple

// Données des marts : API réelle sous /api/v1, réponses { meta, donnees }.
// Le jeton de démonstration n'est pas envoyé à l'API de données, qui ne le connaît pas.
async function marts<T>(chemin: string, params?: OptionsRequete['params']): Promise<T> {
  const reponse = await requete<{ donnees: T }>(`/api/v1${chemin}`, { params, sansJeton: config.authDemo })
  return reponse.donnees
}

const enc = encodeURIComponent

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
const suiviReel = (code: string, annee: number) =>
  marts<LigneSuivi[]>(`/suivi-decadaire/${enc(code)}/${annee}`).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) return []
    throw e
  })

const reel = !config.donneesDemo

export const api = {
  // Authentification (PostgreSQL côté API)
  login: (email: string, password: string) => auth<Session>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (donnees: DonneesInscription) => auth<Session>('/auth/register', { method: 'POST', body: donnees }),
  moi: () => auth<Utilisateur>('/auth/me'),

  // Référentiels : départements, zones, cultures, intrants, variétés, campagnes disponibles
  referentiels: () => (reel ? referentielsReels() : exemple<Referentiels>('/referentiels')),

  // Module A — mart_carte_agroclimat, mart_suivi_decadaire
  carte: (campagne: number) =>
    reel ? marts<LigneCarte[]>(`/agroclimat/campagnes/${campagne}`) : exemple<LigneCarte[]>('/carte', { params: { campagne } }),
  historique: (code: string) =>
    reel ? marts<LigneCarte[]>(`/agroclimat/departements/${enc(code)}`) : exemple<LigneCarte[]>(`/carte/${enc(code)}/historique`),
  suivi: (code: string, annee: number) => (reel ? suiviReel(code, annee) : exemple<LigneSuivi[]>(`/suivi/${enc(code)}`, { params: { annee } })),

  // Module B — mart_choix_cultures
  choixCultures: (code: string) =>
    reel ? marts<LigneChoixCulture[]>(`/choix-cultures/${enc(code)}`) : exemple<LigneChoixCulture[]>(`/choix-cultures/${enc(code)}`),
  // L'API n'a pas encore de route pour l'adéquation des variétés sur tous les départements
  adequationVarietes: () =>
    reel
      ? Promise.reject<LigneChoixCulture[]>(new ApiError("L'adéquation des variétés par département n'est pas encore disponible.", { status: 404 }))
      : exemple<LigneChoixCulture[]>('/varietes/adequation'),

  // Module C — mart_besoins
  besoins: (filtres: { code_departement?: string; culture?: string } = {}) =>
    reel ? besoinsReels(filtres) : exemple<LigneBesoin[]>('/besoins', { params: filtres }),

  // Module D — mart_vulnerabilite_departement, mart_territoires_agrodistrib
  vulnerabilite: () => (reel ? marts<LigneVulnerabilite[]>('/vulnerabilite') : exemple<LigneVulnerabilite[]>('/vulnerabilite')),
  territoires: (culture?: string | null) =>
    reel
      ? marts<LigneTerritoireAgrodistrib[]>('/agrodistrib/territoires', { culture })
      : exemple<LigneTerritoireAgrodistrib[]>('/agrodistrib/territoires', { params: { culture } }),

  // Module D — données de l'organisation (SALTIS.APP / PostgreSQL)
  stocks: () => applicatif<Stock[]>('/organisations/moi/stocks'),
  enregistrerStocks: (stocks: Stock[]) => applicatif<Stock[]>('/organisations/moi/stocks', { method: 'PUT', body: stocks }),
  scenarios: () => applicatif<Scenario[]>('/agrodistrib/scenarios'),
  genererScenario: (params: ParametresScenario) => applicatif<Scenario>('/agrodistrib/scenarios', { method: 'POST', body: params, timeout: 60000 }),
  validerScenario: (id: number, quantites: Record<string, number>) =>
    applicatif<Scenario>(`/agrodistrib/scenarios/${id}/validation`, { method: 'PUT', body: { quantites } }),
  supprimerScenario: (id: number) => applicatif<null>(`/agrodistrib/scenarios/${id}`, { method: 'DELETE' }),

  // Associations de producteurs de semences (option B) : offre déclarée, sans scénario
  offreSemences: () => applicatif<OffreSemence[]>('/organisations/moi/offre-semences'),
  enregistrerOffreSemences: (offre: OffreSemence[]) => applicatif<OffreSemence[]>('/organisations/moi/offre-semences', { method: 'PUT', body: offre }),
}

export { ApiError }
