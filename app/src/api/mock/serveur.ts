// Faux serveur utilisé quand VITE_USE_MOCK=true. Il répond aux mêmes routes que l'API attendue
// (voir app/README.md, « Contrat d'API attendu »), avec les mêmes formats.
import type { Organisation, Session, Utilisateur } from '../../types/auth'
import type {
  ColonneBesoin, NiveauDestination, OffreSemence, ParametresScenario, Proposition, Referentiels, Scenario, Stock,
} from '../../types/marts'
import { ApiError, type OptionsRequete, type Params } from '../client'
import { MOT_DE_PASSE_DEMO, UTILISATEURS_DEMO } from './comptes'
import {
  CAMPAGNES, adequationVarietes, besoins, carteAgroclimat, choixCultures, historiqueDepartement, suiviDecadaire,
  territoiresAgrodistrib, vulnerabilite,
} from './generateurs'
import { routesSynthetiques } from './previsions'
import { CULTURES, DEPARTEMENTS, INTRANTS, VARIETES, ZONES } from './referentiel'

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

type CompteMock = Utilisateur & { mot_de_passe?: string }

// État persistant du faux serveur (stocks, offres, scénarios, comptes créés), dans le navigateur
interface EtatMock {
  stocks: Record<number, Stock[]>
  offres: Record<number, OffreSemence[]>
  scenarios: Scenario[]
  comptes: CompteMock[]
}
const CLE_ETAT = 'assaman.mock'
function lireEtat(): Partial<EtatMock> {
  try {
    return JSON.parse(localStorage.getItem(CLE_ETAT) ?? '{}') as Partial<EtatMock>
  } catch {
    return {}
  }
}
const etat: EtatMock = { stocks: {}, offres: {}, scenarios: [], comptes: [], ...lireEtat() }
function sauver() {
  try {
    localStorage.setItem(CLE_ETAT, JSON.stringify(etat))
  } catch {
    /* ignoré */
  }
}

const tousLesComptes = (): CompteMock[] => [...UTILISATEURS_DEMO, ...etat.comptes]
function sansMotDePasse({ mot_de_passe: _, ...user }: CompteMock): Utilisateur {
  return user
}
function session(u: CompteMock): Session {
  return { access_token: `demo-${u.id}`, token_type: 'bearer', user: sansMotDePasse(u) }
}
function utilisateurDuJeton(token: string | null | undefined) {
  const id = Number(String(token ?? '').replace('demo-', ''))
  return tousLesComptes().find((u) => u.id === id)
}
function exigerOrganisation(user: Utilisateur | undefined): Organisation {
  if (!user?.organisation) throw new ApiError('Réservé aux organisations.', { status: 403 })
  return user.organisation
}

// --- AgroDistrib : proposition de répartition (indicative) --------------------
const CLES_NIVEAU: Record<NiveauDestination, (t: { zone_agroecologique: string; code_region: string; region: string; code_departement: string; departement: string }) => [string, string]> = {
  ZONE: (t) => [t.zone_agroecologique, t.zone_agroecologique],
  REGION: (t) => [t.code_region, t.region],
  DEPARTEMENT: (t) => [t.code_departement, t.departement],
}

interface Groupe {
  code_territoire: string
  territoire: string
  besoin_t: number
  vul: [number, number][]
  departements: Set<string>
  vulnerabilite_moyenne: number | null
  poids: number
  alloue: number
}

/**
 * Répartition proportionnelle pondérée, plafonnée au besoin.
 * poids = besoin × (1 − w + w × vulnérabilité / 50), w = poids_vulnerabilite / 100.
 * Algorithme d'exemple : l'algorithme réel sera fourni par l'API (méthode et version tracées).
 */
