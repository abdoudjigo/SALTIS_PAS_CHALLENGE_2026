// Répartition d'un stock entre les départements (proposition de la solution, que l'organisation ajuste puis valide).
// Scénario « Multicritère » : la méthode du moteur ml/agrodistrib (« prorata multicritère », agrodistrib-v1, validée le
// 18/11/2026, docs/technique/rapport-comparaison-modeles.md section 5), portée à l'identique : une seule formule dans
// tout le projet (audit, constat ARC-01). Équivalence vérifiée par repartition.test.ts sur ml/sorties.
import type { ColonneBesoin, LigneTerritoireAgrodistrib } from '../../types/marts'
import type { ScenarioRepartition } from '../cadre'

export const METHODE = 'Prorata multicritère'
export const VERSION = 'agrodistrib-v1'
/** Part du poids indépendante des critères : tout couple avec un besoin est servi (ml : PLANCHER_POIDS) */
export const PLANCHER_POIDS = 0.5
/** Arbitrage du décideur, en % : 0 = équité (vulnérabilité seule), 100 = rendement (valeur indicative seule) */
export const ARBITRAGE_DEFAUT = 50
export const ARBITRAGES_NOMMES: { valeur: number; libelle: string }[] = [
  { valeur: 0, libelle: 'Équité' },
  { valeur: 50, libelle: 'Équilibré' },
  { valeur: 100, libelle: 'Rendement' },
]

/** « Équilibré (50 %) », ou la valeur seule. */
export const nomArbitrage = (v: number) => {
  const nomme = ARBITRAGES_NOMMES.find((a) => a.valeur === v)
  return nomme ? `${nomme.libelle} (${v} % rendement)` : `${v} % rendement, ${100 - v} % fragilité`
}

export interface Demande {
  code: string
  besoin_t: number
  /** score 0-100, null si le département n'est pas noté */
  vulnerabilite: number | null
}

export interface Part {
  code: string
  besoin_t: number
  quantite_t: number
  couverture_pct: number
}

/** Une ligne à servir : un couple département × culture, comme dans ml/agrodistrib/moteur.py. */
export interface LigneMulticritere {
  code: string
  culture: string
  besoin_t: number
  /** vulnérabilité relative, 0 à 1 (score / 100) ; null avant imputation */
  vulnerabilite: number | null
  /** valeur indicative d'une tonne, 0 à 1 ; null avant imputation */
  valeur_indicative: number | null
}

const mediane = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Prépare les lignes (ml : `preparer`, sans doses saisies) : couples avec un besoin connu > 0 ; vulnérabilité = score / 100 ;
 * valeur indicative = potentiel de gain (ramené entre 0 et 1 dans chaque culture) × probabilité que le cycle soit couvert
 * × (1 − probabilité de saison sèche). Un critère vide prend la médiane des autres lignes (jamais 0).
 */
export function lignesMulticritere(territoires: LigneTerritoireAgrodistrib[], colonne: ColonneBesoin, culture: string | null): LigneMulticritere[] {
  const t = territoires.filter((l) => {
    if (culture && l.culture !== culture) return false
    const b = colonne === 'besoin_semences_retenu_t' && !l.besoin_semences_applicable ? null : l[colonne]
    return b !== null && b > 0
  })
  const potentiel = (l: LigneTerritoireAgrodistrib) => (l.potentiel_evalue && l.potentiel_gain_kg_ha !== null ? Math.max(l.potentiel_gain_kg_ha, 0) : null)
  const maxParCulture = new Map<string, number>()
  t.forEach((l) => {
    const p = potentiel(l)
    if (p !== null) maxParCulture.set(l.culture, Math.max(maxParCulture.get(l.culture) ?? 0, p))
  })
  const lignes: LigneMulticritere[] = t.map((l) => {
    const p = potentiel(l)
    const max = maxParCulture.get(l.culture) ?? 0
    const norm = p === null ? null : max > 0 ? p / max : 0
    const capacite = l.proba_cycle_couvert_moyen_pct === null || l.proba_saison_seche_pct === null ? null : (l.proba_cycle_couvert_moyen_pct / 100) * (1 - l.proba_saison_seche_pct / 100)
    return {
      code: l.code_departement, culture: l.culture, besoin_t: l[colonne] as number,
      vulnerabilite: l.score_vulnerabilite === null ? null : l.score_vulnerabilite / 100,
      valeur_indicative: norm === null || capacite === null ? null : norm * capacite,
    }
  })
  for (const critere of ['vulnerabilite', 'valeur_indicative'] as const) {
    const connus = lignes.map((l) => l[critere]).filter((v): v is number => v !== null)
    const m = connus.length ? mediane(connus) : 0
    lignes.forEach((l) => { if (l[critere] === null) l[critere] = m })
  }
  return lignes
}

