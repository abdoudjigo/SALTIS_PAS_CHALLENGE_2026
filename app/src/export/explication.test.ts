import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exporterDossierNational } from './dossierNational'
import type { DonneesDossier } from './types'

const { expliquerExport } = vi.hoisted(() => ({ expliquerExport: vi.fn() }))
vi.mock('../api', () => ({ api: { expliquerExport } }))

import { redigerExplications } from './explication'

const sections = [
  { id: 'etape-1', titre: 'Priorités', contexte: 'Phase 3.' },
  { id: 'etape-2', titre: 'Saison', contexte: 'Saison normale.' },
]

describe('explications des exports', () => {
  beforeEach(() => expliquerExport.mockReset())

  it('associe les textes IA aux identifiants de section', async () => {
    expliquerExport.mockResolvedValue({ explications: ['Lecture des priorités.', 'Lecture de la saison.'] })

    await expect(redigerExplications(sections)).resolves.toMatchObject({
      textes: { 'etape-1': 'Lecture des priorités.', 'etape-2': 'Lecture de la saison.' },
      iaDisponible: true,
      avertissement: null,
    })
  })

  it('refuse une réponse IA incomplète et utilise les repères de lecture locaux', async () => {
    expliquerExport.mockResolvedValue({ explications: ['Une seule explication.'] })

    const resultat = await redigerExplications(sections)
    expect(resultat.iaDisponible).toBe(false)
    expect(resultat.avertissement).toContain("format d'explication invalide")
    expect(resultat.textes['etape-1']).toContain('Priorités')
    expect(resultat.textes['etape-2']).toContain('Saison')
  })

  it('insère les explications dans un PDF de dossier généré', async () => {
    expliquerExport.mockResolvedValue({ explications: ['Lecture de la campagne.', 'Lecture des priorités.', 'Lecture de la répartition.', 'Lecture des sources.'] })
    const donnees: DonneesDossier = {
      organisation: 'Organisation test',
      annee: 2026,
      campagne: '2026',
      culture: 'Mil',
      intrant: 'Urée',
      scenario: 'Proportionnel',
      prix: [],
      etapes: [{
        id: 1,
        titre: 'Priorités',
        question: 'Où agir ?',
        checklist: [],
        activer: async () => undefined,
      }],
      repartition: { colonnes: ['Département'], lignes: [['Kolda']] },
      sources: [],
      mentions: [],
      contoursGadm: false,
      dateExport: new Date('2026-01-01T00:00:00Z'),
    }

    const resultat = await exporterDossierNational(donnees, { map: null, webgl: false }, undefined, { telecharger: false })

    expect(resultat.explicationsIA).toBe(true)
    expect(resultat.nbPages).toBeGreaterThan(0)
    expect(expliquerExport).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'etape-1', titre: 'Priorités' }),
      expect.objectContaining({ id: 'repartition', titre: 'Répartition complète' }),
    ]))
  })
})
