// Règles d'affichage du Cadre harmonisé (CILSS), en un seul endroit (invariant I2).
// Les phases viennent du mart (dernier cycle) ; leurs couleurs, de la palette officielle servie par l'API
// (GET /referentiels/phases-cadre-harmonise). Le Cadre harmonisé reste hors du score de vulnérabilité.
import type { LigneCadreHarmonise, PhaseCadreHarmonise, PhaseCH } from '../types/marts'
import { NON_DISPONIBLE } from './couleurs'
import type { EtatLigne } from './fiche'

/** Phase 3 « crise » et au-delà : la population a besoin d'une action urgente (définition du Cadre harmonisé). */
export const PHASE_CRISE = 3
export const enCrise = (phase: PhaseCH | null | undefined) => phase != null && phase >= PHASE_CRISE

/** La pastille d'une phase : 3 et plus → non, 2 « sous pression » → attention, 1 « minimale » → ok, absente → info. */
export const etatPhase = (phase: PhaseCH | null | undefined): EtatLigne =>
  phase == null ? 'info' : phase >= PHASE_CRISE ? 'non' : phase === 2 ? 'attention' : 'ok'

/** Couleur officielle d'une phase ; gris si la phase ou la palette manque. */
export const couleurPhase = (phases: PhaseCadreHarmonise[] | null | undefined, phase: PhaseCH | null | undefined) =>
  (phase != null && phases?.find((p) => p.phase === phase)?.couleur) || NON_DISPONIBLE

/** « Phase 3 (crise) » ; « non disponible » sans phase. */
export const nomPhase = (l: Pick<LigneCadreHarmonise, 'phase_retenue' | 'libelle_phase_retenue'> | null | undefined) =>
  l?.phase_retenue == null ? 'non disponible' : `phase ${l.phase_retenue}${l.libelle_phase_retenue ? ` (${l.libelle_phase_retenue})` : ''}`

/** Le libellé de la période, toujours affiché, suivi de « période terminée, prochain cycle attendu » si besoin. */
export const periodeCH = (l: Pick<LigneCadreHarmonise, 'libelle_periode_retenue' | 'mention_periode' | 'periode_terminee'> | null | undefined) =>
  !l?.libelle_periode_retenue ? 'période non disponible' : `${l.libelle_periode_retenue}${l.periode_terminee && l.mention_periode ? ` · ${l.mention_periode}` : ''}`

/**
 * Le Cadre harmonisé compte comme signal (étape 1) et comme critère d'urgence (étape 5) seulement pour l'année de son
 * cycle : une seule règle, ici. Autre année : null (la phase reste affichée, mais ne classe rien).
 */
export const chCompte = (l: Pick<LigneCadreHarmonise, 'annee_cycle'> | null | undefined, annee: number) => l != null && l.annee_cycle === annee
