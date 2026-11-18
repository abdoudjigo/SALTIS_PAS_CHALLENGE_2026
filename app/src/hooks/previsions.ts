// Hooks des prévisions (résultats des 4 modèles d'IA, SALTIS.ML). Même style que `donnees.ts`.
// `etatPrevision` range chaque requête dans un état affichable : jamais d'erreur brute à l'écran.
import { keepPreviousData, queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, ApiError } from '../api'
import type { CodeModele, Moment } from '../types/previsions'

const LONG = 1000 * 60 * 60 // 1 h : les modèles sont recalculés au plus une fois par jour

// Options partagées par les hooks et par le préchargement (hooks/precharger.ts) : mêmes clés, mêmes requêtes
export const optionsPrevisionSaison = (annee: number | undefined) =>
  queryOptions({ queryKey: ['prevision-saison', annee], queryFn: () => api.previsionSaison(annee!), enabled: Boolean(annee), staleTime: LONG, placeholderData: keepPreviousData })
export const usePrevisionSaison = (annee: number | undefined) => useQuery(optionsPrevisionSaison(annee))

export const optionsPrevisionRendement = (code: string | null, annee: number | undefined) =>
  queryOptions({ queryKey: ['prevision-rendement', code, annee], queryFn: () => api.previsionRendement(code!, annee!), enabled: Boolean(code && annee), staleTime: LONG, placeholderData: keepPreviousData })
export const usePrevisionRendement = (code: string | null, annee: number | undefined) => useQuery(optionsPrevisionRendement(code, annee))

export const optionsAlerteRecolte = (annee: number | undefined, moment: Moment, culture?: string | null) =>
  queryOptions({ queryKey: ['alerte-recolte', annee, moment, culture ?? null], queryFn: () => api.alerteRecolte(annee!, moment, culture), enabled: Boolean(annee), staleTime: LONG, placeholderData: keepPreviousData })
export const useAlerteRecolte = (annee: number | undefined, moment: Moment, culture?: string | null) => useQuery(optionsAlerteRecolte(annee, moment, culture))
/**
 * Agriculteur : la récolte attendue vue fin mai (modèle 3), tous les départements d'une année, filtrée ensuite par
 * département. La route par département répond 404 quand un département n'a pas de série (ex. Podor en 2001) ;
 * celle-ci répond pour toute année couverte : aucune erreur dans la console, une seule requête par année.
 */
export const useRecolteFinMai = (annee: number | undefined) => useAlerteRecolte(annee, 'FIN_MAI')

/** `annee` null = année type. Sans `culture` : toutes les cultures du département. */
export const optionsRisqueSemis = (code: string | null, annee: number | null, culture?: string | null) =>
  queryOptions({ queryKey: ['risque-semis', code, annee, culture ?? null], queryFn: () => api.risqueSemis(code!, annee, culture), enabled: Boolean(code), staleTime: LONG, placeholderData: keepPreviousData })
export const useRisqueSemis = (code: string | null, annee: number | null, culture?: string | null) => useQuery(optionsRisqueSemis(code, annee, culture))

export const optionsCarteSemis = (culture: string | null, annee: number | null) =>
  queryOptions({ queryKey: ['carte-semis', culture, annee], queryFn: () => api.carteSemis(culture!, annee), enabled: Boolean(culture), staleTime: LONG, placeholderData: keepPreviousData })
export const useCarteSemis = (culture: string | null, annee: number | null) => useQuery(optionsCarteSemis(culture, annee))

export const useFiabilite = (modele: CodeModele) =>
  useQuery({ queryKey: ['fiabilite', modele], queryFn: () => api.fiabilite(modele), staleTime: Infinity })

/**
 * - `non-chargee` : SALTIS.ML n'est pas chargé (404 `prevision_indisponible`), ou données de démonstration ;
 * - `absente` : pas de prévision pour cette combinaison (année hors du modèle, département sans données) ;
 * - `erreur` : l'API ne répond pas.
 */
export type EtatPrevision = 'chargement' | 'ok' | 'non-chargee' | 'absente' | 'erreur'

/**
 * Agriculteur : la réponse de la sélection en cours seulement. Pendant le chargement d'une autre sélection,
 * React Query garde l'ancienne réponse (`placeholderData`) : on ne l'affiche pas, l'état de chargement s'affiche.
 */
/** Écrit en hook : le compilateur React tient sa valeur pour figée, comme celle de useQuery. */
export const useActuelles = <T,>(requete: Pick<UseQueryResult<T>, 'data' | 'isPlaceholderData'>): T | undefined => (requete.isPlaceholderData ? undefined : requete.data)
export const etatActuel = (requete: Pick<UseQueryResult<unknown>, 'data' | 'error' | 'isPlaceholderData'>): EtatPrevision =>
  requete.isPlaceholderData ? 'chargement' : etatPrevision(requete)

export function etatPrevision(requete: Pick<UseQueryResult<unknown>, 'data' | 'error' | 'isPlaceholderData'>): EtatPrevision {
  const { error } = requete
  if (error) {
    if (!(error instanceof ApiError) || error.status !== 404) return 'erreur'
    const code = (error.details as { erreur?: { code?: string } } | null)?.erreur?.code
    return code === 'prevision_indisponible' ? 'non-chargee' : 'absente'
  }
  return requete.data === undefined ? 'chargement' : 'ok'
}
