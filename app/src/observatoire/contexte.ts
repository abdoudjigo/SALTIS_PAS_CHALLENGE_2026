// État courant de l'Observatoire, exposé pour l'export PDF (lot 3) sans le recalculer.
//
// Usage, dans un composant rendu sous la page /observatoire :
//   const etat = useEtatObservatoire()
//   if (etat?.pret) { etat.selection; etat.donnees.serie; etat.refs.courbe.current … }
//
// - `selection` : filtres de l'URL (année, code culture, zone, indicateur) ; `libelles` : textes affichés.
// - `donnees` : réponses de l'API telles quelles ({ meta, donnees }, ou null si la zone n'a pas de donnée).
// - `refs` : éléments DOM des blocs (chiffres clés, objectifs, courbe, carte SVG, classement, à retenir, sources),
//   à capturer avec app/src/export (capture.ts). `refs.carte` pointe sur l'élément <svg> lui-même.
// - `phrases` : « Ce qu'il faut retenir », déjà calculées (gabarits déterministes, retenir.ts).
import { createContext, useContext, type RefObject } from 'react'
import type { Selection } from './donnees'
import type {
  CarteDepartementObs, ClassementObs, FiltresObs, IndicateursObs, ObjectifsObs, ReponseObs, SerieObs,
} from './types'

export interface RefsObservatoire {
  chiffres: RefObject<HTMLElement | null>
  objectifs: RefObject<HTMLElement | null>
  courbe: RefObject<HTMLElement | null>
  carte: RefObject<SVGSVGElement | null>
  classement: RefObject<HTMLElement | null>
  retenir: RefObject<HTMLElement | null>
  sources: RefObject<HTMLElement | null>
}

export interface EtatObservatoire {
  /** Vrai quand toutes les requêtes de la vue courante ont répondu */
  pret: boolean
  selection: Selection
  libelles: { culture: string; zone: string; niveau: string; indicateur: string }
  filtres: FiltresObs
  donnees: {
    indicateurs: ReponseObs<IndicateursObs> | null | undefined
    serie: ReponseObs<SerieObs> | null | undefined
    carte: ReponseObs<CarteDepartementObs[]> | null | undefined
    classement: ReponseObs<ClassementObs[]> | null | undefined
    objectifs: ReponseObs<ObjectifsObs> | null | undefined
  }
  phrases: string[]
  refs: RefsObservatoire
}

export const ContexteObservatoire = createContext<EtatObservatoire | null>(null)

/** État courant de la page /observatoire (null hors de la page ou avant le chargement des filtres) */
export const useEtatObservatoire = () => useContext(ContexteObservatoire)
