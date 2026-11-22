import { api } from '../api'
import { ApiError } from '../api/client'

export interface SectionExplication {
  id: string
  titre: string
  contexte: string
}

export interface ExplicationsExport {
  textes: Record<string, string>
  iaDisponible: boolean
  avertissement: string | null
}

function messageErreur(e: unknown) {
  return typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string' ? e.message : 'erreur inconnue'
}

function estErreurApi(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'name' in e && e.name === 'ApiError'
    && 'message' in e && typeof e.message === 'string'
}

export async function redigerExplications(sections: SectionExplication[]): Promise<ExplicationsExport> {
  try {
    const resultat = await api.expliquerExport(sections)
    if (
      !Array.isArray(resultat.explications)
      || resultat.explications.length !== sections.length
      || resultat.explications.some((texte) => typeof texte !== 'string' || !texte.trim())
    ) {
      throw new ApiError("Le service IA a renvoyé un format d'explication invalide.", { status: 502 })
    }
    return {
      textes: Object.fromEntries(sections.map((section, i) => [section.id, resultat.explications[i]])),
      iaDisponible: true,
      avertissement: null,
    }
  } catch (e) {
    if (!estErreurApi(e)) throw e
    return {
      textes: Object.fromEntries(sections.map((section) => [
        section.id,
        `Cette partie présente « ${section.titre} ». Consultez les indicateurs, la checklist et les sources ci-dessous ; les mentions « à confirmer » et « repérage indicatif » doivent être vérifiées.`,
      ])),
      iaDisponible: false,
      avertissement: messageErreur(e),
    }
  }
}
