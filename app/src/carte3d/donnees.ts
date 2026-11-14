// Préparation des données de la carte 3D : un volume par département (hauteur = pluie de la saison,
// couleur = risque de la saison) et les 6 zones agroécologiques.
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon, Position } from 'geojson'
import type { Departement, LigneCarte, RisqueSaison } from '../types/marts'

export const RISQUES: { risque: RisqueSaison; libelle: string; couleur: string }[] = [
  { risque: 'normal', libelle: 'Saison normale', couleur: '#5fae78' },
  { risque: 'sécheresse', libelle: 'Sécheresse', couleur: '#d98a3d' },
  { risque: 'excès de pluie', libelle: 'Excès de pluie', couleur: '#4a9ad8' },
  { risque: 'sécheresse et excès de pluie', libelle: 'Sécheresse et excès de pluie', couleur: '#c0452c' },
]
export const COULEUR_NON_DISPONIBLE = '#8b8f9a'
const COULEURS_RISQUE = new Map(RISQUES.map((r) => [r.risque, r.couleur]))

/** 1 mm de pluie = 40 m de hauteur : le Sénégal est plat, les volumes portent toute la lecture. */
const METRES_PAR_MM = 40
/** Volume d'un département sans pluie connue : un socle gris, jamais une hauteur nulle prise pour « 0 mm ». */
const HAUTEUR_NON_DISPONIBLE_M = 1200
const RAYON_KM = 7

export interface ProprietesVolume {
  code: string
  nom: string
  couleur: string
  hauteur: number
}

/** Disque autour du point du département, en attendant les contours GADM. */
function disque(longitude: number, latitude: number, cotes = 24): Position[][] {
  const dLat = RAYON_KM / 110.574
  const dLon = RAYON_KM / (111.32 * Math.cos((latitude * Math.PI) / 180))
  const anneau = Array.from({ length: cotes + 1 }, (_, i) => {
    const a = (i / cotes) * 2 * Math.PI
    return [longitude + dLon * Math.cos(a), latitude + dLat * Math.sin(a)]
  })
  return [anneau]
}

export type Contours = FeatureCollection<Polygon | MultiPolygon, { GID_2: string }>

export interface Volumes {
  volumes: FeatureCollection<Polygon | MultiPolygon, ProprietesVolume>
  etiquettes: FeatureCollection<Point, ProprietesVolume>
}

/**
 * Une ligne du mart par département. Avec `contours` (GADM, propriété GID_2), les volumes prennent la forme
 * des départements ; sinon ce sont des colonnes posées sur leurs coordonnées.
 */
export function construireVolumes(lignes: LigneCarte[], departements: Departement[], contours: Contours | null): Volumes {
  const parCode = new Map(lignes.map((l) => [l.code_departement, l]))
  const formes = new Map(contours?.features.map((f) => [f.properties.GID_2, f.geometry]))

  const volumes: Volumes['volumes']['features'] = []
  const etiquettes: Volumes['etiquettes']['features'] = []
  for (const d of departements) {
    if (typeof d.latitude !== 'number' || typeof d.longitude !== 'number') continue
    const ligne = parCode.get(d.code_departement)
    const pluie = ligne?.pluie_saison_mm ?? null
    const properties: ProprietesVolume = {
      code: d.code_departement,
      nom: d.departement,
      couleur: (pluie !== null && ligne?.risque_saison && COULEURS_RISQUE.get(ligne.risque_saison)) || COULEUR_NON_DISPONIBLE,
      hauteur: pluie === null ? HAUTEUR_NON_DISPONIBLE_M : pluie * METRES_PAR_MM,
    }
    const geometry = formes.get(d.code_departement) ?? { type: 'Polygon' as const, coordinates: disque(d.longitude, d.latitude) }
    volumes.push({ type: 'Feature', id: d.code_departement, geometry, properties })
    etiquettes.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.longitude, d.latitude] }, properties })
  }
  return { volumes: { type: 'FeatureCollection', features: volumes }, etiquettes: { type: 'FeatureCollection', features: etiquettes } }
}

// --- Zones agroécologiques ---------------------------------------------------------------
export type ZonesSource = FeatureCollection<Polygon | MultiPolygon, { zone_agroecologique: string }>

/** Ordre d'allumage : du fleuve au nord vers la Casamance au sud, comme la pluie qui remonte. */
const ORDRE_ZONES = ['VALLÉE', 'NIAYES', 'SYLVOPASTORALE', 'BASSIN', 'ORIENTAL', 'CASAMANCE']
export const COULEURS_ZONES = ['#4a9ad8', '#7fc8b0', '#d9b56a', '#d98a3d', '#b7793f', '#5fae78']
export const NB_ZONES = ORDRE_ZONES.length

const rang = (nom: string) => {
  const i = ORDRE_ZONES.findIndex((cle) => nom.toUpperCase().includes(cle))
  return i === -1 ? NB_ZONES - 1 : i
}

function centre(g: Polygon | MultiPolygon): Position {
  const anneaux = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0])
  const plusGrand = anneaux.reduce((a, b) => (b.length > a.length ? b : a))
  const lons = plusGrand.map((p) => p[0])
  const lats = plusGrand.map((p) => p[1])
  return [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2]
}

export interface Zones {
  contours: FeatureCollection<Polygon | MultiPolygon, { rang: number; nom: string }>
  noms: FeatureCollection<Point, { rang: number; nom: string }>
}

export function construireZones(source: ZonesSource): Zones {
  const zones = source.features.map((f) => ({ geometry: f.geometry, properties: { rang: rang(f.properties.zone_agroecologique), nom: f.properties.zone_agroecologique } }))
  return {
    contours: { type: 'FeatureCollection', features: zones.map((z): Feature<Polygon | MultiPolygon, { rang: number; nom: string }> => ({ type: 'Feature', ...z })) },
    noms: {
      type: 'FeatureCollection',
      features: zones.map((z) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: centre(z.geometry) }, properties: z.properties })),
    },
  }
}
