// Types du module d'export PDF (dossier national et fiche département), pilotés par l'appelant.
import type { Map as CarteMapbox } from 'mapbox-gl'

/** Ce dont la capture a besoin de l'instance Mapbox unique (scene/carte/Carte.tsx) : rien d'autre. */
export type CarteCapturable = Pick<CarteMapbox, 'once' | 'triggerRepaint' | 'getCanvas'>

/** Cellule de tableau : null ou undefined s'écrit « non disponible », jamais 0. */
export type Cellule = string | number | null | undefined

export interface Tableau {
  colonnes: string[]
  lignes: Cellule[][]
  /** largeurs relatives des colonnes (même longueur que colonnes) */
  largeurs?: number[]
  /** source du tableau (mart, méthode, période) : imprimée sous le tableau */
  source?: string
  note?: string
}

export interface EntreeLegende {
  /** couleur fournie par l'appelant (#RRGGBB), jamais inventée ici */
  couleur: string
  libelle: string
}

export interface Legende {
  titre: string
  entrees: EntreeLegende[]
  note?: string
}

/** mêmes états que la checklist de l'écran (scene/interface/fiche.tsx) */
export type EtatCheck = 'ok' | 'attention' | 'non' | 'info'

export interface ElementChecklist {
  etat: EtatCheck
  texte: string
}

export interface Etape {
  id: number
  titre: string
  question: string
  checklist: ElementChecklist[]
  tableau?: Tableau
  legende?: Legende
  /** met la carte dans la vue de l'étape (même sélection que l'écran) */
  activer(): Promise<void>
}

/** Accès à la carte affichée. map null ou webgl faux : le PDF écrit « carte non disponible sur cet appareil ». */
export interface CarteExport {
  map: CarteCapturable | null
  webgl: boolean
  /** remet la vue de départ à la fin de l'export (dossier national) */
  restaurer?(): Promise<void>
}

export type NatureMention = 'à confirmer' | 'saisi par vous' | 'repérage indicatif'

export interface Mention {
  nature: NatureMention
  texte: string
}

export interface Source {
  /** identifiant : 'cadre_harmonise', 'doses_pia', 'prix', 'gadm' ou autre */
  id: string
  nom: string
  /** date de la donnée ou de la publication ; absente = « date non disponible » */
  date?: string | null
  licence?: string
  detail?: string
}

/** Valeur affichée avec sa source ; texte null = absent (« non disponible » ou « à saisir »). */
export interface Valeur {
  texte: string | null
  source?: string | null
  siAbsent?: 'non disponible' | 'à saisir'
  mention?: NatureMention
}

export interface PrixSaisi {
  produit: string
  /** prix déjà formaté (ex. « 14 000 FCFA ») ; null = « à saisir » */
  prix: string | null
  unite: string
  /** « saisi par vous » ou la source officielle */
  origine: string
}

export interface DonneesDossier {
  organisation: string
  annee: number
  campagne: string
  culture: string
  intrant: string
  scenario: string
  prix: PrixSaisi[]
  /** étapes 1 à 6, dans l'ordre */
  etapes: Etape[]
  /** tableau de répartition complet de l'étape 5 */
  repartition: Tableau
  sources: Source[]
  mentions: Mention[]
  /** phrases de fiabilité (scene/regles/fiabilite.ts) ; absentes = libellés de MODELES */
  fiabilite?: string[]
  limites?: string[]
  /** contours GADM affichés sur les cartes : la licence est alors citée */
  contoursGadm: boolean
  dateExport?: Date
}

export interface BesoinFiche {
  culture: string
  produit: string
  /** nombre de sacs, déjà formaté comme à l'écran ou brut ; null = absent */
  sacs: string | number | null
  /** texte quand sacs est null (ex. « dose à saisir ») ; « non disponible » par défaut */
  siAbsent?: string
  source?: string | null
}

export interface DonneesFiche {
  organisation: string
  annee: number
  departement: { code: string; nom: string; region?: string | null; zone?: string | null }
  /** phase CH de 1 à 5 ; null = non disponible */
  phaseCh: { phase: number | null; periode?: string | null; source?: string | null; nom?: string | null; couleur?: string | null }
  saisonPrevue: Valeur
  risqueRecolte: Valeur
  vulnerabilite: Valeur
  besoins: BesoinFiche[]
  budget: Valeur
  quantiteProposee: Valeur
  dateLimiteLivraison: Valeur
  contreSaison: Valeur
  sources: Source[]
  legende?: Legende
  contoursGadm: boolean
  dateExport?: Date
}

export interface CarteFiche extends CarteExport {
  /** cadre la carte sur le département (cadrer.departement) */
  activer?(): Promise<void>
}

export interface Progression {
  fait: number
  total: number
  libelle: string
}

export interface OptionsExport {
  /** déclenche le téléchargement (vrai par défaut) */
  telecharger?: boolean
}

export interface ResultatExport {
  nomFichier: string
  octets: ArrayBuffer
  nbPages: number
  explicationsIA: boolean
  avertissementIA: string | null
}
