// « 45 ans de climat et d'agriculture » : pluie de saison des 45 départements (GET /api/v1/agroclimat/campagnes/{année},
// 1981-2025) et calculs de la page. Aucun chiffre écrit ici : une valeur absente reste null (« non disponible »), jamais 0.
import { useQueries } from '@tanstack/react-query'
import { api } from '../api'
import type { LigneCarte } from '../types/marts'
import { COULEURS, RAMPE } from './outils'
import type { ZoneObs } from './types'

export const PREMIERE = 1981
export const DERNIERE = 2025
export const ANNEES = Array.from({ length: DERNIERE - PREMIERE + 1 }, (_, i) => PREMIERE + i)
/** Décennies du graphique des saisons sèches (la dernière n'a que 5 ans) */
export const DECENNIES = [[1981, 1990], [1991, 2000], [2001, 2010], [2011, 2020], [2021, 2025]] as const

/** Toutes les saisons de 1981 à 2025 (45 requêtes, en cache une heure ; une campagne absente = null) */
export function usePluies() {
  return useQueries({
    queries: ANNEES.map((annee) => ({
      queryKey: ['obs', 'pluie', annee],
      queryFn: () => api.carte(annee).catch(() => null),
      staleTime: 1000 * 60 * 60,
    })),
    combine: (r) => ({
      pret: r.every((q) => !q.isPending),
      lignes: r.flatMap((q) => q.data ?? []) as LigneCarte[],
    }),
  })
}

export const moyenne = (v: (number | null | undefined)[]) => {
  const ok = v.filter((x): x is number => x !== null && x !== undefined && Number.isFinite(x))
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null
}
const sec = (l: LigneCarte) => l.classe_saison === 'sèche' || l.classe_saison === 'très sèche'

/** Lignes des départements de la zone (pays : tous ; région : ses départements ; département : lui seul) */
export function dansZone(lignes: LigneCarte[], zone: ZoneObs) {
  if (zone.niveau === 'PAYS') return lignes
  if (zone.niveau === 'REGION') return lignes.filter((l) => l.code_region === zone.code)
  return lignes.filter((l) => l.code_departement === zone.code)
}

export interface AnneePluie {
  annee: number
  /** pluie de saison moyenne des départements de la zone (mm) */
  pluie: number | null
  /** écart avec la normale 1991-2020 (%), moyenne des départements */
  ecart: number | null
  /** saison sèche : le département (ou plus de la moitié des départements de la zone) en saison sèche ou très sèche */
  seche: boolean | null
}

export function parAnnee(lignes: LigneCarte[]): AnneePluie[] {
  return ANNEES.map((annee) => {
    const l = lignes.filter((x) => x.campagne_agricole === annee)
    const classees = l.filter((x) => x.classe_saison)
    return {
      annee,
      pluie: moyenne(l.map((x) => x.pluie_saison_mm)),
      ecart: moyenne(l.map((x) => x.anomalie_pluie_saison_pct)),
      seche: classees.length ? classees.filter(sec).length > classees.length / 2 : null,
    }
  })
}

const entre = (a: AnneePluie[], de: number, a2: number) => a.filter((x) => x.annee >= de && x.annee <= a2)
export const pluieMoyenne = (a: AnneePluie[], de: number, a2: number) => moyenne(entre(a, de, a2).map((x) => x.pluie))
export const nbSeches = (a: AnneePluie[], de: number, a2: number) => {
  const connues = entre(a, de, a2).filter((x) => x.seche !== null)
  return connues.length ? connues.filter((x) => x.seche).length : null
}

/** Rendement : moyenne des 10 dernières années ayant une valeur */
export function recolteRecente(points: { annee: number; valeur: number | null }[]) {
  const ok = points.filter((p) => p.valeur !== null).sort((a, b) => b.annee - a.annee).slice(0, 10)
  return ok.length ? { valeur: moyenne(ok.map((p) => p.valeur)), de: ok[ok.length - 1].annee, a: ok[0].annee, n: ok.length } : null
}

/** Cinq classes, de très sèche à très humide, selon l'écart avec la normale (%) ; palette de la plateforme */
export const CLASSES = [
  { max: -20, libelle: 'très sèche', texte: 'beaucoup moins de pluie', couleur: COULEURS.orTexte },
  { max: -10, libelle: 'sèche', texte: 'moins de pluie', couleur: COULEURS.or },
  { max: 10, libelle: 'normale', texte: "comme d'habitude", couleur: '#E4E8EC' },
  { max: 20, libelle: 'humide', texte: 'plus de pluie', couleur: RAMPE[2] },
  { max: Infinity, libelle: 'très humide', texte: 'beaucoup plus de pluie', couleur: COULEURS.marine },
] as const
export const SANS_DONNEE = '#FFFFFF'
export const classeDe = (ecart: number | null) => (ecart === null ? null : CLASSES.find((c) => ecart < c.max) ?? CLASSES[4])

/** Bandeau de l'accueil et KPI « Données » */
export function compter(lignes: LigneCarte[]) {
  const annees = new Set(lignes.map((l) => l.campagne_agricole))
  const departements = new Set(lignes.map((l) => l.code_departement))
  const observations = lignes.filter((l) => l.pluie_saison_mm !== null).length
  return { annees: annees.size, departements: departements.size, observations, manquantes: ANNEES.length * departements.size - observations }
}
