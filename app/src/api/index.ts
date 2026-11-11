// Point d'entrée unique des données. Les écrans n'appellent QUE ces fonctions :
// passer de l'exemple à la vraie API = VITE_USE_MOCK=false, sans toucher aux écrans.
import { config } from '../config'
import { sessionStore } from '../auth/session'
import type { DonneesInscription, Session, Utilisateur } from '../types/auth'
import type {
  LigneBesoin, LigneCarte, LigneChoixCulture, LigneSuivi, LigneTerritoireAgrodistrib, LigneVulnerabilite,
  OffreSemence, ParametresScenario, Referentiels, Scenario, Stock,
} from '../types/marts'
import { ApiError, requete, type OptionsRequete } from './client'

async function appel<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
  if (config.useMock) {
    const { requeteMock } = await import('./mock/serveur')
    try {
      return (await requeteMock(chemin, { ...options, token: sessionStore.token() })) as T
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) sessionStore.clear()
      throw e
    }
  }
  return requete<T>(chemin, options)
}

const enc = encodeURIComponent

export const api = {
  // Authentification (PostgreSQL côté API)
  login: (email: string, password: string) => appel<Session>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (donnees: DonneesInscription) => appel<Session>('/auth/register', { method: 'POST', body: donnees }),
  moi: () => appel<Utilisateur>('/auth/me'),

  // Référentiels : départements, zones, cultures, intrants, variétés, campagnes disponibles
  referentiels: () => appel<Referentiels>('/referentiels'),

  // Module A — mart_carte_agroclimat, mart_suivi_decadaire
  carte: (campagne: number) => appel<LigneCarte[]>('/carte', { params: { campagne } }),
  historique: (code: string) => appel<LigneCarte[]>(`/carte/${enc(code)}/historique`),
  suivi: (code: string, annee: number) => appel<LigneSuivi[]>(`/suivi/${enc(code)}`, { params: { annee } }),

  // Module B — mart_choix_cultures
  choixCultures: (code: string) => appel<LigneChoixCulture[]>(`/choix-cultures/${enc(code)}`),
  adequationVarietes: () => appel<LigneChoixCulture[]>('/varietes/adequation'),

  // Module C — mart_besoins
  besoins: (filtres: { code_departement?: string; culture?: string } = {}) => appel<LigneBesoin[]>('/besoins', { params: filtres }),

  // Module D — mart_vulnerabilite_departement, mart_territoires_agrodistrib, SALTIS.APP
  vulnerabilite: () => appel<LigneVulnerabilite[]>('/vulnerabilite'),
  territoires: (culture?: string | null) => appel<LigneTerritoireAgrodistrib[]>('/agrodistrib/territoires', { params: { culture } }),
  stocks: () => appel<Stock[]>('/organisations/moi/stocks'),
  enregistrerStocks: (stocks: Stock[]) => appel<Stock[]>('/organisations/moi/stocks', { method: 'PUT', body: stocks }),
  scenarios: () => appel<Scenario[]>('/agrodistrib/scenarios'),
  genererScenario: (params: ParametresScenario) => appel<Scenario>('/agrodistrib/scenarios', { method: 'POST', body: params, timeout: 60000 }),
  validerScenario: (id: number, quantites: Record<string, number>) =>
    appel<Scenario>(`/agrodistrib/scenarios/${id}/validation`, { method: 'PUT', body: { quantites } }),
  supprimerScenario: (id: number) => appel<null>(`/agrodistrib/scenarios/${id}`, { method: 'DELETE' }),

  // Associations de producteurs de semences (option B) : offre déclarée, sans scénario
  offreSemences: () => appel<OffreSemence[]>('/organisations/moi/offre-semences'),
  enregistrerOffreSemences: (offre: OffreSemence[]) => appel<OffreSemence[]>('/organisations/moi/offre-semences', { method: 'PUT', body: offre }),
}

export { ApiError }
