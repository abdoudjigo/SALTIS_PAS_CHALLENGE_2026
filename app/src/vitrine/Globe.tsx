import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl, { type StyleSpecification } from 'mapbox-gl'
import { useEffect, useRef } from 'react'
import { config } from '../config'
import { pointeur } from './pointeur'

const SENEGAL: [number, number] = [-14.5, 14.4]
const DEPART: [number, number] = [62, 8]
const ROTATION_DEG_S = 6
const ATTENTE_APPROCHE_MS = 2600
const DUREE_APPROCHE_MS = 6500
const FILTRE_SENEGAL = ['all', ['==', ['get', 'iso_3166_1'], 'SN'], ['in', ['get', 'worldview'], ['literal', ['all', 'US']]]]

// Le vent est un décor (prévisions mondiales GFS, jeu d'exemple de Mapbox), pas une donnée du projet.
function style(avecVent: boolean, particules: number): StyleSpecification {
  return {
    version: 8,
    projection: { name: 'globe' },
    fog: {
      color: '#8fb9e6',
      'high-color': '#1d3f7c',
      'horizon-blend': 0.07,
      'space-color': '#070b1c',
      'star-intensity': 0.75,
    },
    sources: {
      fond: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
      pays: { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' },
      ...(avecVent ? { vent: { type: 'raster-array', url: 'mapbox://rasterarrayexamples.gfs-winds', tileSize: 512 } } : {}),
    },
    layers: [
      { id: 'terres', type: 'background', paint: { 'background-color': '#3b2c1d' } },
      { id: 'oceans', type: 'fill', source: 'fond', 'source-layer': 'water', paint: { 'fill-color': '#0c1738' } },
      {
        id: 'frontieres', type: 'line', source: 'pays', 'source-layer': 'country_boundaries',
        filter: ['in', ['get', 'worldview'], ['literal', ['all', 'US']]],
        paint: { 'line-color': '#b7793f', 'line-opacity': 0.28, 'line-width': 0.6 },
      },
      ...(avecVent
        ? [{
            id: 'vent', type: 'raster-particle' as const, source: 'vent', 'source-layer': '10winds',
            paint: {
              'raster-particle-speed-factor': 0.35,
              'raster-particle-fade-opacity-factor': 0.92,
              'raster-particle-reset-rate-factor': 0.4,
              'raster-particle-count': particules,
              'raster-particle-max-speed': 40,
              'raster-particle-color': [
                'interpolate', ['linear'], ['raster-particle-speed'],
                1.5, 'rgba(143,185,230,0.55)',
                6, 'rgba(190,220,245,0.85)',
                12, 'rgba(242,214,150,0.95)',
                25, 'rgba(242,181,68,1)',
              ],
            },
          }]
        : []),
      {
        id: 'senegal-aplat', type: 'fill', source: 'pays', 'source-layer': 'country_boundaries', filter: FILTRE_SENEGAL,
        paint: { 'fill-color': '#f2b544', 'fill-opacity': 0, 'fill-opacity-transition': { duration: 2600 } },
      },
      {
        id: 'senegal-halo', type: 'line', source: 'pays', 'source-layer': 'country_boundaries', filter: FILTRE_SENEGAL,
        paint: { 'line-color': '#f2b544', 'line-width': 9, 'line-blur': 9, 'line-opacity': 0, 'line-opacity-transition': { duration: 2600 } },
      },
      {
        id: 'senegal-trait', type: 'line', source: 'pays', 'source-layer': 'country_boundaries', filter: FILTRE_SENEGAL,
        paint: { 'line-color': '#fbe3a6', 'line-width': 1.4, 'line-opacity': 0, 'line-opacity-transition': { duration: 2600 } },
      },
    ],
  } as StyleSpecification
}

export type Scene = 'accueil' | 'formulaire'

interface Cadre { zoom: number; padding: { top: number; right: number; bottom: number; left: number } }

/**
 * Cadrage selon l'écran et la scène. Accueil : le globe est le héros, à droite sur grand écran, en haut
 * sur téléphone. Formulaire : la caméra recule et se décale pour laisser la place au formulaire.
 */
function cadrage(conteneur: HTMLElement, scene: Scene): Cadre {
  const { clientWidth: l, clientHeight: h } = conteneur
  const vertical = l < 768 || l < h
  const zoom = (diametre: number) => Math.log2((diametre * Math.PI) / 512)

  if (scene === 'formulaire')
    return vertical
      ? { zoom: zoom(Math.min(l * 0.6, h * 0.3)), padding: { top: 0, right: 0, left: 0, bottom: Math.round(h * 0.72) } }
      : { zoom: zoom(Math.min(l * 0.36, h * 0.6)), padding: { top: 0, left: 0, bottom: Math.round(h * 0.1), right: Math.round(l * 0.44) } }
  // Sur téléphone, le globe déborde un peu de l'écran et le Sénégal se pose au-dessus du texte
  return vertical
    ? { zoom: zoom(Math.min(l * 0.86, h * 0.5)), padding: { top: 0, right: 0, left: 0, bottom: Math.round(h * 0.6) } }
    : { zoom: zoom(Math.min(l * 0.52, h * 0.8)), padding: { top: 0, right: 0, bottom: Math.round(h * 0.08), left: Math.round(l * 0.38) } }
}

const ZOOM_ARRIVEE = 0.45
const adoucir = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const vers = (a: number, b: number, k: number) => a + (b - a) * k

export default function Globe({ anime, scene, onPret }: { anime: boolean; scene: Scene; onPret: () => void }) {
  const conteneur = useRef<HTMLDivElement>(null)
  const pret = useRef(onPret)
  const sceneCourante = useRef(scene)
  const recadrer = useRef<() => void>(undefined)
  useEffect(() => {
    pret.current = onPret
  })
  useEffect(() => {
    sceneCourante.current = scene
    recadrer.current?.()
  }, [scene])

  useEffect(() => {
    const el = conteneur.current
    if (!el) return
    const etroit = el.clientWidth < 768
    let cadre = cadrage(el, sceneCourante.current)

    const carte = new mapboxgl.Map({
      container: el,
      accessToken: config.mapboxToken,
      style: style(anime, etroit ? 380 : 1000),
      center: anime ? DEPART : SENEGAL,
      zoom: anime ? cadre.zoom : cadre.zoom + ZOOM_ARRIVEE,
      interactive: false,
      attributionControl: false,
      antialias: false,
      fadeDuration: 0,
    })
    carte.setPadding(cadre.padding)
    carte.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

    const eclairerSenegal = () => {
      carte.setPaintProperty('senegal-aplat', 'fill-opacity', 0.22)
      carte.setPaintProperty('senegal-halo', 'line-opacity', 0.9)
      carte.setPaintProperty('senegal-trait', 'line-opacity', 1)
    }

    // Sans animation : le globe est posé sur le Sénégal et se recadre d'un coup
    const poser = () => {
      cadre = cadrage(el, sceneCourante.current)
      carte.jumpTo({ center: SENEGAL, zoom: cadre.zoom + ZOOM_ARRIVEE, padding: cadre.padding })
    }
    if (!anime) recadrer.current = poser

    let image = 0
    let centre: [number, number] = anime ? [...DEPART] : [...SENEGAL]

    carte.once('style.load', () => {
      pret.current()
      if (!anime) return eclairerSenegal()

      const debut = performance.now()
      let precedent = debut
      let departApproche: [number, number] | null = null
      let approche = 0

      const boucle = (t: number) => {
        image = requestAnimationFrame(boucle)
        const dt = Math.min(t - precedent, 50) / 1000
        precedent = t
        const ecoule = t - debut

        if (ecoule < ATTENTE_APPROCHE_MS) {
          centre[0] -= ROTATION_DEG_S * dt
        } else if (approche < 1) {
          departApproche ??= [...centre]
          const p = Math.min((ecoule - ATTENTE_APPROCHE_MS) / DUREE_APPROCHE_MS, 1)
          approche = adoucir(p)
          centre = [vers(departApproche[0], SENEGAL[0], approche), vers(departApproche[1], SENEGAL[1], approche)]
          if (p > 0.72 && carte.getPaintProperty('senegal-trait', 'line-opacity') === 0) eclairerSenegal()
        } else {
          // Au repos : respiration lente et légère réaction au pointeur ou à l'inclinaison du téléphone
          const cible: [number, number] = [
            SENEGAL[0] + Math.sin(ecoule / 9000) * 1.6 - pointeur.x * 5,
            SENEGAL[1] + pointeur.y * 3.5,
          ]
          centre = [vers(centre[0], cible[0], 0.04), vers(centre[1], cible[1], 0.04)]
        }

        // Le cadre glisse vers celui de la scène en cours (accueil ou formulaire) et suit la taille de l'écran
        const vise = cadrage(el, sceneCourante.current)
        const k = Math.min(dt * 2.6, 1)
        cadre = {
          zoom: vers(cadre.zoom, vise.zoom, k),
          padding: {
            top: vers(cadre.padding.top, vise.padding.top, k),
            right: vers(cadre.padding.right, vise.padding.right, k),
            bottom: vers(cadre.padding.bottom, vise.padding.bottom, k),
            left: vers(cadre.padding.left, vise.padding.left, k),
          },
        }
        carte.jumpTo({ center: centre, zoom: cadre.zoom + ZOOM_ARRIVEE * approche, padding: cadre.padding })
      }
      image = requestAnimationFrame(boucle)
    })

    const observateur = new ResizeObserver(() => {
      carte.resize()
      if (!anime) poser()
    })
    observateur.observe(el)

    return () => {
      cancelAnimationFrame(image)
      observateur.disconnect()
      recadrer.current = undefined
      carte.remove()
    }
  }, [anime])

  return <div ref={conteneur} className="size-full" />
}
