import { describe, expect, it } from 'vitest'
import { langueDe } from './accueil'
import { LANGUE_PAR_DEFAUT, LIRE_CHAQUE_ONGLET } from './voiceMessages'

describe('lecture automatique des onglets', () => {
  it('lit chaque onglet pour les deux profils', () => {
    expect(LIRE_CHAQUE_ONGLET.agriculteur).toBe(true)
    expect(LIRE_CHAQUE_ONGLET.organisation).toBe(true)
  })

  it('utilise le français par défaut dans l’espace ONG et État', () => {
    expect(LANGUE_PAR_DEFAUT.organisation).toBe('fr')
    expect(langueDe('organisation')).toBe('fr')
  })
})
