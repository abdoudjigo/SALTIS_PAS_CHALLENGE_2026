// Stockage de la session (jeton JWT + utilisateur). Si l'API passe à un cookie httpOnly,
// seul ce fichier et api/client.ts changent.
import type { Session } from '../types/auth'

const CLE = 'assaman.session'

function lire(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? 'null') as Session | null
  } catch {
    return null
  }
}

let session = lire()
// Pourquoi la dernière session s'est terminée : message « session expirée » à la connexion,
// retour à la landing après une déconnexion volontaire
export type FinSession = 'expiree' | 'deconnexion' | null
let finSession: FinSession = null
const abonnes = new Set<(s: Session | null) => void>()

export const sessionStore = {
  get: (): Session | null => session,
  token: (): string | null => session?.access_token ?? null,
  finSession: (): FinSession => finSession,
  set(valeur: Session | null) {
    session = valeur
    if (valeur) finSession = null
    try {
      if (valeur) localStorage.setItem(CLE, JSON.stringify(valeur))
      else localStorage.removeItem(CLE)
    } catch {
      /* navigation privée : la session reste en mémoire */
    }
    abonnes.forEach((f) => f(session))
  },
  clear(motif: FinSession = null) {
    finSession = motif
    sessionStore.set(null)
  },
  subscribe(f: (s: Session | null) => void) {
    abonnes.add(f)
    return () => {
      abonnes.delete(f)
    }
  },
}
