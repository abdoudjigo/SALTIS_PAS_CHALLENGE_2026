import { describe, expect, it } from 'vitest'
import { SEUIL_ALERTE_PCT } from '../../types/previsions'
import { estAlerte, risqueHabituelEleve } from './alertes'

// Audit IA-01 : une alerte exige un risque au-dessus du seuil ET une prévision fiable
describe('alertes récolte', () => {
  const ligne = (proba: number | null, fiable: boolean | null) => ({ proba_chute_pct: proba, alerte_fiable: fiable })

  it('alerte seulement si le risque dépasse le seuil et que la prévision est fiable', () => {
    expect(estAlerte(ligne(SEUIL_ALERTE_PCT, true))).toBe(true)
    expect(estAlerte(ligne(80, true))).toBe(true)
    expect(estAlerte(ligne(SEUIL_ALERTE_PCT - 0.1, true))).toBe(false)
  })

  it('jamais d’alerte sans prévision fiable (années 2026-2035 : PROJECTION_NON_EVALUEE)', () => {
    expect(estAlerte(ligne(90, false))).toBe(false)
    expect(estAlerte(ligne(90, null))).toBe(false)
  })

  it('un risque élevé sans prévision fiable est un « risque habituel élevé »', () => {
    expect(risqueHabituelEleve(ligne(90, false))).toBe(true)
    expect(risqueHabituelEleve(ligne(90, null))).toBe(true)
    expect(risqueHabituelEleve(ligne(90, true))).toBe(false)
    expect(risqueHabituelEleve(ligne(10, false))).toBe(false)
  })

  it('une probabilité inconnue n’est ni une alerte ni un risque élevé', () => {
    expect(estAlerte(ligne(null, true))).toBe(false)
    expect(risqueHabituelEleve(ligne(null, false))).toBe(false)
  })
})
