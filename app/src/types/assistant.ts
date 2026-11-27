// Réponse de l'assistant (POST /api/v1/voix/texte, voir api/routes/voix.py)

export type SujetAssistant = 'saison' | 'semis' | 'culture' | 'besoins' | 'alerte' | 'bulletin' | 'aide' | 'libre' | 'hors_champ'

export interface SourceAssistant {
  titre: string
  theme: string
  fichier?: string
}

export interface ReponseAssistant {
  transcription: string | null
  fonctionnalite: SujetAssistant
  texte_fr: string
  /** phrases types en wolof, à faire relire par un locuteur */
  texte_wo: string
  code_departement: string | null
  departement: string | null
  culture: string | null
  annee: number | null
  nature: string | null
  /** écran à ouvrir pour voir la réponse sur la carte (mode null : rien à montrer) */
  vue: { mode: string | null; code_departement: string | null; culture: string | null; annee: number | null }
  sources: SourceAssistant[]
  /** vrai si le modèle de langue a rédigé le texte français à partir des sources */
  redige_par_ia: boolean
}
