// Département sélectionné, partagé entre les écrans et mémorisé (on garde son territoire en changeant d'écran).
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Departement } from '../types/marts'
import { useReferentiels } from './donnees'

const CLE = 'assaman.departement'

interface ValeurTerritoire {
  departement: Departement | null
  code: string | null
  choisir: (code: string) => void
}

const Ctx = createContext<ValeurTerritoire | null>(null)

export function TerritoireProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { data: ref } = useReferentiels()
  const [choisi, setChoisi] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CLE)
    } catch {
      return null
    }
  })

  const valeur = useMemo<ValeurTerritoire>(() => {
    const deps = ref?.departements ?? []
    const code = choisi || user?.code_departement || 'SEN.5.2_1'
    const departement = deps.find((d) => d.code_departement === code) ?? deps[0] ?? null
    return {
      departement,
      code: departement?.code_departement ?? null,
      choisir(c) {
        setChoisi(c)
        try {
          localStorage.setItem(CLE, c)
        } catch {
          /* ignoré */
        }
      },
    }
  }, [ref, choisi, user])

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTerritoire(): ValeurTerritoire {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTerritoire doit être utilisé dans <TerritoireProvider>')
  return ctx
}