function genererScenario(params: ParametresScenario, organisation: Organisation): Scenario {
  const { code_intrant, quantite_t, campagne, niveau_destination, cultures = [], poids_vulnerabilite = 30 } = params
  const intrant = INTRANTS.find((i) => i.code_intrant === code_intrant)
  if (!intrant) throw new ApiError('Intrant inconnu', { status: 422 })
  if (!(quantite_t > 0)) throw new ApiError('La quantité doit être positive', { status: 422 })
  const col: ColonneBesoin = intrant.colonne_besoin

  const lignes = territoiresAgrodistrib().filter((t) => !cultures.length || cultures.includes(t.culture))
  const sansDose = lignes.filter((t) => t[col] === null)

  // Agrégation au niveau choisi : somme des besoins départementaux (jamais une valeur de zone recopiée)
  const groupes = new Map<string, Groupe>()
  lignes.forEach((t) => {
    const besoin = t[col]
    if (besoin === null || besoin <= 0) return
    const [code, nom] = CLES_NIVEAU[niveau_destination](t)
    const g = groupes.get(code) ?? { code_territoire: code, territoire: nom, besoin_t: 0, vul: [], departements: new Set(), vulnerabilite_moyenne: null, poids: 0, alloue: 0 }
    g.besoin_t += besoin
    if (t.score_vulnerabilite !== null) g.vul.push([t.score_vulnerabilite, besoin])
    g.departements.add(t.code_departement)
    groupes.set(code, g)
  })

  const w = poids_vulnerabilite / 100
  const territoires = [...groupes.values()]
  territoires.forEach((g) => {
    const poidsVul = g.vul.reduce((a, [, b]) => a + b, 0)
    g.vulnerabilite_moyenne = poidsVul ? g.vul.reduce((a, [v, b]) => a + v * b, 0) / poidsVul : null
    g.poids = g.besoin_t * (1 - w + (w * (g.vulnerabilite_moyenne ?? 50)) / 50)
  })

  // Remplissage itératif : on redistribue ce qui dépasse le besoin
  let reste = quantite_t
  for (let tour = 0; tour < 20 && reste > 0.01; tour++) {
    const ouverts = territoires.filter((t) => t.besoin_t - t.alloue > 0.01)
    const total = ouverts.reduce((a, t) => a + t.poids, 0)
    if (!total) break
    let distribue = 0
    ouverts.forEach((t) => {
      const part = Math.min((reste * t.poids) / total, t.besoin_t - t.alloue)
      t.alloue += part
      distribue += part
    })
    reste -= distribue
  }

  const r1 = (x: number) => Math.round(x * 10) / 10
  const propositions: Proposition[] = territoires
    .map((t) => ({
      niveau_destination,
      code_territoire: t.code_territoire,
      territoire: t.territoire,
      nb_departements: t.departements.size,
      besoin_t: r1(t.besoin_t),
      quantite_proposee_t: r1(t.alloue),
      quantite_validee_t: null,
      taux_couverture_pct: r1((t.alloue / t.besoin_t) * 100),
      vulnerabilite_moyenne: t.vulnerabilite_moyenne === null ? null : r1(t.vulnerabilite_moyenne),
    }))
    .sort((a, b) => b.quantite_proposee_t - a.quantite_proposee_t)

  return {
    id: Date.now(),
    organisation_id: organisation.id,
    statut: 'PROPOSE',
    cree_le: new Date().toISOString(),
    campagne,
    code_intrant,
    nom_intrant: intrant.nom_intrant,
    quantite_t,
    niveau_destination,
    methode: 'prorata_besoin_pondere_vulnerabilite',
    version_algorithme: 'demo-0.1',
    parametres: { cultures, poids_vulnerabilite },
    besoin_total_t: r1(territoires.reduce((a, t) => a + t.besoin_t, 0)),
    total_propose_t: r1(quantite_t - reste),
    reste_non_reparti_t: r1(reste),
    nb_couples_sans_dose: sansDose.length,
    propositions,
  }
}

// --- Routes ---------------------------------------------------------------------
interface Contexte {
  m: RegExpMatchArray
  params: Params
  body: unknown
  user: CompteMock | undefined
}
type Route = [OptionsRequete['method'], RegExp, (c: Contexte) => unknown]

const corps = <T,>(body: unknown) => (body ?? {}) as T

