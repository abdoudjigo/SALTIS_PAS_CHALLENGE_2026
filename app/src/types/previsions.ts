// Types des résultats des 3 modèles d'IA (SALTIS.ML, routes /api/v1/previsions), voir ml/MODELES.md.
// Chaque prévision porte des probabilités ou une fourchette. `| null` = valeur absente, jamais 0.
import type { Territoire } from './marts'

export type Classe3 = 'sèche' | 'normale' | 'humide'
export type Moment = 'FIN_MAI' | 'FIN_JUIN' | 'FIN_JUILLET' | 'FIN_AOUT'
export type CodeModele = 'M1' | 'M3' | 'M4'

interface Trace {
  version_modele: string
  date_calcul: string
}

/** Les trois probabilités d'une saison : toujours affichées ensemble, jamais la classe seule. */
export interface Probabilites3 {
  proba_seche_pct: number | null
  proba_normale_pct: number | null
  proba_humide_pct: number | null
  classe_prevue: Classe3 | null
}

/** Modèle 1 — « La saison qui vient » : prévision faite fin mai. */
export interface PrevisionSaison extends Territoire, Trace, Probabilites3 {
  annee: number
  /** PREVISION_OCEAN : année à venir dont l'océan de mars-mai est connu ; PREVISION_TENDANCE : années suivantes, moyenne des 15 dernières saisons */
  type_prevision: 'RETROSPECTIVE_VALIDATION' | 'RETROSPECTIVE_TEST' | 'PREVISION_OCEAN' | 'PREVISION_TENDANCE'
  pluie_prevue_mm: number | null
  /** fourchette : 8 chances sur 10 d'être dedans */
  pluie_basse_mm: number | null
  pluie_haute_mm: number | null
  pluie_normale_mm: number | null
  pluie_observee_mm: number | null
  classe_observee: Classe3 | null
}

/** Modèle 3 — « Quelle culture » et « Alerte récolte ». */
export interface PrevisionRendement extends Territoire, Trace {
  culture: string
  annee: number
  moment_prevision: Moment
  /** PROJECTION_NON_EVALUEE : 2022-2025, invérifiable */
  type_prevision: 'RETROSPECTIVE_VALIDATION' | 'RETROSPECTIVE_TEST' | 'PROJECTION_NON_EVALUEE'
  /** rendement habituel : moyenne des 10 campagnes précédentes */
  tendance_kg_ha: number | null
  rendement_bas_kg_ha: number | null
  rendement_median_kg_ha: number | null
  rendement_haut_kg_ha: number | null
  /** probabilité que le rendement passe sous 80 % de la tendance */
  proba_chute_pct: number | null
  proba_chute_reference_pct: number | null
  explication: string | null
  /** vrai : le modèle bat la référence ; sinon c'est la récolte habituelle, pas une prévision de l'année */
  rendement_fiable: boolean | null
  alerte_fiable: boolean | null
  rendement_observe_kg_ha: number | null
  chute_observee: boolean | null
}

/** Modèle 4 — « Quand semer » : risque d'une décade de semis (16 = 1re décade de juin … 23 = 2e d'août). */
export interface RisqueSemis extends Territoire, Trace {
  /** null pour l'année type */
  annee: number | null
  type_prevision: 'RETROSPECTIVE_TEST' | 'ANNEE_TYPE' | 'PREVISION_OCEAN' | 'PREVISION_TENDANCE'
  culture: string
  cycle_jours: number | null
  decade_semis: number
  libelle_decade: string
  chance_pluie_semis_pct: number | null
  risque_faux_depart_pct: number | null
  risque_fin_trop_tot_pct: number | null
  risque_total_pct: number | null
  decade_conseillee: boolean
  proba_saison_seche_m1_pct: number | null
}

/** Fiabilité d'un modèle comparée à une prévision simple : une ligne par mesure. */
export interface EvaluationModele {
  modele: CodeModele
  version_modele: string
  periode: string
  moment: string | null
  culture: string | null
  risque: string | null
  variables: string | null
  mesure: string
  valeur: number | null
}

/** Réponse d'une route de prévision : les lignes et les rappels d'affichage honnête (`meta.avertissements`). */
export interface Prevision<T> {
  donnees: T[]
  avertissements: string[]
  source: string
}

export const MOMENTS: { id: Moment; libelle: string; court: string }[] = [
  { id: 'FIN_MAI', libelle: 'fin mai', court: 'Mai' },
  { id: 'FIN_JUIN', libelle: 'fin juin', court: 'Juin' },
  { id: 'FIN_JUILLET', libelle: 'fin juillet', court: 'Juil.' },
  { id: 'FIN_AOUT', libelle: 'fin août', court: 'Août' },
]

/** La campagne à venir : l'année qui suit la dernière campagne observée. C'est la première année que l'on prédit. */
export const anneeAVenir = (campagnes: number[]) => (campagnes.at(-1) ?? new Date().getFullYear() - 1) + 1
/** Dernière année que l'on peut saisir. Au-delà, l'API n'a pas de prévision. */
export const DERNIERE_ANNEE_PREVISION = 2035

/**
 * Années passées couvertes par chaque modèle (elles servent de vérification) : M1 depuis 1981, M3 de 2001 à 2015
 * puis depuis 2022, M4 depuis 2016. Les années à venir se saisissent, de `anneeAVenir` à `DERNIERE_ANNEE_PREVISION`.
 */
export const anneesPassees = (campagnes: number[], modele: CodeModele) =>
  campagnes.filter((a) => (modele === 'M1' ? true : modele === 'M3' ? a >= 2001 && (a <= 2015 || a >= 2022) : a >= 2016))

/**
 * Le seul test « le modèle couvre-t-il cette année ? », pour M1, M3 et M4 : ses années de vérification
 * (`anneesPassees`), puis l'année à venir et les années prédites jusqu'à DERNIERE_ANNEE_PREVISION.
 * Hors de ces années : aucun appel à l'API (pas de 404), une phrase « Pas de prévision … pour {année} ».
 */
export const anneeCouverte = (campagnes: number[], modele: CodeModele, annee: number) =>
  (annee >= anneeAVenir(campagnes) && annee <= DERNIERE_ANNEE_PREVISION) || anneesPassees(campagnes, modele).includes(annee)

/** Les 5 cultures du modèle 3 (rendement), dans l'ordre d'affichage. */
export const CULTURES_RENDEMENT = ['ARACHIDE', 'MIL (SOUNA)', 'SORGHO', 'NIÉBÉ', 'MAÏS']

/** Seuil d'alerte récolte : probabilité de chute (rendement sous 80 % de l'habituel) à partir de laquelle on signale. */
export const SEUIL_ALERTE_PCT = 40
