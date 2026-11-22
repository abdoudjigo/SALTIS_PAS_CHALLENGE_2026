import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { LigneTerritoireAgrodistrib } from '../../types/marts'
import {
  auProrata, enSacsEntiers, lignesMulticritere, ordonner, poidsMulticritere, prorataMulticritere, remplirDansLOrdre,
  type Criteres, type Demande, type LigneMulticritere,
} from './repartition'

const somme = (parts: { quantite_t: number }[]) => parts.reduce((s, p) => s + p.quantite_t, 0)
const demandes: Demande[] = [
  { code: 'A', besoin_t: 100, vulnerabilite: 80 },
  { code: 'B', besoin_t: 50, vulnerabilite: 20 },
  { code: 'C', besoin_t: 30, vulnerabilite: null },
]
const lignes: LigneMulticritere[] = [
  { code: 'A', culture: 'MIL', besoin_t: 100, vulnerabilite: 0.8, valeur_indicative: 0.1 },
  { code: 'A', culture: 'MAÏS', besoin_t: 20, vulnerabilite: 0.8, valeur_indicative: 0.3 },
  { code: 'B', culture: 'MIL', besoin_t: 50, vulnerabilite: 0.2, valeur_indicative: 0.9 },
  { code: 'C', culture: 'MIL', besoin_t: 30, vulnerabilite: 0.5, valeur_indicative: 0.5 },
]

describe('scénario Multicritère (moteur AgroDistrib, agrodistrib-v1)', () => {
  it('ne distribue jamais plus que le stock, ni plus que le besoin de chaque département', () => {
    for (const stock of [0, 40, 120, 180, 1000]) {
      for (const arbitrage of [0, 50, 100]) {
        const r = prorataMulticritere(lignes, stock, arbitrage)
        expect(somme(r.parts) + r.reste_t).toBeCloseTo(Math.max(stock, 0), 6)
        r.parts.forEach((p) => expect(p.quantite_t).toBeLessThanOrEqual(p.besoin_t + 1e-9))
      }
    }
  })

  it('somme par département : A regroupe ses deux cultures', () => {
    const r = prorataMulticritere(lignes, 1000, 50)
    expect(r.parts.find((p) => p.code === 'A')!.besoin_t).toBe(120)
    r.parts.forEach((p) => expect(p.couverture_pct).toBeCloseTo(100, 6))
    expect(r.reste_t).toBeCloseTo(800, 6)
  })

  it('équité (0 %) favorise le plus vulnérable, rendement (100 %) la plus forte valeur indicative', () => {
    const partDe = (arbitrage: number, code: string) => prorataMulticritere(lignes, 90, arbitrage).parts.find((p) => p.code === code)!.quantite_t
    expect(partDe(0, 'A')).toBeGreaterThan(partDe(100, 'A'))
    expect(partDe(100, 'B')).toBeGreaterThan(partDe(0, 'B'))
  })

  it('remplissage par niveau identique à la recherche de racine de ml (au_prorata)', () => {
    const x = auProrata([10, 10, 100], [1, 1, 1], 60) // les deux petits besoins servis en entier, le reste au troisième
    expect(x).toEqual([10, 10, 40])
  })

  it('préparation : vulnérabilité = score / 100, critère vide = médiane des autres lignes (jamais 0)', () => {
    const t = (p: Partial<LigneTerritoireAgrodistrib>) =>
      ({ code_departement: 'K', culture: 'MIL', besoin_semences_applicable: true, potentiel_evalue: true, potentiel_gain_kg_ha: 100,
        proba_cycle_couvert_moyen_pct: 50, proba_saison_seche_pct: 20, score_vulnerabilite: 60, besoin_npk_15_15_15_t: 10, ...p }) as LigneTerritoireAgrodistrib
    const r = lignesMulticritere([
      t({ code_departement: 'A', potentiel_gain_kg_ha: 200, score_vulnerabilite: 80 }),
      t({ code_departement: 'B', potentiel_gain_kg_ha: 100, score_vulnerabilite: null }),
      t({ code_departement: 'C', besoin_npk_15_15_15_t: null }), // dose inconnue : non servie
    ], 'besoin_npk_15_15_15_t', null)
    expect(r.map((l) => l.code)).toEqual(['A', 'B'])
    expect(r[0].vulnerabilite).toBeCloseTo(0.8, 9)
    expect(r[1].vulnerabilite).toBeCloseTo(0.8, 9) // médiane des autres (une seule : 0,8)
    expect(r[0].valeur_indicative).toBeCloseTo(1 * 0.5 * 0.8, 9) // potentiel max de la culture
    expect(r[1].valeur_indicative).toBeCloseTo(0.5 * 0.5 * 0.8, 9)
  })
})

