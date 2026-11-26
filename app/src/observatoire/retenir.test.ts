import { describe, expect, it } from 'vitest'
import { codeCulture, texteIncomplet } from './outils'
import { phrasesARetenir } from './retenir'
import type { IndicateurZone, IndicateursObs } from './types'

const base: IndicateurZone = {
  indicateur: 'production', libelle: 'Production', unite: 't', valeur: null, derniere_annee_disponible: null, variation_n1_pct: null,
  comparable_n1: null, ecart_moyenne_10_ans_pct: null, nb_annees_moyenne: null, rang: null, nb_classes: null, part_nationale_pct: null,
  est_complet: true, nb_departements_observes: 1, nb_departements_attendus: 1, type_superficie: null, serie: 'DAPSA', source: null, note: null,
}
const reponse = (indicateurs: Partial<IndicateurZone>[], niveau: IndicateursObs['niveau'] = 'DEPARTEMENT'): IndicateursObs => ({
  annee: 2021, culture: 'MIL (SOUNA)', niveau, code_zone: 'X', zone: 'Kaffrine', derniere_annee_departements: 2021, rendement_faostat: null,
  indicateurs: indicateurs.map((i) => ({ ...base, ...i })),
})

describe('phrasesARetenir', () => {
  it('omet chaque phrase dont une donnée manque, sans jamais écrire 0', () => {
    const p = phrasesARetenir({ indicateurs: reponse([{ indicateur: 'production', valeur: null, variation_n1_pct: 5 }]), classement: [], indicateurClassement: 'production', culture: 'mil', zone: 'Kaffrine' })
    expect(p).toEqual([])
  })

  it('écrit les trois phrases et signale un total partiel', () => {
    const p = phrasesARetenir({
      indicateurs: reponse([
        { indicateur: 'production', valeur: 52780, variation_n1_pct: -25.99, rang: 7, nb_classes: 41, part_nationale_pct: 5.08, est_complet: false, nb_departements_observes: 40, nb_departements_attendus: 42 },
        { indicateur: 'rendement', unite: 'kg/ha', valeur: 1442.7, ecart_moyenne_10_ans_pct: 47.03, nb_annees_moyenne: 10 },
      ]),
      classement: [], indicateurClassement: 'production', culture: 'mil', zone: 'Kaffrine',
    })
    expect(p).toHaveLength(3)
    expect(p[0]).toContain('en baisse de 26')
    expect(p[0]).toContain('total partiel : 40 départements sur 42')
    expect(p[1]).toContain('au-dessus de la moyenne des 10 années')
    expect(p[2]).toContain('7e sur 41 départements')
  })
})

describe('outils', () => {
  it('code court de culture accepté par l’API', () => {
    expect(codeCulture('MIL (SOUNA)')).toBe('mil')
    expect(codeCulture('MAÏS')).toBe('mais')
    expect(codeCulture('RIZ (IRRIGUÉ)')).toBe('riz')
  })
  it('badge incomplet n/N', () => {
    expect(texteIncomplet({ est_complet: false, nb_departements_observes: 40, nb_departements_attendus: 42 })).toBe('incomplet (40/42 départements)')
    expect(texteIncomplet({ est_complet: true, nb_departements_observes: 42, nb_departements_attendus: 42 })).toBeNull()
  })
})
