// Échelles de couleur de la scène, toutes tirées de la palette « Ciel & Terre » (src/index.css).
import type { NiveauAdequation, RisqueSaison } from '../types/marts'
import type { Classe3, Probabilites3 } from '../types/previsions'

export type Rvb = [number, number, number]

export const NON_DISPONIBLE = '#aab0b6'
/** Miroir du token --color-ciel-vif : Mapbox ne lit pas les variables CSS */
export const CIEL_VIF = '#2f9cf0'

export function rvb(hex: string): Rvb {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const hex = ([r, g, b]: Rvb) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
/** Une couleur tirée vers le clair (token sol) : pour laisser ressortir ce qui est signalé par-dessus. */
export const eclaircir = (couleur: string, k: number) => hex(melanger(rvb(couleur), rvb('#f7f5ef'), k))
export const melanger = (a: Rvb, b: Rvb, k: number): Rvb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]

/** Échelle continue entre des repères [valeur, couleur]. Une valeur absente n'a pas de couleur d'échelle. */
export function rampe(reperes: [number, string][]) {
  const pts = reperes.map(([v, c]) => [v, rvb(c)] as const)
  return (v: number | null | undefined): string => {
    if (v === null || v === undefined || Number.isNaN(v)) return NON_DISPONIBLE
    if (v <= pts[0][0]) return hex(pts[0][1])
    for (let i = 1; i < pts.length; i++)
      if (v <= pts[i][0]) return hex(melanger(pts[i - 1][1], pts[i][1], (v - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])))
    return hex(pts[pts.length - 1][1])
  }
}

// Écart de pluie à la normale (%) : terre sèche → neutre → bleu pluie
export const couleurAnomalie = rampe([[-40, '#8a5527'], [-15, '#d9a56b'], [0, '#f1ece0'], [15, '#8fc0e6'], [40, '#1b5a8e']])
// Vulnérabilité (0-100, relative) : soleil → alerte
export const couleurVulnerabilite = rampe([[0, '#fdf0d2'], [40, '#f2b544'], [70, '#e07a3a'], [100, '#a3311c']])
/** Même échelle pour du texte sur fond sombre : on s'arrête à l'orange, le rouge profond y serait illisible. */
export const teinteVulnerabilite = (v: number | null | undefined) => couleurVulnerabilite(v === null || v === undefined ? v : Math.min(v, 62))
// Taux de couverture d'un besoin (%) : alerte → soleil → vert
export const couleurCouverture = rampe([[0, '#d2492f'], [50, '#f2b544'], [100, '#2f7d4f']])
// Quantité (0-1, relative au maximum) : vert clair → vert profond
export const couleurQuantite = rampe([[0, '#d5eadb'], [0.5, '#5aa878'], [1, '#12391f']])

export const NIVEAUX: Record<NiveauAdequation, { couleur: string; libelle: string }> = {
  'adaptée': { couleur: '#2f7d4f', libelle: 'Adaptée' },
  'à risque': { couleur: '#f2b544', libelle: 'À risque' },
  'déconseillée': { couleur: '#d2492f', libelle: 'Déconseillée' },
  'irrigation requise': { couleur: '#2d7fc1', libelle: 'Irrigation requise' },
  'non évaluée (culture pluriannuelle)': { couleur: NON_DISPONIBLE, libelle: 'Non évaluée' },
}

export const RISQUES: Record<RisqueSaison, { couleur: string; libelle: string }> = {
  'normal': { couleur: '#2f7d4f', libelle: 'Saison normale' },
  'sécheresse': { couleur: '#b7793f', libelle: 'Sécheresse' },
  'excès de pluie': { couleur: '#2d7fc1', libelle: 'Excès de pluie' },
  'sécheresse et excès de pluie': { couleur: '#d2492f', libelle: 'Sécheresse et excès' },
}

// --- Prévisions (modèles d'IA) ---------------------------------------------------------------------
/** Dégradé CSS d'une légende, tiré de la même échelle que la carte. */
export const degrade = (echelle: (v: number) => string, de: number, a: number, pas = 4) =>
  `linear-gradient(to right,${Array.from({ length: pas + 1 }, (_, i) => echelle(de + ((a - de) * i) / pas)).join(',')})`

// Pluie de saison prévue (mm) : du sable du nord au bleu du sud
export const couleurPluie = rampe([[200, '#f4e6d6'], [450, '#dcecf8'], [750, '#8fc0e6'], [1050, '#2d7fc1'], [1350, '#1b5a8e']])
// Décade de semis conseillée (16 = début juin … 23 = mi-août) : du soleil de juin aux pluies d'août
export const couleurDecade = rampe([[16, '#fdf0d2'], [18.5, '#f2b544'], [21, '#2f7d4f'], [23, '#1b5a8e']])
// Probabilité d'une chute de récolte (%) : soleil → alerte
export const couleurChute = rampe([[5, '#fdf0d2'], [25, '#f2b544'], [45, '#e07a3a'], [65, '#a3311c']])
/** Même échelle pour du texte sur fond sombre (le rouge profond y serait illisible). */
export const teinteChute = (v: number | null | undefined) => couleurChute(v === null || v === undefined ? v : Math.min(v, 42))

export const CLASSES3: Record<Classe3, { couleur: string; libelle: string }> = {
  'sèche': { couleur: '#d9a56b', libelle: 'Sèche' },
  'normale': { couleur: '#c9d8ea', libelle: 'Normale' },
  'humide': { couleur: CIEL_VIF, libelle: 'Humide' },
}

/** Les 3 probabilités en barres, dans l'ordre sèche, normale, humide. */
export const parts3 = (p: Probabilites3) => [
  { libelle: CLASSES3['sèche'].libelle, part: p.proba_seche_pct, couleur: CLASSES3['sèche'].couleur },
  { libelle: CLASSES3.normale.libelle, part: p.proba_normale_pct, couleur: CLASSES3.normale.couleur },
  { libelle: CLASSES3.humide.libelle, part: p.proba_humide_pct, couleur: CLASSES3.humide.couleur },
]
/** La classe la plus probable et sa probabilité : « plutôt humide », 41. */
export function tendance(p: Probabilites3) {
  if (!p.classe_prevue) return null
  const proba = { 'sèche': p.proba_seche_pct, 'normale': p.proba_normale_pct, 'humide': p.proba_humide_pct }[p.classe_prevue]
  return { classe: p.classe_prevue, proba, texte: `plutôt ${p.classe_prevue}`, couleur: CLASSES3[p.classe_prevue].couleur }
}
