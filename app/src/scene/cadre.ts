// Contrat entre la scène et ses fonctionnalités : chaque fonctionnalité reçoit le « cadre » (référentiels,
// sélection, position) et publie sa « sortie » (ce que la carte doit montrer, la légende, l'infobulle).
import type { Map as CarteMapbox, PaddingOptions } from 'mapbox-gl'
import { useEffect, useMemo, type ComponentType, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Utilisateur } from '../types/auth'
import type { Referentiels } from '../types/marts'
import { anneeAVenir, anneeCouverte, anneesPassees, DERNIERE_ANNEE_PREVISION, type CodeModele } from '../types/previsions'
import type { Camera, VueCarte } from './carte/Carte'
import type { LigneCheck } from './interface/fiche'
import { emprise, SENEGAL, type Contours, type LonLat } from './carte/geo'

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
  /** étapes de l'ONG : ce que le dossier exporté reprend de l'étape (phase D2), calculé une seule fois, ici */
  etape?: EtapeExport
}

/** Ce qu'une étape de l'ONG donne au dossier exporté (PDF, phase D2). */
export interface EtapeExport {
  titre: string
  question: string
  /** la checklist de la fiche, 3 lignes au plus (états ok, attention, non, info) */
  lignes: LigneCheck[]
  /** un tableau court (en-têtes, puis lignes de texte déjà formatées) */
  tableau?: { colonnes: string[]; lignes: string[][] }
  legende?: { titre: string; entrees: { couleur: string; libelle: string }[] }
}

/** Scénarios de répartition de l'étape 5 (règles dans repartition.ts). Le dossier de l'ONG est dans dossier.ts. */
export type ScenarioRepartition = 'proportionnel' | 'urgence' | 'production'

/** Accès de l'export (phase D2) : la carte unique, les données des étapes, et la mise en vue d'une étape. */
export interface AccesExport {
  /** l'instance Mapbox unique de la scène (null avant le chargement ou sans WebGL) */
  carte: () => CarteMapbox | null
  /** la dernière sortie publiée par chaque étape ouverte */
  etapes: () => Partial<Record<ModeOng, EtapeExport>>
  /** ouvre l'étape et attend que la carte soit posée (événement `idle`) ; rejet si la carte disparaît ou après 20 s */
  activer: (id: ModeOng) => Promise<void>
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
  exporter: AccesExport
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

/** Le parcours de l'agriculteur, dans l'ordre du bouton « Suivant », avec la question de chaque fonctionnalité. */
export const PARCOURS_AGRICULTEUR = [
  { id: 'parcelle', question: 'Où est mon champ ?' },
  { id: 'saison', question: 'Va-t-il bien pleuvoir ?' },
  { id: 'semer', question: 'Que semer ?' },
  { id: 'semis', question: 'Quand semer ?' },
  { id: 'surface', question: 'Combien m’en faut-il ?' },
  { id: 'contreSaison', question: 'Puis-je cultiver en saison sèche ?' },
] as const
export type ModeAgriculteur = (typeof PARCOURS_AGRICULTEUR)[number]['id']
export const questionDe = (id: ModeAgriculteur) => PARCOURS_AGRICULTEUR.find((p) => p.id === id)!.question

/** Le parcours de l'ONG et des services de l'État, en 7 étapes, dans l'ordre du bouton « Suivant ». */
export const PARCOURS_ONG = [
  { id: 'campagne', question: 'Où agir en priorité ?' },
  { id: 'saison', question: 'Que prévoit la saison ?' },
  { id: 'alerte', question: 'Où la récolte peut-elle chuter ?' },
  { id: 'besoins', question: 'Combien faut-il, et pour quel budget ?' },
  { id: 'repartir', question: 'Comment répartir mon stock, et livrer quand ?' },
  { id: 'potentiel', question: 'Où sont les zones à fort potentiel ?' },
  { id: 'exporter', question: 'Exporter le dossier' },
] as const
export type ModeOng = (typeof PARCOURS_ONG)[number]['id']
export type IdEtape = ModeAgriculteur | ModeOng
export const questionOng = (id: ModeOng) => PARCOURS_ONG.find((p) => p.id === id)!.question
/** Le parcours du profil : celui de l'agriculteur, ou celui de l'ONG et des services de l'État. */
export const parcoursDe = (cadre: Pick<Cadre, 'user'>): readonly { id: IdEtape; question: string }[] =>
  cadre.user.role === 'PRODUCTEUR' ? PARCOURS_AGRICULTEUR : PARCOURS_ONG

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
 * L'année d'une fonctionnalité.
 * - Par défaut (ONG, État) : celle du cadre si le modèle la couvre, sinon la campagne à venir.
 * - `garder` (agriculteur) : toujours celle du cadre, la même dans les 6 écrans ; `couverte` dit si le modèle
 *   la prévoit (sinon, pas d'appel à l'API). La saisie propose alors toutes les années passées.
 * `passees` : les années passées proposées ; `tendance` : année au-delà de la prévision océan.
 */
export function useAnnee(cadre: Cadre, modele: CodeModele, garder = false) {
  const { campagnes } = cadre.ref
  return useMemo(() => {
    const aVenir = anneeAVenir(campagnes)
    const couverteCadre = anneeCouverte(campagnes, modele, cadre.annee)
    const annee = garder || couverteCadre ? cadre.annee : aVenir
    const passees = anneesPassees(campagnes, garder ? 'M1' : modele)
    return { annee, aVenir, passees, max: DERNIERE_ANNEE_PREVISION, tendance: annee > aVenir, passee: annee < aVenir, couverte: anneeCouverte(campagnes, modele, annee) }
  }, [campagnes, modele, cadre.annee, garder])
}
