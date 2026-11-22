import { describe, expect, it } from 'vitest'
import { libelle, mm, nombre, pct, tonnes, VIDE } from './format'
import { lireNombre, lireSaisie } from './saisie'

// Règle du contrat de données : une valeur inconnue (NULL) ne s'affiche jamais comme 0
describe('formatage des nombres', () => {
  it('null, undefined et NaN s’affichent « — », jamais 0', () => {
    expect(nombre(null)).toBe(VIDE)
    expect(nombre(undefined)).toBe(VIDE)
    expect(nombre(Number.NaN)).toBe(VIDE)
    expect(mm(null)).toBe(VIDE)
    expect(pct(null)).toBe(VIDE)
    expect(tonnes(null)).toBe(VIDE)
  })

  it('un vrai zéro reste 0', () => {
    expect(nombre(0)).toBe('0')
    expect(pct(0)).toBe('0 %')
  })

  it('format français : espace des milliers, virgule décimale, unités', () => {
    expect(nombre(1234567).replace(/\s/g, ' ')).toBe('1 234 567')
    expect(nombre(2.5, { decimales: 1 })).toBe('2,5')
    expect(mm(612)).toBe('612 mm')
    expect(nombre(5, { signe: true, unite: '%' })).toBe('+5 %')
  })

  it('les petites quantités en tonnes gardent une décimale', () => {
    expect(tonnes(2.46)).toBe('2,5 t')
    expect(tonnes(1500).replace(/\s/g, ' ')).toBe('1 500 t')
  })

  it('libellés : première lettre en capitale, « Sénégal » conservé', () => {
    expect(libelle('MIL (SOUNA)')).toBe('Mil (souna)')
    expect(libelle('vallée du fleuve sénégal')).toBe('Vallée du fleuve Sénégal')
    expect(libelle(null)).toBe(VIDE)
  })
})

describe('lecture des saisies', () => {
  it('accepte virgule, point et espaces de milliers', () => {
    expect(lireNombre('2,5')).toBe(2.5)
    expect(lireNombre('10 000')).toBe(10000)
    expect(lireNombre('abc')).toBeNull()
    expect(lireNombre('1e3')).toBeNull()
  })

  it('contrôle les bornes avec un message lisible', () => {
    expect(lireSaisie('', { max: 100 })).toMatchObject({ valeur: null, erreur: null, vide: true })
    expect(lireSaisie('-2', { max: 100 }).erreur).toMatch(/positif/)
    expect(lireSaisie('150', { max: 100, unite: 'ha' }).erreur).toBe('La valeur ne peut pas dépasser 100 ha.')
    expect(lireSaisie('0', { max: 100, minExclu: true }).erreur).toMatch(/supérieure à 0/)
    expect(lireSaisie('-16,2', { min: -180, max: 180, negatif: true, unite: '°' }).valeur).toBe(-16.2)
  })
})
