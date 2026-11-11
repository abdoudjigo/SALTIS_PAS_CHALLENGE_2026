import type { IndicateurCarte, ValeurCarte } from '../../lib/echelles'
import type { Departement } from '../../types/marts'

/** Un département prêt à être dessiné : position, valeur de l'indicateur, couleur calculée */
export interface PointCarte extends Departement {
  valeur: ValeurCarte
  couleur: string
}

export interface PropsCarteInterne {
  points: PointCarte[]
  indicateur: IndicateurCarte
  selection: string | null
  onSelect?: (code: string) => void
}
