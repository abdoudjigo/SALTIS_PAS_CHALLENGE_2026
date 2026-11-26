// Contrat des routes /api/v1/observatoire/* (copie de api/schemas/observatoire.py).
// Règle : valeur absente = null, jamais 0. FAOSTAT est une série distincte. Aucune prévision.

export type Indicateur = 'production' | 'surface' | 'rendement'
export type Niveau = 'PAYS' | 'REGION' | 'DEPARTEMENT'

/** `meta` des réponses : source (mart) et date de construction des données */
export interface MetaObs {
  version?: string
  genere_le?: string
  source?: string
  avertissements?: string[]
}

export interface ReponseObs<T> {
  meta: MetaObs
  donnees: T
}

export interface CultureObs {
  culture: string
  annees_couvertes: number[]
  premiere_annee: number
  derniere_annee: number
  mention: string | null
  a_totaux: boolean
  faostat_annees: number[]
}

export interface ZoneObs {
  code: string
  nom: string
  niveau: Niveau
  code_region: string | null
}

export interface FiltresObs {
  cultures: CultureObs[]
  sans_donnees: string[]
  mention_sans_donnees: string
  annees: number[]
  derniere_annee_departements: number
  derniere_annee_faostat: number | null
  zones: ZoneObs[]
  couverture: string[]
  sources: string[]
}

export interface IndicateurZone {
  indicateur: Indicateur
  libelle: string
  unite: string
  valeur: number | null
  derniere_annee_disponible: number | null
  variation_n1_pct: number | null
  comparable_n1: boolean | null
  ecart_moyenne_10_ans_pct: number | null
  nb_annees_moyenne: number | null
  rang: number | null
  nb_classes: number | null
  part_nationale_pct: number | null
  est_complet: boolean | null
  nb_departements_observes: number | null
  nb_departements_attendus: number | null
  type_superficie: string | null
  serie: 'DAPSA' | null
  source: string | null
  note: string | null
}

export interface FaostatPoint {
  annee: number
  rendement_kg_ha: number | null
  variation_n1_pct: number | null
  ecart_moyenne_10_ans_pct: number | null
  source: 'FAOSTAT'
}

export interface IndicateursObs {
  annee: number
  culture: string
  niveau: Niveau
  code_zone: string
  zone: string
  derniere_annee_departements: number
  indicateurs: IndicateurZone[]
  rendement_faostat: FaostatPoint | null
}

export interface PointSerie {
  annee: number
  valeur: number | null
  est_complet: boolean | null
  nb_departements_observes: number | null
  nb_departements_attendus: number | null
  type_superficie: string | null
  source: string | null
  note: string | null
}

export interface PointOfficiel {
  indicateur: string
  annee: number | null
  valeur: number
  unite: string | null
  document: string
  page: string
  url: string | null
  note: string | null
}

export interface ReferenceRendement {
  valeur: number
  unite: string | null
  note: string
  document: string
  page: string
}

export interface SerieObs {
  culture: string
  indicateur: Indicateur
  unite: string
  niveau: Niveau
  code_zone: string
  zone: string
  derniere_annee_departements: number
  mention_arret: string
  rupture_type_superficie: number
  points: PointSerie[]
  serie_faostat: FaostatPoint[]
  note_faostat: string | null
  /** Ligne de référence SSA (tableau 8) : pays et rendement seulement ; absente d'une API plus ancienne */
  reference_rendement?: ReferenceRendement | null
  points_officiels: PointOfficiel[]
}

export interface CarteDepartementObs {
  code_departement: string
  departement: string
  code_region: string | null
  region: string | null
  valeur: number | null
  a_donnee: boolean
  rang: number | null
  est_complet: boolean | null
  type_superficie: string | null
  source: string | null
  note: string | null
}

export interface ClassementObs {
  rang: number
  code_departement: string
  departement: string
  region: string | null
  valeur: number
  est_complet: boolean | null
  annee_comparaison: number
  valeur_comparaison: number | null
  progression_10_ans_pct: number | null
  rupture_type_superficie: boolean
  source: string | null
}

export interface ObjectifObs {
  indicateur: string
  libelle: string
  portee: 'culture' | 'groupe' | 'national'
  culture: string | null
  cultures_concernees: string[]
  unite: string | null
  valeur_reference: number | null
  annee_reference: number | null
  cible: number | null
  annee_cible: number | null
  document: string
  page: string
  url: string | null
  note: string | null
}

export interface ObjectifsObs {
  culture: string | null
  zone: string
  objectifs: ObjectifObs[]
  message: string | null
}

export const UNITES: Record<Indicateur, string> = { production: 't', surface: 'ha', rendement: 'kg/ha' }
export const LIBELLES: Record<Indicateur, string> = { production: 'Production', surface: 'Superficie', rendement: 'Rendement' }
