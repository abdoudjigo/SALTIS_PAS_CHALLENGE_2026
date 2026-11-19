import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Utilisateur } from '../types/auth'
import { viderExport } from '../scene/registreExport'
import { sessionStore } from './session'

interface ValeurAuth {
  user: Utilisateur | null
  estConnecte: boolean
  login: (email: string, password: string) => Promise<Utilisateur>
  logout: () => void
}

const AuthContext = createContext<ValeurAuth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
  const queryClient = useQueryClient()

  // À l'ouverture, on revalide le profil auprès de l'API (rôle modifié, compte désactivé…)
  useEffect(() => {
    if (!sessionStore.token()) return
    api.moi()
      .then((user) => {
        const s = sessionStore.get()
        if (user && s) sessionStore.set({ ...s, user })
      })
      .catch(() => {})
  }, [])

  // Déconnexion (manuelle ou jeton expiré) : on vide le cache des données
  // (seulement quand une session se termine : à l'ouverture, un visiteur a déjà des données publiques en cours de chargement)
  const etaitConnecte = useRef(Boolean(session))
  useEffect(() => {
    if (etaitConnecte.current && !session) {
      queryClient.clear()
      // Dossier de l'ONG (stock, prix saisis) et étapes gardées pour l'export : propres à la session qui se termine
      viderExport()
    }
    etaitConnecte.current = Boolean(session)
  }, [session, queryClient])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    sessionStore.set(res)
    return res.user
  }, [])

  const logout = useCallback(() => sessionStore.clear('deconnexion'), [])

  const valeur = useMemo<ValeurAuth>(
    () => ({ user: session?.user ?? null, estConnecte: Boolean(session?.access_token), login, logout }),
    [session, login, logout],
  )
  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): ValeurAuth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
