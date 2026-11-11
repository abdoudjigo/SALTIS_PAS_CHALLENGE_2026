// Style de la carte 3D du Sénégal : même nuit que le globe de la landing, avec le relief et la végétation
// en vectoriel (les tuiles de relief en image ne sont pas disponibles sur le compte Mapbox du projet).
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'mapbox-gl'
import { COULEURS_ZONES, NB_ZONES } from './donnees'

const VIDE = { type: 'FeatureCollection' as const, features: [] }
const POLICE = ['DIN Pro Medium', 'Arial Unicode MS Regular']
const MONDE: ExpressionSpecification = ['in', ['get', 'worldview'], ['literal', ['all', 'US']]]
const SENEGAL: ExpressionSpecification = ['all', ['==', ['get', 'iso_3166_1'], 'SN'], MONDE]

export const COUCHE_VOLUMES = 'volumes'
export const coucheZone = (i: number) => `zone-${i}`
export const coucheTraitZone = (i: number) => `zone-trait-${i}`
export const coucheNomZone = (i: number) => `zone-nom-${i}`

const fondu = { duration: 700 }

function couchesZones(): LayerSpecification[] {
  return Array.from({ length: NB_ZONES }, (_, i): LayerSpecification[] => {
    const filtre: ExpressionSpecification = ['==', ['get', 'rang'], i]
    return [
      { id: coucheZone(i), type: 'fill', source: 'zones', filter: filtre,
        paint: { 'fill-color': COULEURS_ZONES[i], 'fill-opacity': 0, 'fill-opacity-transition': fondu } },
      { id: coucheTraitZone(i), type: 'line', source: 'zones', filter: filtre,
        paint: { 'line-color': COULEURS_ZONES[i], 'line-width': 1.2, 'line-opacity': 0, 'line-opacity-transition': fondu } },
    ]
  }).flat()
}

function couchesNomsZones(): LayerSpecification[] {
  return Array.from({ length: NB_ZONES }, (_, i): LayerSpecification => ({
    id: coucheNomZone(i), type: 'symbol', source: 'zones-noms', filter: ['==', ['get', 'rang'], i], maxzoom: 7.4,
    layout: {
      'text-field': ['get', 'nom'], 'text-font': POLICE, 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 11, 7, 15],
      'text-max-width': 8, 'text-letter-spacing': 0.06, 'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(7,11,28,0.85)', 'text-halo-width': 1.6, 'text-opacity': 0, 'text-opacity-transition': fondu },
  }))
}

export function styleCarte(): StyleSpecification {
  return {
    version: 8,
    projection: { name: 'globe' },
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    fog: { color: '#8fb9e6', 'high-color': '#1d3f7c', 'horizon-blend': 0.07, 'space-color': '#070b1c', 'star-intensity': 0.75 },
    // Lumière rasante du soir sur les volumes
    light: { anchor: 'map', color: '#ffe2ae', intensity: 0.55, position: [1.4, 235, 62] },
    sources: {
      fond: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
      relief: { type: 'vector', url: 'mapbox://mapbox.mapbox-terrain-v2' },
      pays: { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' },
      zones: { type: 'geojson', data: VIDE },
      'zones-noms': { type: 'geojson', data: VIDE },
      volumes: { type: 'geojson', data: VIDE, promoteId: 'code' },
      etiquettes: { type: 'geojson', data: VIDE },
    },
    layers: [
      { id: 'terres', type: 'background', paint: { 'background-color': '#3b2c1d' } },
      {
        id: 'vegetation', type: 'fill', source: 'relief', 'source-layer': 'landcover',
        paint: {
          'fill-color': ['match', ['get', 'class'], 'wood', '#2f4a2c', 'scrub', '#3f4a2a', 'grass', '#4a4a2a', 'crop', '#4f4426', '#3b2c1d'],
          'fill-opacity': 0.75, 'fill-antialias': false,
        },
      },
      {
        id: 'ombres', type: 'fill', source: 'relief', 'source-layer': 'hillshade',
        paint: {
          'fill-color': ['match', ['get', 'class'], 'highlight', '#f6d9a0', '#05070f'],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.05, 8, 0.16], 'fill-antialias': false,
        },
      },
      { id: 'oceans', type: 'fill', source: 'fond', 'source-layer': 'water', paint: { 'fill-color': '#0c1738' } },
      {
        id: 'fleuves', type: 'line', source: 'fond', 'source-layer': 'waterway', minzoom: 5,
        filter: ['in', ['get', 'class'], ['literal', ['river', 'canal']]],
        paint: { 'line-color': '#2a5aa0', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 9, 2] },
      },
      {
        id: 'frontieres', type: 'line', source: 'pays', 'source-layer': 'country_boundaries', filter: MONDE,
        paint: { 'line-color': '#b7793f', 'line-opacity': 0.3, 'line-width': 0.6 },
      },
      ...couchesZones(),
      {
        id: 'senegal-halo', type: 'line', source: 'pays', 'source-layer': 'country_boundaries', filter: SENEGAL,
        paint: { 'line-color': '#f2b544', 'line-width': 8, 'line-blur': 8, 'line-opacity': 0.55 },
      },
      {
        id: 'senegal-trait', type: 'line', source: 'pays', 'source-layer': 'country_boundaries', filter: SENEGAL,
        paint: { 'line-color': '#fbe3a6', 'line-width': 1.2 },
      },
      {
        id: COUCHE_VOLUMES, type: 'fill-extrusion', source: 'volumes',
        paint: {
          'fill-extrusion-color': [
            'case',
            ['boolean', ['feature-state', 'choisi'], false], '#fff1c2',
            ['boolean', ['feature-state', 'survol'], false], '#ffffff',
            ['get', 'couleur'],
          ],
          'fill-extrusion-height': 0,
          'fill-extrusion-opacity': 0,
          'fill-extrusion-opacity-transition': { duration: 600 },
          'fill-extrusion-vertical-gradient': true,
        },
      },
      ...couchesNomsZones(),
      {
        id: 'etiquettes', type: 'symbol', source: 'etiquettes', minzoom: 6.7,
        layout: { 'text-field': ['get', 'nom'], 'text-font': POLICE, 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top' },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(7,11,28,0.9)', 'text-halo-width': 1.4 },
      },
    ],
  }
}
