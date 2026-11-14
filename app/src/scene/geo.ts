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
}

// Du fleuve au nord vers la Casamance au sud. Couleurs tirées de la palette « Ciel & Terre ».
export const ZONES: Zone[] = [
  { cle: 'VALLÉE DU FLEUVE SÉNÉGAL', nom: 'Vallée du fleuve Sénégal', couleur: '#2d7fc1', repere: 'Le fleuve, au nord. Peu de pluie, des cultures irriguées.' },
  { cle: 'NIAYES', nom: 'Niayes', couleur: '#6fb58a', repere: 'La frange côtière, de Dakar vers Saint-Louis.' },
  { cle: 'ZONE SYLVOPASTORALE (FERLO)', nom: 'Zone sylvopastorale (Ferlo)', couleur: '#f2b544', repere: 'Le nord pastoral, à la saison des pluies courte.' },
  { cle: 'BASSIN ARACHIDIER', nom: 'Bassin arachidier', couleur: '#b7793f', repere: "Le centre du pays, terre de l'arachide et du mil." },
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
