// Textes wolof de la mascotte « WLF » : la même information que la mascotte « FR », traduite à l'avance
// en phrases types, remplies avec les vrais chiffres. Les nombres sont écrits en toutes lettres
// (la voix de synthèse lit mal les chiffres). Même règles que api/voix/nombres.py.
// À FAIRE RELIRE par un locuteur wolof de l'équipe.

const UNITES = ['', 'benn', 'ñaar', 'ñett', 'ñeent', 'juróom', 'juróom-benn', 'juróom-ñaar', 'juróom-ñett', 'juróom-ñeent']
const LIEES = ['', '', 'ñaari', 'ñetti', 'ñeenti', 'juróomi', 'juróom-benni', 'juróom-ñaari', 'juróom-ñetti', 'juróom-ñeenti']
const DIZAINES = ['', 'fukk', 'ñaar-fukk', 'fanweer', 'ñeent-fukk', 'juróom-fukk', 'juróom-benn-fukk', 'juróom-ñaar-fukk', 'juróom-ñett-fukk', 'juróom-ñeent-fukk']

const moinsDeCent = (n: number) => [DIZAINES[Math.floor(n / 10)], UNITES[n % 10]].filter(Boolean)
const moinsDeMille = (n: number) => {
  const c = Math.floor(n / 100)
  return [...(c === 0 ? [] : c === 1 ? ['téeméer'] : [`${LIEES[c]} téeméer`]), ...moinsDeCent(n % 100)]
}

/** Nombre en lettres : 611 → « juróom-benni téeméer ak fukk ak benn ». Absent → « xamuñu ko » (on ne sait pas). */
export function wo(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'xamuñu ko'
  const x = Math.round(n)
  if (x === 0) return 'tus'
  const k = Math.floor(x / 1000)
  const parties: string[] = []
  if (k) parties.push(k === 1 ? 'junni' : k < 10 ? `${LIEES[k]} junni` : `${moinsDeMille(k).join(' ak ')} junni`)
  return [...parties, ...moinsDeMille(x % 1000)].join(' ak ')
}

/** Un poids : en kilos, ou en tonnes à partir de 10 t (en dessous, la tonne arrondie fausserait le chiffre). */
export const poidsWo = (kg: number) => (kg >= 10000 ? `${wo(kg / 1000)} tonn` : `${wo(kg)} kilo`)

export const pctWo = (p: number | null | undefined) => (p === null || p === undefined ? 'xamuñu ko' : `${wo(p)} ci téeméer`)

const CULTURES: Record<string, string> = {
  ARACHIDE: 'gerte', 'MIL (SOUNA)': 'dugub', SORGHO: 'basi', 'MAÏS': 'mboq', 'NIÉBÉ': 'ñebbe', 'RIZ (IRRIGUÉ)': 'malo',
  'SÉSAME': 'beref', 'PASTÈQUE': 'xaal', COTON: 'koton', MANIOC: 'ñambi', OIGNON: 'soble', TOMATE: 'tamaate',
}
export const cultureWo = (code: string) => CULTURES[code] ?? code.toLowerCase()

export const CLASSE_WO: Record<string, string> = { 'sèche': 'taw bu néew', normale: 'taw bu yem', humide: 'taw bu bare' }

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
/** Décade de l'année (1 à 36) → « fukk ak benn ba ñaar-fukk juillet » */
export function decadeWo(de: number, a: number = de) {
  const debut = (d: number) => 1 + 10 * ((d - 1) % 3)
  const fin = (d: number) => ((d - 1) % 3 === 2 ? 30 : 10 + 10 * ((d - 1) % 3))
  const mois = (d: number) => MOIS[Math.floor((d - 1) / 3)]
  return mois(de) === mois(a) ? `${wo(debut(de))} ba ${wo(fin(a))} ${mois(a)}` : `${wo(debut(de))} ${mois(de)} ba ${wo(fin(a))} ${mois(a)}`
}

export const FIN_WO = 'Lii ab xayma la, du dëgg-dëgg. Laajal sa conseiller agricole.'
