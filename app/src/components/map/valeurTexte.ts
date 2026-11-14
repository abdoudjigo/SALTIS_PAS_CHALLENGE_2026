import type { IndicateurCarte, ValeurCarte } from '../../lib/echelles'
import { nombre, VIDE } from '../../lib/format'

export function valeurTexte(valeur: ValeurCarte, indicateur: IndicateurCarte) {
  if (valeur === null || valeur === undefined) return VIDE
  if (typeof valeur === 'string') return valeur
  return nombre(valeur, { decimales: 0, unite: indicateur.unite, signe: indicateur.unite === '%' })
}
