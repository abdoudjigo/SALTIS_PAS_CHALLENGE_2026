// Lecture et contrôle des nombres tapés dans les formulaires (surface, doses, stock, coordonnées).
// Règles communes : virgule ou point décimal, espaces de milliers acceptées ; rien d'autre (pas de « 1e3 »,
// pas de lettres) ; bornes min et max ; message en français, prêt à afficher sous le champ.

export type Lecture = {
  /** La valeur lue, ou null si le champ est vide ou invalide */
  valeur: number | null
  /** Message à afficher sous le champ, ou null si la saisie est bonne (ou vide) */
  erreur: string | null
  vide: boolean
}

const FORME = /^-?\d+(?:[.,]\d+)?$/

export function lireNombre(
  texte: string,
  { min = 0, max, minExclu = false, unite = '', negatif = false }: { min?: number; max: number; minExclu?: boolean; unite?: string; negatif?: boolean },
): Lecture {
  const brut = texte.replace(/[\s\u00a0\u202f]/g, '')
  if (brut === '') return { valeur: null, erreur: null, vide: true }
  if (!FORME.test(brut) || (!negatif && brut.startsWith('-'))) {
    return { valeur: null, erreur: negatif ? 'Tapez un nombre, par exemple 14,5 ou -16,2.' : 'Tapez un nombre positif, par exemple 2 ou 2,5.', vide: false }
  }
  const n = Number(brut.replace(',', '.'))
  // Le degré se colle au nombre (90°), les autres unités sont séparées par une espace (10 000 ha)
  const u = unite === '°' ? '°' : unite ? ` ${unite}` : ''
  if (minExclu ? n <= min : n < min) return { valeur: null, erreur: minExclu ? `La valeur doit être supérieure à ${fr(min)}${u}.` : `La valeur doit être au moins ${fr(min)}${u}.`, vide: false }
  if (n > max) return { valeur: null, erreur: `La valeur ne peut pas dépasser ${fr(max)}${u}.`, vide: false }
  return { valeur: n, erreur: null, vide: false }
}

function fr(n: number) {
  return n.toLocaleString('fr-FR')
}
