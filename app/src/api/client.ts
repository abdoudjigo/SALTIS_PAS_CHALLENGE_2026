import { config } from '../config'
import { sessionStore } from '../auth/session'

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, { status = 0, details = null }: { status?: number; details?: unknown } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export type Methode = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type Params = Record<string, string | number | boolean | null | undefined>

export interface OptionsRequete {
  method?: Methode
  params?: Params
  body?: unknown
  signal?: AbortSignal
  timeout?: number
  /** n'envoie pas le jeton de session (jeton de démonstration, inconnu de l'API de données) */
  sansJeton?: boolean
}

function construireUrl(chemin: string, params?: Params) {
  const url = new URL(config.apiUrl + chemin)
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })
  return url
}

const MESSAGES_PAR_DEFAUT: Record<number, string> = {
  403: "Vous n'avez pas accès à cette partie.",
  404: "Cette information n'est pas disponible.",
  409: 'Cette opération entre en conflit avec une donnée existante.',
  422: 'Certaines informations sont manquantes ou incorrectes.',
  503: 'Le service démarre. Réessayez dans un instant.',
}

/**
 * Phrase lisible tirée d'une réponse d'erreur, dans les deux formats rencontrés :
 * FastAPI `{ detail: "..." }` ou `{ detail: [{ msg }] }`, et nos routes de données `{ erreur: { message, aide } }`.
 */
function messageErreur(contenu: unknown, status: number): string {
  const c = contenu as { detail?: string | { msg?: string }[]; erreur?: { message?: string; aide?: string } } | null
  if (c?.erreur?.message) return [c.erreur.message, c.erreur.aide].filter(Boolean).join(' ')
  if (typeof c?.detail === 'string') return c.detail
  return c?.detail?.[0]?.msg || MESSAGES_PAR_DEFAUT[status] || 'Une erreur est survenue. Réessayez dans un instant.'
}

/**
 * Appel à l'API FastAPI. Ajoute le jeton, gère le délai d'attente et transforme
 * les erreurs en ApiError avec un message lisible.
 */
export async function requete<T>(chemin: string, { method = 'GET', params, body, signal, timeout = 15000, sansJeton = false }: OptionsRequete = {}): Promise<T> {
  const controleur = new AbortController()
  const minuteur = setTimeout(() => controleur.abort(new DOMException('timeout', 'TimeoutError')), timeout)
  signal?.addEventListener('abort', () => controleur.abort(signal.reason))

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = sessionStore.token()
  if (token && !sansJeton) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let reponse: Response
  try {
    reponse = await fetch(construireUrl(chemin, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controleur.signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError' && signal?.aborted) throw e
    const horsLigne = typeof navigator !== 'undefined' && navigator.onLine === false
    throw new ApiError(horsLigne ? 'Vous êtes hors ligne.' : 'Le serveur ne répond pas. Réessayez dans un instant.')
  } finally {
    clearTimeout(minuteur)
  }

  if (reponse.status === 401) {
    sessionStore.clear('expiree')
    throw new ApiError('Session expirée, reconnectez-vous.', { status: 401 })
  }

  const contenu: unknown = reponse.status === 204 ? null : await reponse.json().catch(() => null)
  if (!reponse.ok) {
    throw new ApiError(messageErreur(contenu, reponse.status), { status: reponse.status, details: contenu })
  }
  return contenu as T
}
