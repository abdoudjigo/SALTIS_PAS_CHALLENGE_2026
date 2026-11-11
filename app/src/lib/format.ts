// Règle du contrat de données : NULL = inconnu ou non applicable, JAMAIS affiché comme 0.
import type { StatutDose } from '../types/marts'

export const VIDE = '—'

type Nombre = number | null | undefined

const cacheFormats = new Map<number, Intl.NumberFormat>()
function format(decimales: number) {
  let f = cacheFormats.get(decimales)
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales, minimumFractionDigits: 0 })
    cacheFormats.set(decimales, f)
  }
  return f
}

export function nombre(v: Nombre, { decimales = 0, unite = '', signe = false }: { decimales?: number; unite?: string; signe?: boolean } = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return VIDE
  const txt = format(decimales).format(v)
  return `${signe && v > 0 ? '+' : ''}${txt}${unite ? ` ${unite}` : ''}`
}

export const mm = (v: Nombre) => nombre(v, { unite: 'mm' })
export const pct = (v: Nombre, decimales = 0) => nombre(v, { decimales, unite: '%' })
export const tonnes = (v: Nombre) => nombre(v, { decimales: v !== null && v !== undefined && Math.abs(v) < 10 ? 1 : 0, unite: 't' })

export function jourEnDate(jour: Nombre) {
  if (jour === null || jour === undefined) return VIDE
  const d = new Date(Date.UTC(2021, 0, jour))
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// Libellés en minuscules → première lettre capitale (cultures et zones sont en majuscules dans les marts)
export function libelle(texte: string | null | undefined) {
  if (!texte) return VIDE
  const t = texte.toLocaleLowerCase('fr-FR')
  return (t.charAt(0).toLocaleUpperCase('fr-FR') + t.slice(1)).replace(/\bsénégal\b/g, 'Sénégal')
}

export type Ton = 'vert' | 'soleil' | 'terre' | 'pluie' | 'alerte' | 'gris'

export const STATUTS_DOSE: Record<StatutDose, { texte: string; ton: Ton; aide: string }> = {
  VALIDEE: { texte: 'Validée', ton: 'vert', aide: 'Dose validée par un spécialiste.' },
  A_CONFIRMER: { texte: 'À confirmer', ton: 'soleil', aide: 'Dose issue d’une étude locale, à confirmer par l’ISRA.' },
  NON_VERIFIEE: { texte: 'Non vérifiée', ton: 'terre', aide: 'Dose extrapolée ou de source non vérifiée.' },
  A_COMPLETER: { texte: 'Dose à saisir', ton: 'gris', aide: 'Aucune dose connue : le besoin n’est pas calculé.' },
}