/** Répartit `stock` en proportion de `poids`, sans jamais dépasser le besoin (ml : `au_prorata`). */
export function auProrata(besoins: number[], poids: number[], stock: number): number[] {
  const total = besoins.reduce((s, b) => s + b, 0)
  if (stock >= total) return [...besoins]
  // Remplissage par niveau : les lignes au plus petit rapport besoin / poids sont servies en entier d'abord
  const ordre = besoins.map((_, i) => i).filter((i) => poids[i] > 0).sort((i, j) => besoins[i] / poids[i] - besoins[j] / poids[j])
  const x = besoins.map(() => 0)
  let reste = Math.max(stock, 0)
  let poidsRestant = ordre.reduce((s, i) => s + poids[i], 0)
  let k = 0
  for (const [rang, i] of ordre.entries()) {
    k = reste / poidsRestant
    if (besoins[i] <= k * poids[i]) {
      x[i] = besoins[i]
      reste -= besoins[i]
      poidsRestant -= poids[i]
    } else {
      ordre.slice(rang).forEach((j) => { x[j] = k * poids[j] })
      break
    }
  }
  return x
}

/** Poids d'une ligne (ml : `poids`) : besoin × (0,5 + α × valeur indicative + (1 − α) × vulnérabilité). */
export const poidsMulticritere = (l: LigneMulticritere, alpha: number) =>
  l.besoin_t * (PLANCHER_POIDS + alpha * (l.valeur_indicative ?? 0) + (1 - alpha) * (l.vulnerabilite ?? 0))

/** Scénario Multicritère : répartition par couple département × culture, puis somme par département. */
export function prorataMulticritere(lignes: LigneMulticritere[], stock_t: number, arbitragePct: number): { parts: Part[]; reste_t: number } {
  const alpha = Math.min(Math.max(arbitragePct, 0), 100) / 100
  const x = auProrata(lignes.map((l) => l.besoin_t), lignes.map((l) => poidsMulticritere(l, alpha)), stock_t)
  const parDep = new Map<string, Part>()
  lignes.forEach((l, i) => {
    const p = parDep.get(l.code) ?? { code: l.code, besoin_t: 0, quantite_t: 0, couverture_pct: 0 }
    p.besoin_t += l.besoin_t
    p.quantite_t += x[i]
    parDep.set(l.code, p)
  })
  const parts = [...parDep.values()].map((p) => ({ ...p, couverture_pct: p.besoin_t > 0 ? (100 * p.quantite_t) / p.besoin_t : 0 }))
  return { parts, reste_t: Math.max(stock_t - x.reduce((s, q) => s + q, 0), 0) }
}

