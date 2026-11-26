// Outils de l'Observatoire : codes d'URL, formats, palette, préférence « réduire les animations ».
import { useEffect, useState, useSyncExternalStore } from 'react'
import { nombre } from '../lib/format'
import type { Indicateur } from './types'

/** Palette de l'observatoire (marine, bleu, or, gris, fond) */
export const COULEURS = {
  marine: '#1F4466',
  bleu: '#2B5C80',
  or: '#A8843A',
  gris: '#5A6470',
  fond: '#F3F6F9',
  /** Or assombri pour un texte lisible sur fond blanc (contraste AA, 5,7:1) ; l'or pur reste pour les tracés */
  orTexte: '#7F6226',
} as const

/** Rampe séquentielle bleue de la carte (5 classes, du plus clair au plus foncé), dérivée de la palette */
export const RAMPE = ['#DCE6EF', '#A9C1D6', '#6F96B6', COULEURS.bleu, COULEURS.marine] as const

export const NON_DISPONIBLE = 'non disponible'

/** « MIL (SOUNA) » → « mil », « MAÏS » → « mais » : code court de l'URL, accepté tel quel par l'API */
export function codeCulture(culture: string) {
  return culture.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(' (')[0].trim()
}

/** « MIL (SOUNA) » → « Mil (souna) » ; « RIZ (IRRIGUÉ) » → « Riz (irrigué) » */
export function nomCulture(culture: string) {
  const t = culture.toLocaleLowerCase('fr-FR')
  return t.charAt(0).toLocaleUpperCase('fr-FR') + t.slice(1)
}

/** Nom court pour les phrases (« mil », « riz », « maïs ») */
export function nomCourt(culture: string) {
  return culture.toLocaleLowerCase('fr-FR').split(' (')[0]
}

const DECIMALES: Record<Indicateur, number> = { production: 0, surface: 0, rendement: 0 }

export function valeurTexte(v: number | null | undefined, indicateur: Indicateur, unite: string) {
  if (v === null || v === undefined || Number.isNaN(v)) return NON_DISPONIBLE
  return nombre(v, { decimales: DECIMALES[indicateur], unite })
}

export function pctTexte(v: number | null | undefined, decimales = 0) {
  if (v === null || v === undefined) return NON_DISPONIBLE
  return nombre(v, { decimales, unite: '%', signe: true })
}

/** Date lisible d'un horodatage ISO (« 26 novembre 2026 ») */
export function dateTexte(iso: string | undefined) {
  if (!iso) return NON_DISPONIBLE
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? NON_DISPONIBLE : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Badge « incomplet (n/N départements) » : texte, ou null si l'agrégat est complet ou s'il s'agit d'un département */
export function texteIncomplet(p: { est_complet: boolean | null; nb_departements_observes: number | null; nb_departements_attendus: number | null }) {
  if (p.est_complet !== false) return null
  if (p.nb_departements_observes === null || p.nb_departements_attendus === null) return 'incomplet'
  return `incomplet (${p.nb_departements_observes}/${p.nb_departements_attendus} départements)`
}

const requete = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

/** Vrai si le visiteur demande de réduire les animations (suit le réglage en direct) */
export function useMouvementReduit() {
  return useSyncExternalStore(
    (rappel) => {
      requete?.addEventListener('change', rappel)
      return () => requete?.removeEventListener('change', rappel)
    },
    () => requete?.matches ?? false,
    () => true,
  )
}

/** Nombre qui défile vers sa valeur (600 ms) ; immédiat sous prefers-reduced-motion */
export function useCompteur(cible: number | null, duree = 600) {
  const reduit = useMouvementReduit()
  // `pour` : la cible de l'animation en cours ; tant qu'elle diffère, on part de 60 % de la nouvelle valeur
  const [etat, setEtat] = useState<{ pour: number | null; v: number }>({ pour: null, v: 0 })
  useEffect(() => {
    if (cible === null || reduit) return
    let depart: number | null = null
    let image = 0
    const origine = 0.6 * cible
    const pas = (t: number) => {
      depart ??= t
      const k = Math.min(1, (t - depart) / duree)
      setEtat({ pour: cible, v: origine + (cible - origine) * (1 - (1 - k) ** 3) })
      if (k < 1) image = requestAnimationFrame(pas)
    }
    image = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(image)
  }, [cible, duree, reduit])
  if (cible === null || reduit) return cible
  return etat.pour === cible ? etat.v : 0.6 * cible
}
