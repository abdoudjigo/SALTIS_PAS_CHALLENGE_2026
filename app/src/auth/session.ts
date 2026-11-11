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
const abonnes = new Set<(s: Session | null) => void>()

export const sessionStore = {
  get: (): Session | null => session,
  token: (): string | null => session?.access_token ?? null,
  set(valeur: Session | null) {
    session = valeur
    try {
      if (valeur) localStorage.setItem(CLE, JSON.stringify(valeur))
      else localStorage.removeItem(CLE)
    } catch {
      /* navigation privée : la session reste en mémoire */
    }
    abonnes.forEach((f) => f(session))
  },
  clear() {
    sessionStore.set(null)
  },
  subscribe(f: (s: Session | null) => void) {
    abonnes.add(f)
    return () => {
      abonnes.delete(f)
    }
  },
}
