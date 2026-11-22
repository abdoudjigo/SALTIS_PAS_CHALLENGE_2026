import { describe, expect, it } from 'vitest'
import type { LigneBesoin, LigneTerritoireAgrodistrib } from '../../types/marts'
import { besoinsParDepartement, partSurfaceAvecDose } from './besoinsPays'
import { anneesSur5, dose, joursEau, sacs, sacsEngraisParHa } from './conseil'

// Lignes minimales : seuls les champs lus par les règles comptent
const territoire = (p: Partial<LigneTerritoireAgrodistrib>) =>
  ({ code_departement: 'K', departement: 'Kolda', zone_agroecologique: 'Casamance', culture: 'MIL', superficie_reference_ha: 100,
    score_vulnerabilite: 50, besoin_semences_applicable: true, besoin_npk_15_15_15_t: null, ...p }) as LigneTerritoireAgrodistrib

describe('besoins du pays (somme par département)', () => {
  it('une dose inconnue ne compte jamais pour 0 : elle est comptée à part', () => {
    const r = besoinsParDepartement([
      territoire({ culture: 'MIL', besoin_npk_15_15_15_t: 12 }),
      territoire({ culture: 'SORGHO', besoin_npk_15_15_15_t: null }),
    ], 'besoin_npk_15_15_15_t', null)
    expect(r).toHaveLength(1)
    expect(r[0].besoin_t).toBe(12)
    expect(r[0].sansDose).toBe(1)
  })

  it('aucune dose connue : le besoin reste inconnu (null), pas 0', () => {
    const r = besoinsParDepartement([territoire({ besoin_npk_15_15_15_t: null })], 'besoin_npk_15_15_15_t', null)
    expect(r[0].besoin_t).toBeNull()
  })

  it('part de la surface couverte par une dose connue', () => {
    const lignes = [territoire({ superficie_reference_ha: 300, besoin_npk_15_15_15_t: 5 }), territoire({ culture: 'SORGHO', superficie_reference_ha: 100 })]
    expect(partSurfaceAvecDose(lignes, 'besoin_npk_15_15_15_t', null)).toBeCloseTo(75, 6)
    expect(partSurfaceAvecDose([], 'besoin_npk_15_15_15_t', null)).toBeNull()
  })
})

describe('conseils à l’agriculteur', () => {
  const besoin = (p: Partial<LigneBesoin>) =>
    ({ superficie_reference_ha: 1000, besoin_semences_applicable: true, besoin_npk_15_15_15_t: null, besoin_uree_t: null, besoin_dap_t: null, ...p }) as LigneBesoin

  it('dose par hectare = besoin (t) × 1000 ÷ superficie ; inconnue si le besoin l’est', () => {
    expect(dose(besoin({ besoin_npk_15_15_15_t: 150 }), 'besoin_npk_15_15_15_t')).toBe(150)
    expect(dose(besoin({}), 'besoin_npk_15_15_15_t')).toBeNull()
    expect(dose(besoin({ superficie_reference_ha: 0, besoin_npk_15_15_15_t: 10 }), 'besoin_npk_15_15_15_t')).toBeNull()
  })

  it('sacs de 50 kg arrondis au demi-sac supérieur', () => {
    expect(sacs(150)).toBe(3)
    expect(sacs(10)).toBe(0.5)
    expect(sacs(26)).toBe(1)
  })

  it('sacs d’engrais pour 1 ha : inconnu (null) sans aucune dose, jamais 0', () => {
    expect(sacsEngraisParHa(besoin({}))).toBeNull()
    expect(sacsEngraisParHa(undefined)).toBeNull()
    expect(sacsEngraisParHa(besoin({ besoin_npk_15_15_15_t: 150, besoin_uree_t: 100 }))).toBe(5)
  })

  it('jours d’eau du sol et « années sur 5 »', () => {
    expect(joursEau(null)).toBeNull()
    expect(joursEau(100)).toBe(25)
    expect(anneesSur5(null)).toBe('non disponible')
    expect(anneesSur5(60)).toBe('3 années sur 5')
    expect(anneesSur5(99)).toBe('presque chaque année')
  })
})