// --- Scénarios nommés (étape 5 de l'ONG) -----------------------------------------------------------
export const SCENARIOS: { id: ScenarioRepartition; libelle: string; regle: string }[] = [
  { id: 'proportionnel', libelle: 'Multicritère', regle: 'Chaque département et chaque culture reçoivent une part du stock proportionnelle à leur besoin, majorée selon la fragilité du département et la valeur indicative d’une tonne (potentiel de gain, chances que le cycle soit couvert, risque de saison sèche). Le réglage arbitre entre les deux : équité (fragilité seule), équilibré, récolte par hectare (valeur indicative seule). Une part ne dépasse jamais le besoin. Méthode du moteur AgroDistrib (prorata multicritère, version agrodistrib-v1).' },
  { id: 'urgence', libelle: 'Urgence', regle: 'Les départements sont servis dans l’ordre de la phase du Cadre harmonisé (période retenue, la plus grave d’abord), puis du nombre de personnes en phases 3 à 5, puis du niveau de fragilité du département ; chacun reçoit son besoin complet tant qu’il reste du stock. Le Cadre harmonisé ne compte que pour l’année de son cycle : une autre année, l’ordre suit la fragilité.' },
  { id: 'production', libelle: 'Production', regle: 'Les départements où la culture est « adaptée » et le potentiel de gain évalué sont servis d’abord, du plus fort potentiel de gain de récolte par hectare au plus faible ; les autres (dont une culture adaptée au potentiel non évalué) viennent ensuite, du plus gros besoin au plus petit. Chacun reçoit son besoin complet tant qu’il reste du stock.' },
]

/**
 * Remplissage dans l'ordre : chaque département reçoit son besoin complet tant qu'il reste du stock ; le dernier servi
 * reçoit le reste. Une part ne dépasse jamais le besoin ; le stock non distribué est rendu dans `reste_t`.
 */
export function remplirDansLOrdre(stock_t: number, ordre: Demande[]): { parts: Part[]; reste_t: number } {
  let reste = Math.max(stock_t, 0)
  const parts = ordre.map((d) => {
    const q = Math.min(Math.max(d.besoin_t, 0), reste)
    reste -= q
    return { code: d.code, besoin_t: d.besoin_t, quantite_t: q, couverture_pct: d.besoin_t > 0 ? (100 * q) / d.besoin_t : 0 }
  })
  return { parts, reste_t: Math.max(reste, 0) }
}

/** Ce qui classe un département dans les scénarios Urgence et Production (null : inconnu, servi après les autres). */
export interface Criteres {
  phase: number | null
  personnes_phase3_5: number | null
  vulnerabilite: number | null
  /** potentiel de gain (kg/ha) de la culture, seulement si elle est « adaptée » et le potentiel évalué */
  potentiel_adapte: number | null
}

/** Ordre décroissant ; une valeur absente (null) passe toujours après les valeurs connues. */
const decroissant = (a: number | null, b: number | null) => (a === null && b === null ? 0 : a === null ? 1 : b === null ? -1 : b - a)

/** L'ordre de service d'un scénario (Urgence ou Production). */
export function ordonner(demandes: Demande[], criteres: Map<string, Criteres>, scenario: Exclude<ScenarioRepartition, 'proportionnel'>): Demande[] {
  const c = (d: Demande) => criteres.get(d.code)
  return [...demandes].sort((x, y) => {
    const [a, b] = [c(x), c(y)]
    if (scenario === 'urgence')
      return decroissant(a?.phase ?? null, b?.phase ?? null) || decroissant(a?.personnes_phase3_5 ?? null, b?.personnes_phase3_5 ?? null) || decroissant(a?.vulnerabilite ?? null, b?.vulnerabilite ?? null)
    return decroissant(a?.potentiel_adapte ?? null, b?.potentiel_adapte ?? null) || decroissant(x.besoin_t, y.besoin_t)
  })
}

/**
 * Unité « sacs » : chaque part est ramenée à un nombre entier de sacs de 50 kg (arrondi inférieur : jamais plus que le
 * besoin ni que le stock) ; ce que l'arrondi retire rejoint le reste non distribué.
 */
export function enSacsEntiers(r: { parts: Part[]; reste_t: number }, stock_t: number): { parts: Part[]; reste_t: number } {
  const parts = r.parts.map((p) => {
    const q = Math.floor(p.quantite_t * 20 + 1e-9) / 20
    return { ...p, quantite_t: q, couverture_pct: p.besoin_t > 0 ? (100 * q) / p.besoin_t : 0 }
  })
  return { parts, reste_t: Math.max(stock_t - parts.reduce((s, p) => s + p.quantite_t, 0), 0) }
}
