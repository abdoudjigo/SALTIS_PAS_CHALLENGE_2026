// Répartition d'un stock entre les départements (proposition de la solution, que l'organisation ajuste puis valide).
// Méthode « prorata des besoins, priorité à la vulnérabilité », version front-0.1 : indicative, calculée dans le navigateur.
import type { ScenarioRepartition } from './cadre'

export const METHODE = 'Prorata des besoins, priorité à la vulnérabilité'
export const VERSION = 'front-0.1'

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

/**
 * Chaque département reçoit une part proportionnelle à son besoin, majorée selon sa vulnérabilité
 * (`priorite` de 0 à 1). Une part ne dépasse jamais le besoin : le surplus est redistribué aux autres.
 * Un département non noté prend la vulnérabilité moyenne (ni favorisé, ni pénalisé).
 */
export function repartir(stock_t: number, demandes: Demande[], priorite: number): { parts: Part[]; reste_t: number } {
  const notes = demandes.map((d) => d.vulnerabilite).filter((v): v is number => v !== null)
  const moyenne = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 50
  const poids = new Map(demandes.map((d) => [d.code, d.besoin_t * (1 + 3 * priorite * ((d.vulnerabilite ?? moyenne) / 100))]))
  const quantites = new Map(demandes.map((d) => [d.code, 0]))

  let reste = Math.max(stock_t, 0)
  let ouverts = demandes.filter((d) => d.besoin_t > 0)
  while (reste > 1e-6 && ouverts.length) {
    const total = ouverts.reduce((a, d) => a + poids.get(d.code)!, 0)
    let distribue = 0
    const suivants: Demande[] = []
    for (const d of ouverts) {
      const deja = quantites.get(d.code)!
      const part = Math.min((reste * poids.get(d.code)!) / total, d.besoin_t - deja)
      quantites.set(d.code, deja + part)
      distribue += part
      if (d.besoin_t - deja - part > 1e-6) suivants.push(d)
    }
    reste -= distribue
    if (suivants.length === ouverts.length) break
    ouverts = suivants
  }

  return {
    reste_t: Math.max(reste, 0),
    parts: demandes.map((d) => {
      const q = quantites.get(d.code)!
      return { code: d.code, besoin_t: d.besoin_t, quantite_t: q, couverture_pct: d.besoin_t > 0 ? (100 * q) / d.besoin_t : 0 }
    }),
  }
}

// --- Scénarios nommés (étape 5 de l'ONG) -----------------------------------------------------------
export const SCENARIOS: { id: ScenarioRepartition; libelle: string; regle: string }[] = [
  { id: 'proportionnel', libelle: 'Proportionnel', regle: 'Chaque département reçoit une part au prorata de son besoin connu (règle du projet, d_scenarios_repartition), majorée selon le réglage avancé « priorité à la vulnérabilité ».' },
  { id: 'urgence', libelle: 'Urgence', regle: 'Les départements sont servis dans l’ordre de la phase du Cadre harmonisé (période retenue, la plus grave d’abord), puis du nombre de personnes en phases 3 à 5, puis du score de vulnérabilité ; chacun reçoit son besoin complet tant qu’il reste du stock. Le Cadre harmonisé ne compte que pour l’année de son cycle : une autre année, l’ordre suit la vulnérabilité.' },
  { id: 'production', libelle: 'Production', regle: 'Les départements où la culture est « adaptée » et le potentiel de gain évalué sont servis d’abord, du plus fort potentiel de gain de rendement au plus faible ; les autres (dont une culture adaptée au potentiel non évalué) viennent ensuite, du plus gros besoin au plus petit. Chacun reçoit son besoin complet tant qu’il reste du stock.' },
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
