// Lecture d'un nombre tapé par l'utilisateur, en français : espaces de milliers, virgule décimale.
// Le texte reste tel quel dans le champ ; on ne convertit qu'au moment du calcul.
/** Le nombre d'une saisie ; null si le champ est vide ou ne contient pas un nombre. */
export function lireNombre(texte: string | null | undefined): number | null {
  const t = String(texte ?? '').replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
