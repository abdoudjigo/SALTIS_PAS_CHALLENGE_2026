// Répartition d'un stock entre les départements (proposition de la solution, que l'organisation ajuste puis valide).
// Méthode « prorata des besoins, priorité à la vulnérabilité », version front-0.1 : indicative, calculée dans le navigateur.
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
