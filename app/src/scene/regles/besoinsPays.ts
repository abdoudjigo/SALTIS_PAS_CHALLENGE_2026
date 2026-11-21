// Besoins par département pour un intrant et un choix de cultures (mart_territoires_agrodistrib).
// Règle du contrat : seuls les besoins s'additionnent, et une dose inconnue (NULL) ne compte jamais pour 0.
import type { ColonneBesoin, LigneTerritoireAgrodistrib } from '../../types/marts'

export interface BesoinDepartement {
  code: string
  departement: string
  zone: string
  /** somme des besoins connus ; null si aucune dose n'est connue dans le département */
  besoin_t: number | null
  /** couples département × culture dont la dose reste à saisir */
  sansDose: number
  vulnerabilite: number | null
}

export function besoinsParDepartement(lignes: LigneTerritoireAgrodistrib[], colonne: ColonneBesoin, culture: string | null): BesoinDepartement[] {
  const groupes = new Map<string, BesoinDepartement>()
  for (const l of lignes) {
    if (culture && l.culture !== culture) continue
    // Semences du riz pluvial de Casamance : dose non applicable, exclue des totaux
    const valeur = colonne === 'besoin_semences_retenu_t' && !l.besoin_semences_applicable ? null : l[colonne]
    const g = groupes.get(l.code_departement) ?? { code: l.code_departement, departement: l.departement, zone: l.zone_agroecologique, besoin_t: null, sansDose: 0, vulnerabilite: l.score_vulnerabilite }
    if (valeur === null) g.sansDose += 1
    else g.besoin_t = (g.besoin_t ?? 0) + valeur
    groupes.set(l.code_departement, g)
  }
  return [...groupes.values()]
}

/** La valeur de besoin d'une ligne pour une colonne : null si la dose est inconnue ou non applicable (jamais 0). */
const valeurBesoin = (l: LigneTerritoireAgrodistrib, colonne: ColonneBesoin) =>
  colonne === 'besoin_semences_retenu_t' && !l.besoin_semences_applicable ? null : l[colonne]

/**
 * Part de la superficie de référence couverte par une dose connue (« pas dans la formule » compte : dose nulle connue),
 * pour un intrant et un choix de cultures. null sans superficie.
 */
export function partSurfaceAvecDose(lignes: LigneTerritoireAgrodistrib[], colonne: ColonneBesoin, culture: string | null, code?: string | null) {
  let totale = 0
  let connue = 0
  for (const l of lignes) {
    if ((culture && l.culture !== culture) || (code && l.code_departement !== code)) continue
    totale += l.superficie_reference_ha ?? 0
    if (valeurBesoin(l, colonne) !== null) connue += l.superficie_reference_ha ?? 0
  }
  return totale > 0 ? (100 * connue) / totale : null
}

/** La culture de plus grande superficie de référence de chaque département, parmi celles où l'intrant a un besoin connu > 0. */
export function culturePrincipale(lignes: LigneTerritoireAgrodistrib[], colonne: ColonneBesoin): Map<string, LigneTerritoireAgrodistrib> {
  const r = new Map<string, LigneTerritoireAgrodistrib>()
  for (const l of lignes) {
    const v = valeurBesoin(l, colonne)
    if (v === null || v <= 0) continue
    const m = r.get(l.code_departement)
    if (!m || l.superficie_reference_ha > m.superficie_reference_ha) r.set(l.code_departement, l)
  }
  return r
}
