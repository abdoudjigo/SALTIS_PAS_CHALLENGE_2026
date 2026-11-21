// Crans du tiroir sur téléphone : replié, mi-hauteur, plein écran (sous la marque et la rangée des fonctionnalités).
export type Cran = 0 | 1 | 2
export const HAUTEUR_REPLIE_PX = 84
/** Hauteur du tiroir à chaque cran, pour un écran de hauteur `h`. */
export const hauteurCran = (cran: Cran, h: number) => [HAUTEUR_REPLIE_PX, Math.round(h * 0.46), h - 132][cran]
