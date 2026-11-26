// État de la page dans l'URL (vue partageable) et données de l'API, en cache (TanStack Query).
// Exemple : /observatoire?annee=2021&culture=mil&zone=SEN.4.2_1&indicateur=rendement
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../api'
import { codeCulture } from './outils'
import type { CultureObs, FiltresObs, Indicateur, ZoneObs } from './types'

const LONG = 1000 * 60 * 60 // les marts changent au plus une fois par jour
const INDICATEURS: Indicateur[] = ['production', 'surface', 'rendement']

export interface Selection {
  annee: number
  /** Code court de la culture (« mil »), envoyé tel quel à l'API */
  culture: string
  /** `SEN`, code région (`SEN.4_1`) ou département (`SEN.4.2_1`) */
  zone: string
  indicateur: Indicateur
}

export const useFiltresObs = () =>
  useQuery({ queryKey: ['obs', 'filtres'], queryFn: api.observatoire.filtres, staleTime: LONG })

/** Sélection lue dans l'URL, corrigée d'après /filtres (culture connue, année proposée, zone connue) */
export function useSelection(filtres: FiltresObs | undefined) {
  const [params, setParams] = useSearchParams()

  const selection = useMemo<Selection | null>(() => {
    if (!filtres || filtres.cultures.length === 0) return null
    const brute = params.get('culture')?.toLowerCase()
    const culture = filtres.cultures.find((c) => codeCulture(c.culture) === brute)
      ?? filtres.cultures.find((c) => codeCulture(c.culture) === 'mil') ?? filtres.cultures[0]
    const annee = Number(params.get('annee'))
    const zone = params.get('zone') ?? 'SEN'
    const indicateur = params.get('indicateur') as Indicateur
    return {
      culture: codeCulture(culture.culture),
      annee: filtres.annees.includes(annee) ? annee : Math.min(culture.derniere_annee, filtres.derniere_annee_departements),
      zone: filtres.zones.some((z) => z.code === zone) ? zone : 'SEN',
      indicateur: INDICATEURS.includes(indicateur) ? indicateur : 'production',
    }
  }, [filtres, params])

  const changer = useCallback((partiel: Partial<Selection>) => {
    setParams((p) => {
      const suivant = new URLSearchParams(p)
      for (const [k, v] of Object.entries(partiel)) suivant.set(k, String(v))
      return suivant
    }, { replace: true })
  }, [setParams])

  return { selection, changer }
}

export function cultureChoisie(filtres: FiltresObs, s: Selection): CultureObs {
  return filtres.cultures.find((c) => codeCulture(c.culture) === s.culture)!
}

export function zoneChoisie(filtres: FiltresObs, s: Selection): ZoneObs {
  return filtres.zones.find((z) => z.code === s.zone) ?? filtres.zones[0]
}

/** Totaux région et pays : seulement pour les cultures `a_totaux` (sésame : départements seulement) */
export function zoneServie(culture: CultureObs, zone: ZoneObs) {
  return zone.niveau === 'DEPARTEMENT' || culture.a_totaux
}

const options = { staleTime: LONG, placeholderData: keepPreviousData } as const

export function useDonneesObs(s: Selection | null, zoneOk: boolean) {
  const actif = Boolean(s)
  const zone = Boolean(s) && zoneOk
  const indicateurs = useQuery({
    queryKey: ['obs', 'indicateurs', s?.annee, s?.culture, s?.zone],
    queryFn: () => api.observatoire.indicateurs(s!.annee, s!.culture, s!.zone), enabled: zone, ...options,
  })
  const serie = useQuery({
    queryKey: ['obs', 'serie', s?.culture, s?.indicateur, s?.zone],
    queryFn: () => api.observatoire.serie(s!.culture, s!.indicateur, s!.zone), enabled: zone, ...options,
  })
  const carte = useQuery({
    queryKey: ['obs', 'carte', s?.annee, s?.culture, s?.indicateur],
    queryFn: () => api.observatoire.carte(s!.annee, s!.culture, s!.indicateur), enabled: actif, ...options,
  })
  const classement = useQuery({
    queryKey: ['obs', 'classement', s?.annee, s?.culture, s?.indicateur],
    queryFn: () => api.observatoire.classement(s!.annee, s!.culture, s!.indicateur), enabled: actif, ...options,
  })
  // Les objectifs sont nationaux : toute zone infranationale reçoit la même réponse (un message)
  const zoneObjectifs = s?.zone === 'SEN' ? 'SEN' : s?.zone
  const objectifs = useQuery({
    queryKey: ['obs', 'objectifs', zoneObjectifs === 'SEN' ? 'SEN' : 'infra'],
    queryFn: () => api.observatoire.objectifs(zoneObjectifs!), enabled: actif, staleTime: LONG,
  })
  return { indicateurs, serie, carte, classement, objectifs }
}

export const useContours = () =>
  useQuery({
    queryKey: ['obs', 'contours'],
    queryFn: async () => {
      const r = await fetch('/geo/departements-svg.json')
      if (!r.ok) throw new Error('Contours des départements indisponibles.')
      return (await r.json()) as { source: string; viewBox: string; departements: { code: string; nom: string; d: string }[] }
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
