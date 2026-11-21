// Les choix de l'ONG gardés pour la session (intrant, scénario, unité, stock, réglage avancé, prix saisis).
// Hors du « cadre » : taper un stock ou un prix ne redessine que les étapes qui lisent le dossier, pas la carte des
// autres. Une seule copie (invariant I1), tenue par la scène ; lue par `useDossier`.
import { createContext, useContext } from 'react'
import type { ScenarioRepartition } from '../cadre'

export interface DossierOng {
  /** intrant des étapes 4 et 5 (code_intrant) ; null : le premier proposé */
  intrant: string | null
  scenario: ScenarioRepartition
  /** unité de saisie du stock */
  unite: 't' | 'sacs'
  /** stock tel que tapé ; vide : pas encore saisi (aucune répartition calculée) */
  stock: string
  /** réglage avancé du scénario proportionnel : priorité à la vulnérabilité (entier 0-100) ; 0 = prorata pur */
  priorite: number
  /** prix d'achat tapé par l'organisation (FCFA / sac de 50 kg), par code_intrant : marqué « saisi par vous » */
  prix: Record<string, string>
}

export const DOSSIER_VIDE: DossierOng = { intrant: null, scenario: 'proportionnel', unite: 't', stock: '', priorite: 0, prix: {} }
const SCENARIOS_CONNUS: ScenarioRepartition[] = ['proportionnel', 'urgence', 'production']
export const CLE_DOSSIER = 'assaman.dossier-ong'

/** Le dossier lu dans la session, champ par champ : une valeur d'un autre type revient à celle de DOSSIER_VIDE. */
export function lireDossier(cle: string): DossierOng {
  let brut: Record<string, unknown> = {}
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(cle) ?? '{}')
    if (v && typeof v === 'object' && !Array.isArray(v)) brut = v as Record<string, unknown>
  } catch {
    return DOSSIER_VIDE
  }
  const prix: Record<string, string> = {}
  if (brut.prix && typeof brut.prix === 'object' && !Array.isArray(brut.prix))
    for (const [k, v] of Object.entries(brut.prix)) if (typeof v === 'string') prix[k] = v
  const p = brut.priorite
  return {
    intrant: typeof brut.intrant === 'string' ? brut.intrant : DOSSIER_VIDE.intrant,
    scenario: SCENARIOS_CONNUS.includes(brut.scenario as ScenarioRepartition) ? (brut.scenario as ScenarioRepartition) : DOSSIER_VIDE.scenario,
    unite: brut.unite === 'sacs' || brut.unite === 't' ? brut.unite : DOSSIER_VIDE.unite,
    stock: typeof brut.stock === 'string' ? brut.stock : DOSSIER_VIDE.stock,
    priorite: typeof p === 'number' && Number.isInteger(p) && p >= 0 && p <= 100 ? p : DOSSIER_VIDE.priorite,
    prix,
  }
}

/** Efface les dossiers de la session (déconnexion). */
export function effacerDossiers() {
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith(CLE_DOSSIER)).forEach((k) => sessionStorage.removeItem(k))
  } catch {
    /* stockage indisponible */
  }
}

export const DossierContext = createContext<{ dossier: DossierOng; majDossier: (modif: Partial<DossierOng>) => void }>({ dossier: DOSSIER_VIDE, majDossier: () => {} })
export const useDossier = () => useContext(DossierContext)
