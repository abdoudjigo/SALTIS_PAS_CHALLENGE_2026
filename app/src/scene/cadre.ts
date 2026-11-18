// Contrat entre la scène et ses fonctionnalités : chaque fonctionnalité reçoit le « cadre » (référentiels,
// sélection, position) et publie sa « sortie » (ce que la carte doit montrer, la légende, l'infobulle).
import type { PaddingOptions } from 'mapbox-gl'
import { useEffect, useMemo, type ComponentType, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Utilisateur } from '../types/auth'
import type { Referentiels } from '../types/marts'
import { anneeAVenir, anneesPassees, DERNIERE_ANNEE_PREVISION, type CodeModele } from '../types/previsions'
import type { Camera, VueCarte } from './Carte'
import { emprise, SENEGAL, type Contours, type LonLat } from './geo'

export interface Infobulle {
  titre: string
  lignes: string[]
}

export interface Sortie {
  vue: Partial<VueCarte>
  /** la réponse en une ligne (tiroir replié, fenêtre réduite) */
  resume?: string
  legende?: ReactNode
  infobulle?: (code: string) => Infobulle | null
  /** l'essentiel, écrit pour l'oreille : lu par le bouton « Écouter » de la fenêtre (une phrase par élément) */
  aEcouter?: string[]
  /** la même chose en wolof, lue par la mascotte « WLF » (fonctionnalités de l'agriculteur) */
  aEcouterWo?: string[]
  /** un clic sur la carte pose un point (position de la parcelle, dépôt du stock) */
  surPoint?: (position: LonLat) => void
}

export interface Cadre {
  ref: Referentiels
  contours: Contours
  user: Utilisateur
  /** département choisi, partagé entre les fonctionnalités */
  selection: string | null
  choisir: (code: string | null) => void
  /** position de la parcelle de l'agriculteur */
  position: LonLat | null
  definirPosition: (position: LonLat | null) => void
  /** année choisie, partagée entre les fonctionnalités : à venir (saisie) ou passée (vérification) */
  annee: number
  choisirAnnee: (annee: number) => void
  aller: (mode: string) => void
  /** culture choisie, partagée entre les fonctionnalités qui choisissent une culture ; null : chacune prend son choix par défaut */
  culture: string | null
  choisirCulture: (culture: string | null) => void
  marge: Partial<PaddingOptions>
}

export interface PropsMode {
  cadre: Cadre
  publier: (sortie: Sortie) => void
}

export interface Fonctionnalite {
  id: string
  titre: string
  /** la question de l'agriculteur, posée par le menu (fonctionnalités de l'agriculteur seulement) */
  question?: string
  phrase: string
  icone: LucideIcon
  composant: ComponentType<PropsMode>
}

export const cadrer = {
  pays: (cadre: Cadre, options: Pick<Camera, 'inclinaison' | 'cap' | 'duree'> = {}): Camera => ({ emprise: SENEGAL.emprise, marge: cadre.marge, ...options }),
  departement(cadre: Cadre, code: string, options: Pick<Camera, 'inclinaison' | 'cap' | 'duree'> = {}): Camera {
    const forme = cadre.contours.features.find((f) => f.properties.GID_2 === code)
    if (!forme) return cadrer.pays(cadre, options)
    const [[o, s], [e, n]] = emprise(forme.geometry)
    // Un peu d'air autour du département
    const [dx, dy] = [(e - o) * 0.35, (n - s) * 0.35]
    return { emprise: [[o - dx, s - dy], [e + dx, n + dy]], marge: cadre.marge, ...options }
  },
}

/** Publie la sortie d'une fonctionnalité à chaque fois qu'elle change. */
export function usePublier(publier: (s: Sortie) => void, sortie: Sortie) {
  useEffect(() => publier(sortie), [publier, sortie])
}

/**
 * L'année d'une fonctionnalité : celle du cadre si le modèle la couvre, sinon la campagne à venir.
 * `passees` : les années de vérification du modèle ; `tendance` : année au-delà de la prévision océan.
 */
export function useAnnee(cadre: Cadre, modele: CodeModele) {
  const { campagnes } = cadre.ref
  return useMemo(() => {
    const aVenir = anneeAVenir(campagnes)
    const passees = anneesPassees(campagnes, modele)
    const annee = cadre.annee >= aVenir || passees.includes(cadre.annee) ? cadre.annee : aVenir
    return { annee, aVenir, passees, max: DERNIERE_ANNEE_PREVISION, tendance: annee > aVenir, passee: annee < aVenir }
  }, [campagnes, modele, cadre.annee])
}
