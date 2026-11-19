// Cultures retirées du front, en un seul endroit. Le filtre s'applique à l'entrée des données (api/index.ts) :
// aucun écran, liste, conseil, besoin ni légende ne les voit. Les marts et dbt ne changent pas.
// Manioc : culture pluriannuelle, non évaluée par le module B (pas de probabilité de cycle) ; retirée de l'offre.
const RETIREES = new Set(['MANIOC'])

const cle = (culture: string) => culture.toLocaleUpperCase('fr-FR').trim()

/** Vrai si la culture est montrée. Une ligne sans culture (département sans superficie de référence) reste. */
export const cultureMontree = (culture: string | null | undefined) => !culture || !RETIREES.has(cle(culture))

/** Retire les lignes des cultures retirées (toute ligne qui porte une colonne `culture`). */
export const sansCulturesRetirees = <T,>(lignes: T[]): T[] =>
  lignes.filter((l) => cultureMontree((l as { culture?: string | null }).culture))
