import { useQuery } from '@tanstack/react-query'
import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import { useMemo } from 'react'
import type { Departement } from '../types/marts'

// Petite carte du Sénégal pour choisir son département : contours des 6 zones agroécologiques et un point
// par département. Quand les contours GADM des départements existeront, ils remplaceront les points.
const LON = [-17.7, -11.25]
const LAT = [12.2, 16.8]
const L = 320
const H = Math.round((L * (LAT[1] - LAT[0])) / (LON[1] - LON[0]) / Math.cos((14.5 * Math.PI) / 180))

const projeter = ([lon, lat]: Position) =>
  `${(((lon - LON[0]) / (LON[1] - LON[0])) * L).toFixed(1)} ${(H - ((lat - LAT[0]) / (LAT[1] - LAT[0])) * H).toFixed(1)}`

type Zones = FeatureCollection<Polygon | MultiPolygon>

const anneaux = (g: Polygon | MultiPolygon) => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat())
const trace = (g: Polygon | MultiPolygon) => anneaux(g).map((a) => `M${a.map(projeter).join('L')}Z`).join('')

interface PropsCarteDepartements {
  departements: Departement[]
  selection: string
  onSelect: (code: string) => void
}

export function CarteDepartements({ departements, selection, onSelect }: PropsCarteDepartements) {
  const { data: zones } = useQuery({
    queryKey: ['geo-zones'],
    queryFn: () => fetch('/geo/zones_agroecologiques.geojson').then((r) => r.json() as Promise<Zones>),
    staleTime: Infinity,
  })
  const contours = useMemo(() => zones?.features.map((f) => trace(f.geometry)) ?? [], [zones])
  const points = useMemo(
    () => departements.map((d) => ({ ...d, position: projeter([d.longitude, d.latitude]).split(' ').map(Number) })),
    [departements],
  )

  // La liste déroulante, juste en dessous, est l'accès au clavier et au lecteur d'écran
  return (
    <svg viewBox={`-6 -6 ${L + 12} ${H + 12}`} className="w-full touch-manipulation" aria-hidden>
      {contours.map((d, i) => (
        <path key={i} d={d} fill="rgb(255 255 255 / 0.05)" stroke="rgb(201 216 234 / 0.4)" strokeWidth="0.7" strokeLinejoin="round" />
      ))}
      {points.map((p) => {
        const choisi = p.code_departement === selection
        return (
          <g key={p.code_departement} transform={`translate(${p.position[0]} ${p.position[1]})`} className="cursor-pointer" onClick={() => onSelect(p.code_departement)}>
            <title>{p.departement}</title>
            <circle r="9" fill="transparent" />
            {choisi && <circle r="5" fill="none" stroke="#f2b544" strokeWidth="1.2" className="point-choisi" />}
            <circle r={choisi ? 5 : 3} fill={choisi ? '#f2b544' : '#c9d8ea'} fillOpacity={choisi ? 1 : 0.75} className="transition-all duration-300" />
          </g>
        )
      })}
    </svg>
  )
}
