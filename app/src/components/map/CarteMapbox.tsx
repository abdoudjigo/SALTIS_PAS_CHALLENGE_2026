import 'mapbox-gl/dist/mapbox-gl.css'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { useEffect, useMemo, useState } from 'react'
import Map, { AttributionControl, Layer, NavigationControl, Popup, Source, type MapMouseEvent } from 'react-map-gl/mapbox'
import { config } from '../../config'
import type { PropsCarteInterne } from './types'
import { valeurTexte } from './valeurTexte'

// Contours des départements (GADM 4.1 niveau 2, simplifiés), à déposer dans app/public/geo/.
// Propriété attendue : GID_2 = code_departement. Tant que le fichier est absent, on affiche des points.
const URL_CONTOURS = '/geo/departements.geojson'
type Contours = FeatureCollection<Geometry, { GID_2: string; NAME_2?: string }>
let contoursPromesse: Promise<Contours | null> | undefined

function chargerContours() {
  contoursPromesse ??= fetch(URL_CONTOURS)
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? (r.json() as Promise<Contours>) : null))
    .catch(() => null)
  return contoursPromesse
}

const VUE_INITIALE = { longitude: -14.45, latitude: 14.45, zoom: 5.7 }
const LIMITES: [[number, number], [number, number]] = [[-19.5, 11.5], [-10.5, 17.5]]

type ProprietesCarte = { code: string; couleur: string }

export default function CarteMapbox({ points, indicateur, selection, onSelect }: PropsCarteInterne) {
  const [contours, setContours] = useState<Contours | null>(null)
  const [survol, setSurvol] = useState<string | null>(null)

  useEffect(() => {
    chargerContours().then(setContours)
  }, [])

  const parCode = useMemo(() => new globalThis.Map(points.map((p) => [p.code_departement, p])), [points])

  const donnees = useMemo<FeatureCollection<Geometry, ProprietesCarte>>(() => {
    if (contours)
      return {
        type: 'FeatureCollection',
        features: contours.features.map((f): Feature<Geometry, ProprietesCarte> => ({
          type: 'Feature',
          geometry: f.geometry,
          properties: { code: f.properties.GID_2, couleur: parCode.get(f.properties.GID_2)?.couleur ?? '#c9c4b8' },
        })),
      }
    return {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: { code: p.code_departement, couleur: p.couleur },
      })),
    }
  }, [contours, points, parCode])

  const filtreSelection: ['==', ['get', string], string] = ['==', ['get', 'code'], selection ?? '']
  const actif = survol ? parCode.get(survol) : undefined
  const codeSous = (e: MapMouseEvent) =>
    ((e.features?.[0] as { properties?: Partial<ProprietesCarte> } | undefined)?.properties?.code) ?? null

  return (
    <Map
      mapboxAccessToken={config.mapboxToken}
      initialViewState={VUE_INITIALE}
      maxBounds={LIMITES}
      mapStyle={config.mapboxStyle}
      interactiveLayerIds={['departements']}
      cursor={survol ? 'pointer' : 'grab'}
      onMouseMove={(e) => setSurvol(codeSous(e))}
      onMouseLeave={() => setSurvol(null)}
      onClick={(e) => {
        const code = codeSous(e)
        if (code) onSelect?.(code)
      }}
      attributionControl={false}
      reuseMaps
    >
      <NavigationControl position="top-right" showCompass={false} />
      <AttributionControl compact customAttribution={contours ? 'GADM, version 4.1, https://gadm.org' : undefined} />
      <Source id="dep" type="geojson" data={donnees}>
        {contours ? (
          <>
            <Layer id="departements" source="dep" type="fill" paint={{ 'fill-color': ['get', 'couleur'], 'fill-opacity': 0.82 }} />
            <Layer id="dep-traits" source="dep" type="line" paint={{ 'line-color': '#ffffff', 'line-width': 0.8 }} />
            <Layer id="dep-selection" source="dep" type="line" filter={filtreSelection} paint={{ 'line-color': '#1d2a22', 'line-width': 2.5 }} />
          </>
        ) : (
          <>
            <Layer id="departements" source="dep" type="circle" paint={{
              'circle-color': ['get', 'couleur'],
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 8, 8, 18],
              'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2,
            }} />
            <Layer id="dep-selection" source="dep" type="circle" filter={filtreSelection} paint={{
              'circle-color': 'rgba(0,0,0,0)', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 12, 8, 23],
              'circle-stroke-color': '#1d2a22', 'circle-stroke-width': 3,
            }} />
          </>
        )}
      </Source>
      {actif && (
        <Popup longitude={actif.longitude} latitude={actif.latitude} closeButton={false} closeOnClick={false} offset={14} anchor="bottom">
          <div className="text-sm font-semibold">{actif.departement}</div>
          <div className="text-xs text-encre-douce">{actif.region} · {valeurTexte(actif.valeur, indicateur)}</div>
        </Popup>
      )}
    </Map>
  )
}
