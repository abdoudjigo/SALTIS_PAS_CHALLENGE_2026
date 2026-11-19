// Hooks de données (TanStack Query) : cache, déduplication, rechargement en arrière-plan.
// Les marts changent au plus une fois par jour : on garde les données longtemps en cache.
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '../api'

const LONG = 1000 * 60 * 60 // 1 h

export const useReferentiels = () =>
  useQuery({ queryKey: ['referentiels'], queryFn: api.referentiels, staleTime: Infinity, gcTime: Infinity })

export const useCarte = (campagne: number | undefined) =>
  useQuery({ queryKey: ['carte', campagne], queryFn: () => api.carte(campagne!), enabled: Boolean(campagne),
    staleTime: LONG, placeholderData: keepPreviousData })

// Options partagées par les hooks et par le préchargement (hooks/precharger.ts) : mêmes clés, mêmes requêtes
export const optionsChoix = (code: string | null) =>
  queryOptions({ queryKey: ['choix', code], queryFn: () => api.choixCultures(code!), enabled: Boolean(code),
    staleTime: LONG, placeholderData: keepPreviousData })
export const useChoixCultures = (code: string | null) => useQuery(optionsChoix(code))

export const optionsBesoins = (filtres: { code_departement?: string } = {}, actif = true) =>
  queryOptions({ queryKey: ['besoins', filtres], queryFn: () => api.besoins(filtres), enabled: actif, staleTime: LONG, placeholderData: keepPreviousData })
/** `actif` faux : rien n'est demandé (sans département, la requête lirait tout le pays). */
export const useBesoins = (filtres: { code_departement?: string } = {}, actif = true) => useQuery(optionsBesoins(filtres, actif))

export const useVulnerabilite = () =>
  useQuery({ queryKey: ['vulnerabilite'], queryFn: api.vulnerabilite, staleTime: LONG })

export const useTerritoires = () =>
  useQuery({ queryKey: ['territoires'], queryFn: () => api.territoires(), staleTime: LONG })

/** La carte des opportunités, tout le pays ; null tant que le mart n'est pas construit (404). */
export const optionsOpportunites = () => queryOptions({ queryKey: ['opportunites'], queryFn: api.opportunites, staleTime: LONG })
export const useOpportunites = () => useQuery(optionsOpportunites())

export const optionsOpportunite = (code: string | null) =>
  queryOptions({ queryKey: ['opportunite', code], queryFn: () => api.opportunite(code!), enabled: Boolean(code), staleTime: LONG })
export const useOpportunite = (code: string | null) => useQuery(optionsOpportunite(code))

/** Suivi décadaire d'un département pour une année ; `[]` si le département n'a pas de série (Guédiawaye). */
export const useSuivi = (code: string | null, annee: number | undefined) =>
  useQuery({ queryKey: ['suivi', code, annee], queryFn: () => api.suiviDecadaire(code!, annee!), enabled: Boolean(code && annee), staleTime: LONG })

/** Prix des intrants, toutes campagnes ; null si la table n'est pas construite (404). */
export const usePrixIntrants = () => useQuery({ queryKey: ['prix-intrants'], queryFn: api.prixIntrants, staleTime: LONG })

/** Cadre harmonisé, dernier cycle, tous les départements ; null si le mart n'est pas construit (404). */
export const useCadreHarmonise = () => useQuery({ queryKey: ['cadre-harmonise'], queryFn: api.cadreHarmonise, staleTime: LONG })

/** Palette officielle des phases du Cadre harmonisé (référentiel de l'API). */
export const usePhasesCadreHarmonise = () => useQuery({ queryKey: ['phases-cadre-harmonise'], queryFn: api.phasesCadreHarmonise, staleTime: Infinity })
