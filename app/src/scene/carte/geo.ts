// Géographie de la scène : contours (GADM pour les 45 départements, référentiel de l'équipe pour les 6 zones),
// repérage d'un point dans un département et cadrages.
import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'

export type Geometrie = Polygon | MultiPolygon
export type Contours = FeatureCollection<Geometrie, { GID_2: string; NAME_2: string }>
export type ContoursZones = FeatureCollection<Geometrie, { zone_agroecologique: string }>
export type Emprise = [[number, number], [number, number]]
export type LonLat = [number, number]

export const SENEGAL: { centre: LonLat; emprise: Emprise } = {
  centre: [-14.45, 14.45],
  emprise: [[-17.55, 12.3], [-11.35, 16.7]],
}

/** Les marts écrivent les zones en majuscules, le fond de carte en minuscules : on compare sur cette clé. */
export const cleZone = (nom: string) => nom.toLocaleUpperCase('fr-FR').trim()

export interface Zone {
  cle: string
  nom: string
  couleur: string
  /** une phrase de repère, sans chiffre : les chiffres viennent de l'API */
  repere: string
  /** nom écrit sur la carte, quand le nom complet est trop long */
  nomCourt?: string
  /** où écrire le nom, quand le calcul automatique tombe mal (zone découpée) */
  centreNom?: LonLat
}

// Du fleuve au nord vers la Casamance au sud. Couleurs tirées de la palette « Ciel & Terre ».
export const ZONES: Zone[] = [
  { cle: 'VALLÉE DU FLEUVE SÉNÉGAL', nom: 'Vallée du fleuve Sénégal', couleur: '#2d7fc1', nomCourt: 'Vallée du fleuve', repere: 'Le fleuve, au nord. Peu de pluie, des cultures irriguées.' },
  { cle: 'NIAYES', nom: 'Niayes', couleur: '#6fb58a', repere: 'La frange côtière, de Dakar vers Saint-Louis.' },
  { cle: 'ZONE SYLVOPASTORALE (FERLO)', nom: 'Zone sylvopastorale (Ferlo)', couleur: '#f2b544', nomCourt: 'Ferlo', repere: 'Le nord pastoral, à la saison des pluies courte.' },
  { cle: 'BASSIN ARACHIDIER', nom: 'Bassin arachidier', couleur: '#b7793f', centreNom: [-16.05, 14.45], repere: "Le centre du pays, terre de l'arachide et du mil." },
  { cle: 'SÉNÉGAL ORIENTAL', nom: 'Sénégal oriental', couleur: '#8a5527', repere: "L'est, vers le Mali et la Guinée." },
  { cle: 'CASAMANCE', nom: 'Casamance', couleur: '#1f5f3a', repere: 'Le sud, la région la plus arrosée.' },
]
export const ZONE_PAR_CLE = new Map(ZONES.map((z) => [z.cle, z]))

export async function lireGeo<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Fond de carte indisponible : ${url}`)
  return (await r.json()) as T
}

const polygones = (g: Geometrie): Position[][][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)

export function emprise(g: Geometrie): Emprise {
  let [o, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const poly of polygones(g))
    for (const [lon, lat] of poly[0]) {
      if (lon < o) o = lon
      if (lon > e) e = lon
      if (lat < s) s = lat
      if (lat > n) n = lat
    }
  return [[o, s], [e, n]]
}

export function centre(g: Geometrie): LonLat {
  // Centre du plus grand anneau : assez juste pour poser une étiquette ou un arc
  const anneau = polygones(g).map((p) => p[0]).reduce((a, b) => (b.length > a.length ? b : a))
  let [x, y] = [0, 0]
  for (const [lon, lat] of anneau) {
    x += lon
    y += lat
  }
  return [x / anneau.length, y / anneau.length]
}

function dansAnneau(anneau: Position[], lon: number, lat: number) {
  let dedans = false
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i]
    const [xj, yj] = anneau[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dedans = !dedans
  }
  return dedans
}

/** Code GADM du département qui contient le point, ou null hors du Sénégal. */
export function trouverDepartement(contours: Contours, lon: number, lat: number): string | null {
  for (const f of contours.features)
    for (const poly of polygones(f.geometry))
      if (dansAnneau(poly[0], lon, lat) && !poly.slice(1).some((trou) => dansAnneau(trou, lon, lat))) return f.properties.GID_2
  return null
}

type Anneau = number[][]
const dedans = (x: number, y: number, a: Anneau) => {
  let d = false
  for (let i = 0, j = a.length - 1; i < a.length; j = i++)
    if (a[i][1] > y !== a[j][1] > y && x < ((a[j][0] - a[i][0]) * (y - a[i][1])) / (a[j][1] - a[i][1]) + a[i][0]) d = !d
  return d
}
const distanceBord = (x: number, y: number, a: Anneau) => {
  let m = Infinity
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [x1, y1] = a[j], [x2, y2] = a[i]
    const dx = x2 - x1, dy = y2 - y1
    const t = dx || dy ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))) : 0
    m = Math.min(m, Math.hypot(x - x1 - t * dx, y - y1 - t * dy))
  }
  return m
}
const aire = (a: Anneau) => Math.abs(a.reduce((s, p, i) => { const q = a[(i + 1) % a.length]; return s + p[0] * q[1] - q[0] * p[1] }, 0)) / 2

/** Cœur d'une zone : le point le plus éloigné des bords dans sa plus grande partie (le nom y tient, même en croissant). */
export function coeur(g: { type: string; coordinates: unknown }): LonLat {
  const polys = (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]) as Anneau[][]
  const poly = polys.reduce((a, b) => (aire(b[0]) > aire(a[0]) ? b : a))
  const ext = poly[0]
  const xs = ext.map((p) => p[0]), ys = ext.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  let meilleur: LonLat = [(x0 + x1) / 2, (y0 + y1) / 2], dMax = -1
  const N = 40
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= N; j++) {
      const x = x0 + ((x1 - x0) * i) / N, y = y0 + ((y1 - y0) * j) / N
      if (!dedans(x, y, ext) || poly.slice(1).some((t) => dedans(x, y, t))) continue
      const d = Math.min(...poly.map((a) => distanceBord(x, y, a)))
      if (d > dMax) [dMax, meilleur] = [d, [x, y]]
    }
  return meilleur
}
