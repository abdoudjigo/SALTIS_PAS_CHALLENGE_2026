// Point d'entrée unique des données. Les écrans n'appellent QUE ces fonctions.
// Données : l'API (marts et prévisions) ; en mode démonstration (config.donneesDemo), le faux serveur de api/mock.
// Entrée par profil : session locale (api/mock/comptes.ts), l'API n'a pas de comptes.
import { config } from '../config'
import { sessionStore } from '../auth/session'
import { cultureMontree, sansCulturesRetirees } from '../lib/cultures'
import type { Session, Utilisateur } from '../types/auth'
import type {
  CarteOpportunite, Departement, LigneBesoin, LigneCarte, LigneChoixCulture, LigneSuivi, LigneTerritoireAgrodistrib,
  LigneVulnerabilite, Referentiels,
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
// En démonstration, le faux serveur répond avec des prévisions synthétiques (api/mock/previsions.ts), signalées comme telles.
async function previsions<T>(chemin: string, params?: OptionsRequete['params']): Promise<Prevision<T>> {
  if (config.donneesDemo) {
    const r = await exemple<Prevision<T>>(`/previsions${chemin}`, { params })
    return { ...r, donnees: sansCulturesRetirees(r.donnees) }
  }
  const reponse = await requete<{ meta: { avertissements?: string[]; source?: string }; donnees: T[] }>(`/api/v1/previsions${chemin}`, { params, sansJeton: config.authDemo })
  return { donnees: sansCulturesRetirees(reponse.donnees), avertissements: reponse.meta.avertissements ?? [], source: reponse.meta.source ?? '' }
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

const reel = !config.donneesDemo

/** Une route qui répond 404 quand la donnée n'existe pas (encore) : l'écran reçoit `vide` au lieu d'une erreur. */
async function ou404<T>(appel: Promise<T>, vide: T): Promise<T> {
  try {
    return await appel
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return vide
    throw e
  }
}

// Cultures retirées de l'affichage (lib/cultures.ts) : filtrées ici, une seule fois, pour tous les écrans
const filtrer = <T,>(appel: Promise<T[]>) => appel.then(sansCulturesRetirees)
async function referentielsAffiches(appel: Promise<Referentiels>): Promise<Referentiels> {
  const r = await appel
  return { ...r, cultures: r.cultures.filter(cultureMontree), varietes: sansCulturesRetirees(r.varietes) }
}

export const api = {
  // Authentification (PostgreSQL côté API)
  login: (email: string, password: string) => auth<Session>('/auth/login', { method: 'POST', body: { email, password } }),
  moi: () => auth<Utilisateur>('/auth/me'),

  // Référentiels : départements, zones, cultures, intrants, variétés, campagnes disponibles
  referentiels: () => referentielsAffiches(reel ? referentielsReels() : exemple<Referentiels>('/referentiels')),

  // Module A — mart_carte_agroclimat
  carte: (campagne: number) =>
    reel ? marts<LigneCarte[]>(`/agroclimat/campagnes/${campagne}`) : exemple<LigneCarte[]>('/carte', { params: { campagne } }),

  // Module A — mart_suivi_decadaire. Guédiawaye n'a pas de série décadaire : l'API répond 404, l'écran reçoit une liste vide
  suiviDecadaire: (code: string, annee: number) =>
    ou404(reel ? marts<LigneSuivi[]>(`/suivi-decadaire/${enc(code)}/${annee}`) : exemple<LigneSuivi[]>(`/suivi/${enc(code)}`, { params: { annee } }), []),

  // Module B — mart_choix_cultures
  choixCultures: (code: string) =>
    filtrer(reel ? marts<LigneChoixCulture[]>(`/choix-cultures/${enc(code)}`) : exemple<LigneChoixCulture[]>(`/choix-cultures/${enc(code)}`)),

  // Module C — mart_besoins
  besoins: (filtres: { code_departement?: string; culture?: string } = {}) =>
    filtrer(reel ? besoinsReels(filtres) : exemple<LigneBesoin[]>('/besoins', { params: filtres })),

  // Module D — mart_vulnerabilite_departement, mart_territoires_agrodistrib
  vulnerabilite: () => (reel ? marts<LigneVulnerabilite[]>('/vulnerabilite') : exemple<LigneVulnerabilite[]>('/vulnerabilite')),
  territoires: (culture?: string | null) =>
    filtrer(reel
      ? marts<LigneTerritoireAgrodistrib[]>('/agrodistrib/territoires', { culture })
      : exemple<LigneTerritoireAgrodistrib[]>('/agrodistrib/territoires', { params: { culture } })),

  // Module E — mart_carte_opportunites (docs/carte-opportunites.md). null tant que le mart n'est pas construit
  // (l'API répond 404 opportunites_indisponible) : l'écran n'affiche alors rien de plus
  opportunites: () =>
    ou404<CarteOpportunite[] | null>(reel ? marts<CarteOpportunite[]>('/opportunites') : exemple<CarteOpportunite[]>('/opportunites'), null),
  opportunite: (code: string) =>
    ou404<CarteOpportunite | null>(reel ? marts<CarteOpportunite>(`/opportunites/${enc(code)}`) : exemple<CarteOpportunite>(`/opportunites/${enc(code)}`), null),

  // IA — résultats des 4 modèles (SALTIS.ML), voir ml/MODELES.md
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
