// Textes du PDF : la police standard de jsPDF (Helvetica, codage WinAnsi) dessine le français
// (é è à ç ô œ « » ·) mais pas les flèches, les emoji ni les espaces fines : on les remplace.
import type { Cellule, Source, Valeur } from './types'

export const NON_DISPONIBLE = 'non disponible'

/** Caractères WinAnsi hors Latin-1 que la police standard sait dessiner. */
const WINANSI_EN_PLUS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

const REMPLACEMENTS: Record<string, string> = {
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '​': '',
  '‐': '-', '‑': '-', '−': '-',
  '→': '->', '←': '<-', '↑': '', '↓': '', '⇒': '=>', '↔': '<->',
  '≥': '>=', '≤': '<=', '≈': 'env.', '≠': '<>', '′': "'", '″': '"',
  '✓': 'oui', '✔': 'oui', '✗': 'non', '✘': 'non',
  '\t': ' ',
}

/**
 * Quatre noms de département arrivent sans espaces (NAME_2 de GADM 4.1, repris tel quel par dim_geographie et l'API) :
 * on ne fait que rendre les espaces, l'orthographe reste celle de la source.
 */
export const NOMS_SANS_ESPACES: Record<string, string> = {
  MalèmeHodar: 'Malème Hodar',
  NioroduRip: 'Nioro du Rip',
  MédinaYoroFoula: 'Médina Yoro Foula',
  RanérouFerlo: 'Ranérou Ferlo',
}
const MOTIF_NOMS = new RegExp(Object.keys(NOMS_SANS_ESPACES).join('|'), 'g')
export const nomLisible = (t: string) => t.replace(MOTIF_NOMS, (m) => NOMS_SANS_ESPACES[m])

/** Rend un texte dessinable par la police standard ; un caractère inconnu est retiré, jamais laissé en carré vide. */
export function pdfTexte(texte: string): string {
  let sortie = ''
  for (const c of nomLisible(texte.normalize('NFC'))) {
    const r = REMPLACEMENTS[c]
    if (r !== undefined) sortie += r
    else {
      const code = c.codePointAt(0)!
      if (code === 10 || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EN_PLUS.has(c)) sortie += c
    }
  }
  return sortie
}

const FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/** Nombre au format français ; absent = « non disponible ». */
export function nombrePdf(v: number | null | undefined, unite = '', siAbsent = NON_DISPONIBLE) {
  if (v === null || v === undefined || Number.isNaN(v)) return siAbsent
  return pdfTexte(`${FORMAT.format(v)}${unite ? ` ${unite}` : ''}`)
}

export function cellule(c: Cellule): string {
  if (c === null || c === undefined || c === '') return NON_DISPONIBLE
  return typeof c === 'number' ? nombrePdf(c) : pdfTexte(c)
}

export function valeurTexte(v: Valeur): string {
  return v.texte === null || v.texte === '' ? (v.siAbsent ?? NON_DISPONIBLE) : pdfTexte(v.texte)
}

/** Décision utilisateur : le fumier n'apparaît jamais dans un PDF ONG. */
export const estFumier = (t: Cellule) => typeof t === 'string' && /fumier/i.test(t)

const deux = (n: number) => String(n).padStart(2, '0')
export const dateFr = (d: Date) => `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()}`
export const dateHeureFr = (d: Date) => `${dateFr(d)} à ${deux(d.getHours())} h ${deux(d.getMinutes())}`
export const dateIso = (d: Date) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`

/** « Kébémer » -> « kebemer » pour un nom de fichier. */
export const slug = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Sources à citer au minimum (textes de la mission). La date fournie par l'appelant l'emporte. */
export const SOURCES_MINIMALES: Source[] = [
  {
    id: 'cadre_harmonise',
    nom: "Cadre harmonisé, CILSS et partenaires ; données via HDX (Food Security and Nutrition Working Group, Afrique de l'Ouest et du Centre)",
    licence: 'CC BY',
  },
  { id: 'doses_pia', nom: 'Doses IFDC-CORAF PIA', detail: 'à confirmer' },
  { id: 'prix', nom: 'Prix des intrants : APS, circulaire', date: 'sept. 2025 (APS) ; 30 avril 2026 (circulaire)' },
]

export const SOURCE_GADM: Source = { id: 'gadm', nom: 'GADM, version 4.1, https://gadm.org', licence: 'usage non commercial, citation obligatoire' }

/** Sources de l'appelant complétées par les sources minimales (et GADM si les contours figurent). */
export function sourcesCompletes(sources: Source[], contoursGadm: boolean): Source[] {
  const attendues = contoursGadm ? [...SOURCES_MINIMALES, SOURCE_GADM] : SOURCES_MINIMALES
  const ids = new Set(sources.map((s) => s.id))
  return [...sources, ...attendues.filter((s) => !ids.has(s.id))]
}

export function ligneSource(s: Source) {
  const morceaux = [s.nom, `date : ${s.date || NON_DISPONIBLE}`]
  if (s.licence) morceaux.push(`licence : ${s.licence}`)
  if (s.detail) morceaux.push(s.detail)
  return pdfTexte(morceaux.join(' ; '))
}