// Équivalence avec le moteur Python : mêmes lignes, même stock, mêmes α → mêmes quantités (ml/sorties, 18/11/2026).
// Les critères du CSV sont arrondis à 3 décimales (0,24 au lieu de 0,2398…) : l'écart attendu vient de cet arrondi,
// pas du calcul. Le moteur Python lui-même, relancé sur ces critères arrondis, s'écarte de 0,08 % au plus.
// Tolérance retenue : 0,2 % de la quantité (+ 1 kg). Une erreur de formule (plancher, α inversé) donne plusieurs %.
describe('équivalence avec ml/agrodistrib (sorties versionnées)', () => {
  const lireCsv = (chemin: string) => {
    const [entete, ...rangs] = readFileSync(new URL(chemin, import.meta.url), 'utf8').trim().split('\n')
    const colonnes = entete.split(',')
    return rangs.map((r) => Object.fromEntries(r.split(',').map((v, i) => [colonnes[i], v])))
  }
  const parametres = JSON.parse(readFileSync(new URL('../../../../ml/sorties/agrodistrib_parametres.json', import.meta.url), 'utf8'))
  const rangs = lireCsv('../../../../ml/sorties/agrodistrib_departements.csv')

  for (const scenario of ['Équité', 'Équilibré', 'Rendement']) {
    it(`scénario ${scenario} : quantités identiques à l'arrondi des critères près`, () => {
      const r = rangs.filter((x) => x.scenario === scenario)
      expect(r.length).toBeGreaterThan(10)
      const alpha = Number(r[0].alpha)
      const l: LigneMulticritere[] = r.map((x) => ({ code: x.code_departement, culture: x.culture, besoin_t: Number(x.besoin_t), vulnerabilite: Number(x.vulnerabilite), valeur_indicative: Number(x.valeur_indicative) }))
      const q = auProrata(l.map((x) => x.besoin_t), l.map((x) => poidsMulticritere(x, alpha)), parametres.stock_t)
      r.forEach((x, i) => {
        const attendu = Number(x.quantite_proposee_t)
        expect(Math.abs(q[i] - attendu)).toBeLessThanOrEqual(0.001 + 0.002 * attendu)
      })
      expect(q.reduce((s, v) => s + v, 0)).toBeCloseTo(parametres.stock_t, 3)
    })
  }
})

describe('scénarios Urgence et Production', () => {
  const criteres = new Map<string, Criteres>([
    ['A', { phase: 2, personnes_phase3_5: 1000, vulnerabilite: 80, potentiel_adapte: null }],
    ['B', { phase: 3, personnes_phase3_5: 500, vulnerabilite: 20, potentiel_adapte: 300 }],
    ['C', { phase: null, personnes_phase3_5: null, vulnerabilite: 50, potentiel_adapte: 100 }],
  ])

  it('Urgence : la phase la plus grave d’abord, une phase inconnue en dernier', () => {
    expect(ordonner(demandes, criteres, 'urgence').map((d) => d.code)).toEqual(['B', 'A', 'C'])
  })

  it('Production : le plus fort potentiel d’abord, sans potentiel ensuite par besoin', () => {
    expect(ordonner(demandes, criteres, 'production').map((d) => d.code)).toEqual(['B', 'C', 'A'])
  })

  it('remplissage dans l’ordre : besoins complets tant qu’il reste du stock', () => {
    const r = remplirDansLOrdre(120, demandes)
    expect(r.parts.map((p) => p.quantite_t)).toEqual([100, 20, 0])
    expect(r.reste_t).toBe(0)
  })
})

describe('unité « sacs »', () => {
  it('arrondit chaque part au sac de 50 kg inférieur et rend la différence au reste', () => {
    const r = enSacsEntiers({ parts: [{ code: 'A', besoin_t: 1, quantite_t: 0.123, couverture_pct: 12.3 }], reste_t: 0 }, 0.123)
    expect(r.parts[0].quantite_t).toBeCloseTo(0.1, 9) // 2 sacs = 100 kg
    expect(r.reste_t).toBeCloseTo(0.023, 9)
  })
})
