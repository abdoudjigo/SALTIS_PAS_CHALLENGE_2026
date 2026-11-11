// Hooks de données (TanStack Query) : cache, déduplication, rechargement en arrière-plan.
// Les marts changent au plus une fois par jour : on garde les données longtemps en cache.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { OffreSemence, Scenario, Stock } from '../types/marts'

const LONG = 1000 * 60 * 60 // 1 h

export const useReferentiels = () =>
  useQuery({ queryKey: ['referentiels'], queryFn: api.referentiels, staleTime: Infinity, gcTime: Infinity })

export const useCarte = (campagne: number | undefined) =>
  useQuery({ queryKey: ['carte', campagne], queryFn: () => api.carte(campagne!), enabled: Boolean(campagne),
    staleTime: LONG, placeholderData: keepPreviousData })

export const useHistorique = (code: string | null) =>
  useQuery({ queryKey: ['historique', code], queryFn: () => api.historique(code!), enabled: Boolean(code), staleTime: LONG })

export const useSuivi = (code: string | null, annee: number | undefined) =>
  useQuery({ queryKey: ['suivi', code, annee], queryFn: () => api.suivi(code!, annee!), enabled: Boolean(code && annee),
    staleTime: LONG, placeholderData: keepPreviousData })

export const useChoixCultures = (code: string | null) =>
  useQuery({ queryKey: ['choix', code], queryFn: () => api.choixCultures(code!), enabled: Boolean(code),
    staleTime: LONG, placeholderData: keepPreviousData })

export const useAdequationVarietes = () =>
  useQuery({ queryKey: ['adequation-varietes'], queryFn: api.adequationVarietes, staleTime: LONG })

export const useBesoins = (filtres: { code_departement?: string } = {}) =>
  useQuery({ queryKey: ['besoins', filtres], queryFn: () => api.besoins(filtres), staleTime: LONG, placeholderData: keepPreviousData })

export const useVulnerabilite = () =>
  useQuery({ queryKey: ['vulnerabilite'], queryFn: api.vulnerabilite, staleTime: LONG })

export const useStocks = () => useQuery({ queryKey: ['stocks'], queryFn: api.stocks })
export const useScenarios = () => useQuery({ queryKey: ['scenarios'], queryFn: api.scenarios })
export const useOffreSemences = () => useQuery({ queryKey: ['offre-semences'], queryFn: api.offreSemences })

export function useEnregistrerStocks() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.enregistrerStocks, onSuccess: (d: Stock[]) => qc.setQueryData(['stocks'], d) })
}

export function useEnregistrerOffreSemences() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.enregistrerOffreSemences, onSuccess: (d: OffreSemence[]) => qc.setQueryData(['offre-semences'], d) })
}

export function useGenererScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.genererScenario,
    onSuccess: (s) => qc.setQueryData<Scenario[]>(['scenarios'], (l = []) => [s, ...l]),
  })
}

export function useValiderScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, quantites }: { id: number; quantites: Record<string, number> }) => api.validerScenario(id, quantites),
    onSuccess: (s) => qc.setQueryData<Scenario[]>(['scenarios'], (l = []) => l.map((x) => (x.id === s.id ? s : x))),
  })
}

export function useSupprimerScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.supprimerScenario,
    onSuccess: (_, id) => qc.setQueryData<Scenario[]>(['scenarios'], (l = []) => l.filter((x) => x.id !== id)),
  })
}

export type ClePrechargement = 'vulnerabilite' | 'besoins'

// Précharge les données d'un écran au survol d'un lien du menu (navigation instantanée)
export function usePrechargement() {
  const qc = useQueryClient()
  return (cle: ClePrechargement) => {
    if (cle === 'vulnerabilite') qc.prefetchQuery({ queryKey: ['vulnerabilite'], queryFn: api.vulnerabilite, staleTime: LONG })
    if (cle === 'besoins') qc.prefetchQuery({ queryKey: ['besoins', {}], queryFn: () => api.besoins({}), staleTime: LONG })
  }
}
