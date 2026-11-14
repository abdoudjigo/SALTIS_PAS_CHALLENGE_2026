// Hooks des prévisions (résultats des 4 modèles d'IA, SALTIS.ML). Même style que `donnees.ts`.
// `etatPrevision` range chaque requête dans un état affichable : jamais d'erreur brute à l'écran.
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, ApiError } from '../api'
import type { CodeModele, Moment } from '../types/previsions'

const LONG = 1000 * 60 * 60 // 1 h : les modèles sont recalculés au plus une fois par jour

export const usePrevisionSaison = (annee: number | undefined) =>
  useQuery({ queryKey: ['prevision-saison', annee], queryFn: () => api.previsionSaison(annee!), enabled: Boolean(annee), staleTime: LONG, placeholderData: keepPreviousData })

export const usePrevisionRendement = (code: string | null, annee: number | undefined) =>
  useQuery({ queryKey: ['prevision-rendement', code, annee], queryFn: () => api.previsionRendement(code!, annee!), enabled: Boolean(code && annee), staleTime: LONG, placeholderData: keepPreviousData })

export const useAlerteRecolte = (annee: number | undefined, moment: Moment, culture?: string | null) =>
  useQuery({ queryKey: ['alerte-recolte', annee, moment, culture ?? null], queryFn: () => api.alerteRecolte(annee!, moment, culture), enabled: Boolean(annee), staleTime: LONG, placeholderData: keepPreviousData })

/** `annee` null = année type. Sans `culture` : toutes les cultures du département. */
export const useRisqueSemis = (code: string | null, annee: number | null, culture?: string | null) =>
  useQuery({ queryKey: ['risque-semis', code, annee, culture ?? null], queryFn: () => api.risqueSemis(code!, annee, culture), enabled: Boolean(code), staleTime: LONG, placeholderData: keepPreviousData })

export const useCarteSemis = (culture: string | null, annee: number | null) =>
  useQuery({ queryKey: ['carte-semis', culture, annee], queryFn: () => api.carteSemis(culture!, annee), enabled: Boolean(culture), staleTime: LONG, placeholderData: keepPreviousData })

export const useFiabilite = (modele: CodeModele) =>
  useQuery({ queryKey: ['fiabilite', modele], queryFn: () => api.fiabilite(modele), staleTime: Infinity })

/**
 * - `non-chargee` : SALTIS.ML n'est pas chargé (404 `prevision_indisponible`), ou données de démonstration ;
 * - `absente` : pas de prévision pour cette combinaison (année hors du modèle, département sans données) ;
 * - `erreur` : l'API ne répond pas.
 */
export type EtatPrevision = 'chargement' | 'ok' | 'non-chargee' | 'absente' | 'erreur'

export function etatPrevision(requete: Pick<UseQueryResult<unknown>, 'data' | 'error' | 'isPlaceholderData'>): EtatPrevision {
  const { error } = requete
  if (error) {
    if (!(error instanceof ApiError) || error.status !== 404) return 'erreur'
    const code = (error.details as { erreur?: { code?: string } } | null)?.erreur?.code
    return code === 'prevision_indisponible' ? 'non-chargee' : 'absente'
  }
  return requete.data === undefined ? 'chargement' : 'ok'
}
