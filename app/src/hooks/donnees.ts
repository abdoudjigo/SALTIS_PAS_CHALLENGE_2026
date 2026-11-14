// Hooks de données (TanStack Query) : cache, déduplication, rechargement en arrière-plan.
// Les marts changent au plus une fois par jour : on garde les données longtemps en cache.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../api'

const LONG = 1000 * 60 * 60 // 1 h

export const useReferentiels = () =>
  useQuery({ queryKey: ['referentiels'], queryFn: api.referentiels, staleTime: Infinity, gcTime: Infinity })

export const useCarte = (campagne: number | undefined) =>
  useQuery({ queryKey: ['carte', campagne], queryFn: () => api.carte(campagne!), enabled: Boolean(campagne),
    staleTime: LONG, placeholderData: keepPreviousData })

export const useChoixCultures = (code: string | null) =>
  useQuery({ queryKey: ['choix', code], queryFn: () => api.choixCultures(code!), enabled: Boolean(code),
    staleTime: LONG, placeholderData: keepPreviousData })

export const useBesoins = (filtres: { code_departement?: string } = {}) =>
  useQuery({ queryKey: ['besoins', filtres], queryFn: () => api.besoins(filtres), staleTime: LONG, placeholderData: keepPreviousData })

export const useVulnerabilite = () =>
  useQuery({ queryKey: ['vulnerabilite'], queryFn: api.vulnerabilite, staleTime: LONG })

export const useTerritoires = () =>
  useQuery({ queryKey: ['territoires'], queryFn: () => api.territoires(), staleTime: LONG })