const routes: Route[] = [
  ['POST', /^\/auth\/login$/, ({ body }) => {
    const { email, password } = corps<{ email?: string; password?: string }>(body)
    const u = tousLesComptes().find((x) => x.email === email?.trim().toLowerCase())
    if (!u || password !== (u.mot_de_passe ?? MOT_DE_PASSE_DEMO)) throw new ApiError('Email ou mot de passe incorrect.', { status: 400 })
    return session(u)
  }],
  ['POST', /^\/auth\/register$/, ({ body }) => {
    const b = corps<{ email?: string; password?: string; nom?: string; code_departement?: string }>(body)
    const email = b.email?.trim().toLowerCase()
    if (!email || !b.password || !b.nom) throw new ApiError('Champs obligatoires manquants.', { status: 422 })
    if (tousLesComptes().some((u) => u.email === email)) throw new ApiError('Un compte existe déjà avec cet email.', { status: 409 })
    const u: CompteMock = { id: 100 + etat.comptes.length, email, nom: b.nom, role: 'PRODUCTEUR', organisation: null,
      code_departement: b.code_departement || null, mot_de_passe: b.password }
    etat.comptes.push(u)
    sauver()
    return session(u)
  }],
  ['GET', /^\/auth\/me$/, ({ user }) => user && sansMotDePasse(user)],

  ['GET', /^\/referentiels$/, (): Referentiels => ({ departements: DEPARTEMENTS, zones: ZONES, cultures: CULTURES, intrants: INTRANTS, varietes: VARIETES, campagnes: CAMPAGNES })],
  ['GET', /^\/carte$/, ({ params }) => carteAgroclimat(Number(params.campagne) || CAMPAGNES[CAMPAGNES.length - 1])],
  ['GET', /^\/carte\/([^/]+)\/historique$/, ({ m }) => historiqueDepartement(decodeURIComponent(m[1]))],
  ['GET', /^\/suivi\/([^/]+)$/, ({ m, params }) => suiviDecadaire(decodeURIComponent(m[1]), Number(params.annee) || CAMPAGNES[CAMPAGNES.length - 1])],
  ['GET', /^\/choix-cultures\/([^/]+)$/, ({ m }) => choixCultures(decodeURIComponent(m[1]))],
  ['GET', /^\/varietes\/adequation$/, () => adequationVarietes()],
  ['GET', /^\/besoins$/, ({ params }) => besoins().filter((b) =>
    (!params.code_departement || b.code_departement === params.code_departement) && (!params.culture || b.culture === params.culture))],
  ['GET', /^\/vulnerabilite$/, () => vulnerabilite()],
  // Prévisions des modèles et carte des opportunités : données synthétiques (mode démonstration seulement)
  ...(routesSynthetiques as Route[]),
  ['GET', /^\/agrodistrib\/territoires$/, ({ params }) => territoiresAgrodistrib().filter((t) => !params.culture || t.culture === params.culture)],

  ['GET', /^\/organisations\/moi\/stocks$/, ({ user }) => etat.stocks[exigerOrganisation(user).id] ?? []],
  ['PUT', /^\/organisations\/moi\/stocks$/, ({ user, body }) => {
    etat.stocks[exigerOrganisation(user).id] = corps<Stock[]>(body)
    sauver()
    return etat.stocks[user!.organisation!.id]
  }],
  ['GET', /^\/organisations\/moi\/offre-semences$/, ({ user }) => etat.offres[exigerOrganisation(user).id] ?? []],
  ['PUT', /^\/organisations\/moi\/offre-semences$/, ({ user, body }) => {
    etat.offres[exigerOrganisation(user).id] = corps<OffreSemence[]>(body)
    sauver()
    return etat.offres[user!.organisation!.id]
  }],
  ['GET', /^\/agrodistrib\/scenarios$/, ({ user }) => etat.scenarios.filter((s) => s.organisation_id === user?.organisation?.id)],
  ['POST', /^\/agrodistrib\/scenarios$/, ({ user, body }) => {
    const s = genererScenario(corps<ParametresScenario>(body), exigerOrganisation(user))
    etat.scenarios = [s, ...etat.scenarios].slice(0, 20)
    sauver()
    return s
  }],
  ['PUT', /^\/agrodistrib\/scenarios\/(\d+)\/validation$/, ({ m, body }) => {
    const s = etat.scenarios.find((x) => x.id === Number(m[1]))
    if (!s) throw new ApiError('Scénario introuvable', { status: 404 })
    const { quantites = {} } = corps<{ quantites?: Record<string, number> }>(body)
    s.propositions.forEach((p) => {
      p.quantite_validee_t = quantites[p.code_territoire] ?? p.quantite_proposee_t
    })
    s.statut = 'VALIDE'
    s.valide_le = new Date().toISOString()
    sauver()
    return s
  }],
  ['DELETE', /^\/agrodistrib\/scenarios\/(\d+)$/, ({ m }) => {
    etat.scenarios = etat.scenarios.filter((x) => x.id !== Number(m[1]))
    sauver()
    return null
  }],
]

const PUBLIQUES = ['/auth/login', '/auth/register', '/referentiels']

export async function requeteMock(chemin: string, { method = 'GET', params = {}, body, token }: OptionsRequete & { token?: string | null } = {}): Promise<unknown> {
  await pause(120 + Math.random() * 180) // latence réaliste : les états de chargement restent visibles
  const route = routes.find(([m, re]) => m === method && re.test(chemin))
  if (!route) throw new ApiError(`Route d'exemple absente : ${method} ${chemin}`, { status: 404 })
  const user = utilisateurDuJeton(token)
  if (!PUBLIQUES.includes(chemin) && !user) throw new ApiError('Session expirée, reconnectez-vous.', { status: 401 })
  return structuredClone(route[2]({ m: chemin.match(route[1])!, params, body, user }))
}
