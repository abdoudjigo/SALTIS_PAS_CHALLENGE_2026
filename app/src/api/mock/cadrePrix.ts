// Faux serveur : prix des intrants (dim_prix_intrant) et Cadre harmonisé (mart_cadre_harmonise_departement).
// Données de démonstration synthétiques, aux formats de l'API (api/schemas/prix.py, cadre_harmonise.py).
// Les couleurs des phases sont la palette officielle du Cadre harmonisé, comme dans l'API.
import type { LigneCadreHarmonise, PhaseCadreHarmonise, PhaseCH, PrixIntrant } from '../../types/marts'
import { arrondi, rng } from './generateurs'
import { DEPARTEMENTS, INTRANTS } from './referentiel'

const SOURCE_DEMO = 'Données de démonstration synthétiques'

export const PHASES_CH: PhaseCadreHarmonise[] = [
  { phase: 1, libelle: 'minimale', couleur: '#CDFACD' },
  { phase: 2, libelle: 'sous pression', couleur: '#FAE61E' },
  { phase: 3, libelle: 'crise', couleur: '#E67800' },
  { phase: 4, libelle: 'urgence', couleur: '#C80000' },
  { phase: 5, libelle: 'famine', couleur: '#640000' },
]

/** Mode démonstration : tous les prix nécessaires sont présents et explicitement synthétiques. */
export function prixIntrants(campagne?: number): PrixIntrant[] {
  const campagnes = [2026]
  return campagnes.filter((c) => !campagne || c === campagne).flatMap((c) => INTRANTS.filter((i) => i.dans_totaux && i.code_intrant !== 'SEMENCES').map((i): PrixIntrant => {
    const r = rng(`prix${i.code_intrant}${c}`)
    const cession = 500 * Math.round(11 + 6 * r())
    const subvention = 5000 * Math.round(50 + 6 * r())
    return {
      code_intrant: i.code_intrant, nom_intrant: i.nom_intrant, campagne: c,
      prix_cession_sac_50kg_fcfa: cession,
      subvention_tonne_fcfa: subvention,
      cout_reel_sac_50kg_fcfa: cession + subvention / 20,
      statut_validation: 'VALIDEE',
      source: `${SOURCE_DEMO} : prix fictifs utilisés uniquement pour les écrans`,
    }
  }))
}

let cache: LigneCadreHarmonise[] | undefined
export function cadreHarmonise(): LigneCadreHarmonise[] {
  if (cache) return cache
  cache = DEPARTEMENTS.map((d): LigneCadreHarmonise => {
    const r = rng(`ch${d.code_departement}`)
    const phase = (r() < 0.08 ? 3 : r() < 0.4 ? 2 : 1) as PhaseCH
    const courante = Math.max(1, phase - (r() < 0.5 ? 1 : 0)) as PhaseCH
    const population = Math.round(80000 + 900000 * r())
    const part = (p: PhaseCH) => (p >= 3 ? 0.12 : p === 2 ? 0.05 : 0.02) * (0.6 + 0.8 * r())
    const pikine = d.departement === 'Pikine'
    return {
      code_departement: d.code_departement, departement: d.departement, code_region: d.code_region, region: d.region, zone_agroecologique: d.zone_agroecologique,
      annee_cycle: 2026, code_cycle: 2, libelle_cycle_source: 'Jan-May', libelle_cycle: 'mars 2026',
      type_periode_retenue: 'projected', libelle_periode_retenue: 'mars 2026, projection juin-août 2026',
      date_debut_periode_retenue: '2026-06-01', date_fin_periode_retenue: '2026-08-31',
      periode_terminee: true, mention_periode: 'période terminée, prochain cycle attendu',
      phase_retenue: phase, libelle_phase_retenue: PHASES_CH[phase - 1].libelle,
      population_retenue: population, population_phase3_5_retenue: arrondi(population * part(phase), 2),
      libelle_periode_courante: 'mars 2026, situation courante janvier-mai 2026', phase_courante: courante,
      population_courante: population, population_phase3_5_courante: arrondi(population * part(courante), 2),
      libelle_periode_projetee: 'mars 2026, projection juin-août 2026', phase_projetee: phase,
      population_projetee: population, population_phase3_5_projetee: arrondi(population * part(phase), 2),
      fusion_keur_massar: pikine, note_fusion: pikine ? 'Pikine et Keur Massar réunis (Keur Massar, créé en 2021, n’existe pas dans GADM)' : null,
      source: SOURCE_DEMO, licence: 'CC BY',
    }
  })
  return cache
}
