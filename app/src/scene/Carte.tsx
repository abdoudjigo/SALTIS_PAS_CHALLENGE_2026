// Moteur de carte partagé par la landing et la scène : un globe Mapbox (style Standard) piloté par une
// « vue » déclarative. Changer de vue fait glisser la caméra, la lumière, les couleurs et les volumes.
import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl, { type ExpressionSpecification, type GeoJSONSource, type PaddingOptions } from 'mapbox-gl'
import { useEffect, useRef, useState } from 'react'
import { config } from '../config'
import type { Departement } from '../types/marts'
import { CIEL_VIF, melanger, rvb, type Rvb } from './couleurs'
import { centre, cleZone, SENEGAL, ZONE_PAR_CLE, type Contours, type ContoursZones, type Emprise, type LonLat } from './geo'

export type Ambiance = 'clair' | 'jour' | 'aube' | 'crepuscule' | 'nuit'

export interface Camera {
  /** soit un cadre à faire tenir à l'écran, soit un centre et un zoom */
  emprise?: Emprise
  centre?: LonLat
  zoom?: number
  inclinaison?: number
  cap?: number
  duree?: number
  marge?: Partial<PaddingOptions>
}

export interface EtatDepartement {
  couleur: string
  /** hauteur du volume en mètres (ignorée à plat) */
  hauteur?: number
}

export interface Arc {
  id: string
  de: LonLat
  vers: LonLat
  /** 0 à 1 : épaisseur du trait */
  poids: number
}

export interface Repere {
  id: string
  position: LonLat
  genre: 'position' | 'depot'
  libelle?: string
}

export interface VueCarte {
  ambiance: Ambiance
  camera: Camera
  /** zones agroécologiques : toutes visibles, avec éventuellement une zone mise en avant */
  zones?: { accent?: string | null } | null
  /** couleur (et hauteur) par code de département ; null = couche masquée */
  departements?: Map<string, EtatDepartement> | null
  /** volumes 3D (hauteur = valeur) ou aplats */
  relief?: boolean
  selection?: string | null
  /** départements en alerte : contour et aplat rouges qui pulsent, comme un gyrophare */
  alertes?: string[]
  arcs?: Arc[]
  reperes?: Repere[]
  satellite?: boolean
  /** 0 à 1 */
  pluie?: number
  vent?: boolean
  /** rotation lente du globe */
  derive?: boolean
}

export interface Survol {
  code: string
  x: number
  y: number
}

interface PropsCarte {
  vue: VueCarte
  contours: Contours | undefined
  contoursZones: ContoursZones | undefined
  departements: Departement[] | undefined
  /** position de la caméra à la création, avant le premier vol (arrivée depuis le globe) */
  depart?: { centre: LonLat; zoom: number }
  /** gestes de l'utilisateur (zoom, déplacement). Faux sur la landing : la page défile par-dessus */
  interactive?: boolean
  onDepartement?: (code: string) => void
  onZone?: (cle: string) => void
  onPoint?: (position: LonLat) => void
  onSurvol?: (survol: Survol | null) => void
  onSurvolZone?: (cle: string | null) => void
  /** l'utilisateur manipule la carte (déplacement, zoom, rotation) : vrai au début, faux à la fin */
  onManipulation?: (enCours: boolean) => void
  className?: string
}

const VIDE = { type: 'FeatureCollection' as const, features: [] }
const PRESETS: Record<Ambiance, string> = { clair: 'day', jour: 'day', aube: 'dawn', crepuscule: 'dusk', nuit: 'night' }
const SOMBRES: Ambiance[] = ['crepuscule', 'nuit']
const GRIS: Rvb = [170, 176, 182]
const DUREE_TEINTE_MS = 750
/** Miroir du token --color-alerte-500, et durée d'un battement d'alerte */
const ROUGE_ALERTE = '#d2492f'
const BATTEMENT_MS = 620
const PAS_ZONE_MS = 170
const etat = (cle: string, defaut: number): ExpressionSpecification => ['coalesce', ['feature-state', cle], defaut]
const adoucir = (t: number) => 1 - (1 - t) ** 3

/** Arc entre deux points : la hauteur vient du style (line-z-offset), le tracé reste une ligne droite au sol. */
function ligne(de: LonLat, vers: LonLat, pas = 48) {
  return Array.from({ length: pas + 1 }, (_, i) => [de[0] + ((vers[0] - de[0]) * i) / pas, de[1] + ((vers[1] - de[1]) * i) / pas])
}

function elementRepere(r: Repere) {
  const el = document.createElement('div')
  el.className = `repere repere-${r.genre}`
  el.innerHTML = `<span class="repere-onde"></span><span class="repere-point"></span>${r.libelle ? `<span class="repere-nom">${r.libelle}</span>` : ''}`
  return el
}

export default function Carte({ vue, contours, contoursZones, departements, depart, interactive = true, onDepartement, onZone, onPoint, onSurvol, onSurvolZone, onManipulation, className }: PropsCarte) {
  const conteneur = useRef<HTMLDivElement>(null)
  const carteRef = useRef<mapboxgl.Map | null>(null)
  const [prete, setPrete] = useState(false)
  const rappels = useRef({ onDepartement, onZone, onPoint, onSurvol, onSurvolZone, onManipulation })
  const vueRef = useRef(vue)
  const departRef = useRef(depart)
  useEffect(() => {
    rappels.current = { onDepartement, onZone, onPoint, onSurvol, onSurvolZone, onManipulation }
    vueRef.current = vue
  })

  // --- Création --------------------------------------------------------------------------------
  useEffect(() => {
    const el = conteneur.current
    if (!el) return
    const v = vueRef.current
    const clair = v.ambiance === 'clair'
    const carte = new mapboxgl.Map({
      container: el,
      accessToken: config.mapboxToken,
      style: 'mapbox://styles/mapbox/standard',
      projection: 'globe',
      center: departRef.current?.centre ?? v.camera.centre ?? SENEGAL.centre,
      zoom: departRef.current?.zoom ?? v.camera.zoom ?? 5,
      pitch: v.camera.inclinaison ?? 0,
      bearing: v.camera.cap ?? 0,
      interactive,
      attributionControl: false,
      maxPitch: 75,
      config: {
        basemap: {
          lightPreset: PRESETS[v.ambiance],
          theme: clair ? 'faded' : 'default',
          showPointOfInterestLabels: false,
          showTransitLabels: false,
          showPlaceLabels: !clair,
          showRoadLabels: !clair,
          // La landing reprend la palette : terre claire, eau « pluie », frontières « terre »
          ...(clair ? { colorLand: '#fbfaf6', colorWater: '#cfe5f6', colorGreenspace: '#dcecdf', colorAdminBoundaries: '#c9a57d' } : {}),
        },
      },
    })
    carteRef.current = carte
    carte.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    if (v.camera.marge) carte.setPadding({ top: 0, right: 0, bottom: 0, left: 0, ...v.camera.marge })

    carte.on('style.load', () => {
      if (clair) carte.setFog({ color: '#ffffff', 'high-color': CIEL_VIF, 'space-color': '#ffffff', 'horizon-blend': 0.07, 'star-intensity': 0 })

      carte.addSource('zones', { type: 'geojson', data: VIDE, promoteId: 'cle' })
      carte.addSource('departements', { type: 'geojson', data: VIDE, promoteId: 'GID_2' })
      carte.addSource('noms', { type: 'geojson', data: VIDE })
      carte.addSource('arcs', { type: 'geojson', data: VIDE, lineMetrics: true })

      if (config.mapboxSatellite) {
        carte.addSource('satellite', { type: 'raster', url: 'mapbox://mapbox.satellite', tileSize: 256 })
        carte.addLayer({
          id: 'satellite', type: 'raster', source: 'satellite', slot: 'bottom', layout: { visibility: 'none' },
          paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: 1800 }, 'raster-fade-duration': 300 },
        })
      }
      carte.addLayer({
        id: 'zones-aplat', type: 'fill', source: 'zones', slot: 'middle',
        paint: { 'fill-color': ['get', 'couleur'], 'fill-opacity': etat('o', 0), 'fill-emissive-strength': 1 },
      })
      carte.addLayer({
        id: 'zones-trait', type: 'line', source: 'zones', slot: 'middle',
        paint: { 'line-color': ['get', 'couleur'], 'line-width': 1.6, 'line-opacity': ['min', 1, ['*', 1.6, etat('o', 0)]], 'line-emissive-strength': 1 },
      })
      const teinte: ExpressionSpecification = ['rgb', etat('r', GRIS[0]), etat('g', GRIS[1]), etat('b', GRIS[2])]
      carte.addLayer({
        id: 'dep-aplat', type: 'fill', source: 'departements', slot: 'middle', layout: { visibility: 'none' },
        paint: { 'fill-color': teinte, 'fill-opacity': 0, 'fill-opacity-transition': { duration: 500 }, 'fill-emissive-strength': 1 },
      })
      carte.addLayer({
        id: 'dep-trait', type: 'line', source: 'departements', slot: 'middle', layout: { visibility: 'none' },
        paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 9, 1.6], 'line-opacity': 0.85, 'line-emissive-strength': 1 },
      })
      carte.addLayer({
        id: 'dep-volumes', type: 'fill-extrusion', source: 'departements', slot: 'middle', layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': teinte,
          'fill-extrusion-height': etat('h', 0),
          'fill-extrusion-opacity': 0,
          'fill-extrusion-opacity-transition': { duration: 500 },
          'fill-extrusion-emissive-strength': 0.82,
          'fill-extrusion-vertical-gradient': true,
        },
      })
      // Alertes : un aplat et un contour rouges (token alerte-500), dont l'opacité pulse
      carte.addLayer({
        id: 'dep-alerte-aplat', type: 'fill', source: 'departements', slot: 'top', filter: ['in', ['get', 'GID_2'], ['literal', []]],
        paint: { 'fill-color': ROUGE_ALERTE, 'fill-opacity': 0, 'fill-opacity-transition': { duration: BATTEMENT_MS }, 'fill-emissive-strength': 1 },
      })
      carte.addLayer({
        id: 'dep-alerte-trait', type: 'line', source: 'departements', slot: 'top', filter: ['in', ['get', 'GID_2'], ['literal', []]],
        paint: { 'line-color': ROUGE_ALERTE, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.4, 9, 5], 'line-opacity': 0, 'line-opacity-transition': { duration: BATTEMENT_MS }, 'line-emissive-strength': 1 },
      })
      carte.addLayer({
        id: 'dep-selection', type: 'line', source: 'departements', slot: 'top', filter: ['==', ['get', 'GID_2'], ''],
        paint: { 'line-color': '#ffffff', 'line-width': 3.2, 'line-emissive-strength': 1 },
      })
      carte.addLayer({
        id: 'dep-survol', type: 'line', source: 'departements', slot: 'top', filter: ['==', ['get', 'GID_2'], ''],
        paint: { 'line-color': '#ffffff', 'line-width': 1.8, 'line-opacity': 0.9, 'line-emissive-strength': 1 },
      })
      carte.addLayer({
        id: 'arcs', type: 'line', source: 'arcs', slot: 'top',
        layout: {
          'line-cap': 'butt',
          // L'arc s'élève au milieu du trajet : plus le trajet est long, plus il monte
          'line-z-offset': ['*', ['sin', ['*', ['line-progress'], Math.PI]], ['get', 'fleche']],
          'line-elevation-reference': 'sea',
        },
        paint: {
          'line-color': '#f2b544',
          'line-width': ['+', 1.2, ['*', 5, ['get', 'poids']]],
          'line-opacity': 0.95,
          'line-emissive-strength': 1,
          'line-trim-offset': [0, 1],
        },
      })
      carte.addLayer({
        id: 'noms', type: 'symbol', source: 'noms', slot: 'top', minzoom: 6.4, layout: {
          visibility: 'none', 'text-field': ['get', 'nom'], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6.4, 10.5, 9, 14], 'text-max-width': 7,
        },
        paint: { 'text-color': '#1d2a22', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.3, 'text-emissive-strength': 1 },
      })
      setPrete(true)
    })

    // Survol et clics : le département sous le pointeur, quelle que soit la couche affichée
    const sous = (point: mapboxgl.Point) => {
      const couches = ['dep-aplat', 'dep-volumes'].filter((c) => carte.getLayer(c) && carte.getLayoutProperty(c, 'visibility') !== 'none')
      const dep = couches.length ? carte.queryRenderedFeatures(point, { layers: couches })[0] : undefined
      if (dep) return { code: String(dep.properties?.GID_2) }
      const zone = carte.getLayer('zones-aplat') ? carte.queryRenderedFeatures(point, { layers: ['zones-aplat'] })[0] : undefined
      return zone ? { zone: String(zone.properties?.cle) } : {}
    }
    let survole = ''
    let zoneSurvolee = ''
    carte.on('mousemove', (e) => {
      if (!carte.getLayer('dep-survol')) return
      const { code = '', zone = '' } = sous(e.point)
      carte.getCanvas().style.cursor = code || rappels.current.onPoint || (zone && rappels.current.onZone) ? 'pointer' : ''
      if (zone !== zoneSurvolee) {
        zoneSurvolee = zone
        rappels.current.onSurvolZone?.(zone || null)
      }
      if (code !== survole) {
        survole = code
        carte.setFilter('dep-survol', ['==', ['get', 'GID_2'], code])
      }
      rappels.current.onSurvol?.(code ? { code, x: e.point.x, y: e.point.y } : null)
    })
    carte.on('mouseout', () => {
      survole = ''
      if (carte.getLayer('dep-survol')) carte.setFilter('dep-survol', ['==', ['get', 'GID_2'], ''])
      rappels.current.onSurvol?.(null)
    })
    carte.on('click', (e) => {
      const { code, zone } = sous(e.point)
      // Au doigt, pas de survol : le toucher ouvre l'infobulle du département
      rappels.current.onSurvol?.(code ? { code, x: e.point.x, y: e.point.y } : null)
      if (code && rappels.current.onDepartement) return rappels.current.onDepartement(code)
      if (rappels.current.onPoint) return rappels.current.onPoint([e.lngLat.lng, e.lngLat.lat])
      if (zone) rappels.current.onZone?.(zone)
    })

    carte.on('dragstart', () => rappels.current.onSurvol?.(null))
    // Gestes de l'utilisateur seulement (un vol de caméra n'a pas d'événement d'origine)
    let manipule = false
    for (const debut of ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart'] as const)
      carte.on(debut, (e) => {
        if (!(e as { originalEvent?: Event }).originalEvent || manipule) return
        manipule = true
        rappels.current.onManipulation?.(true)
      })
    carte.on('moveend', () => {
      if (!manipule) return
      manipule = false
      rappels.current.onManipulation?.(false)
    })
    const observateur = new ResizeObserver(() => carte.resize())
    observateur.observe(el)
    return () => {
      observateur.disconnect()
      carteRef.current = null
      setPrete(false)
      carte.remove()
    }
  }, [interactive])

  // --- Données géographiques -------------------------------------------------------------------
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !contoursZones) return
    const features = contoursZones.features.map((f) => {
      const cle = cleZone(f.properties.zone_agroecologique)
      return { ...f, properties: { cle, couleur: ZONE_PAR_CLE.get(cle)?.couleur ?? '#b7793f' } }
    })
    ;(carte.getSource('zones') as GeoJSONSource).setData({ type: 'FeatureCollection', features })
  }, [prete, contoursZones])

  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !contours) return
    ;(carte.getSource('departements') as GeoJSONSource).setData(contours)
    const noms = new Map(departements?.map((d) => [d.code_departement, d.departement]))
    ;(carte.getSource('noms') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: contours.features.map((f) => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: centre(f.geometry) }, properties: { nom: noms.get(f.properties.GID_2) ?? f.properties.NAME_2 },
      })),
    })
  }, [prete, contours, departements])

  // --- Lumière ---------------------------------------------------------------------------------
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete) return
    carte.setConfigProperty('basemap', 'lightPreset', PRESETS[vue.ambiance])
    const sombre = SOMBRES.includes(vue.ambiance)
    carte.setPaintProperty('noms', 'text-color', sombre ? '#ffffff' : '#1d2a22')
    carte.setPaintProperty('noms', 'text-halo-color', sombre ? 'rgba(7,11,28,0.85)' : 'rgba(255,255,255,0.9)')
    carte.setPaintProperty('dep-trait', 'line-color', sombre ? 'rgba(255,255,255,0.55)' : '#ffffff')
  }, [prete, vue.ambiance])

  // --- Caméra ----------------------------------------------------------------------------------
  const cleCamera = JSON.stringify(vue.camera)
  const premiere = useRef(true)
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete) return
    const c = JSON.parse(cleCamera) as Camera
    const padding = { top: 0, right: 0, bottom: 0, left: 0, ...c.marge }
    const cible = c.emprise
      ? carte.cameraForBounds(c.emprise, { padding, pitch: c.inclinaison ?? 0, bearing: c.cap ?? 0 })
      : { center: c.centre, zoom: c.zoom }
    if (!cible) return
    // Vue inclinée : le cadrage calculé est prudent, on se rapproche un peu
    if (c.emprise && (c.inclinaison ?? 0) > 40 && typeof cible.zoom === 'number' && carte.getContainer().clientWidth >= 768) cible.zoom += 0.3
    const options = { ...cible, pitch: c.inclinaison ?? 0, bearing: c.cap ?? 0, padding }
    // La toute première position est déjà celle de la création : pas de vol
    if (premiere.current && !c.emprise && !departRef.current) {
      premiere.current = false
      return
    }
    const arrivee = premiere.current
    premiere.current = false
    carte.flyTo({ ...options, duration: arrivee && departRef.current ? 4200 : (c.duree ?? 2200), curve: 1.3, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) })
  }, [prete, cleCamera])

  // --- Rotation lente du globe -----------------------------------------------------------------
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !vue.derive) return
    let image = 0
    let precedent = performance.now()
    const boucle = (t: number) => {
      image = requestAnimationFrame(boucle)
      const dt = Math.min(t - precedent, 50) / 1000
      precedent = t
      if (carte.isMoving()) return
      const c = carte.getCenter()
      carte.jumpTo({ center: [c.lng - 4 * dt, c.lat] })
    }
    image = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(image)
  }, [prete, vue.derive])

  // --- Zones agroécologiques : elles s'allument l'une après l'autre, du nord au sud ------------
  const zonesVisibles = Boolean(vue.zones)
  const accent = vue.zones?.accent ?? null
  const opaciteZones = useRef(new Map<string, number>())
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !contoursZones) return
    const cles = [...ZONE_PAR_CLE.keys()]
    const depart = new Map(cles.map((c) => [c, opaciteZones.current.get(c) ?? 0]))
    const eveil = zonesVisibles && cles.every((c) => (depart.get(c) ?? 0) === 0)
    const cible = (c: string) => (!zonesVisibles ? 0 : accent ? (c === accent ? 0.82 : 0.16) : 0.58)
    const debut = performance.now()
    let image = 0
    const boucle = (t: number) => {
      let fini = true
      cles.forEach((c, i) => {
        const p = Math.min(Math.max((t - debut - (eveil ? i * PAS_ZONE_MS : 0)) / 600, 0), 1)
        if (p < 1) fini = false
        const o = (depart.get(c) ?? 0) + (cible(c) - (depart.get(c) ?? 0)) * adoucir(p)
        opaciteZones.current.set(c, o)
        carte.setFeatureState({ source: 'zones', id: c }, { o })
      })
      if (!fini) image = requestAnimationFrame(boucle)
    }
    image = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(image)
  }, [prete, contoursZones, zonesVisibles, accent])

  // --- Départements : couleurs et hauteurs glissent d'une vue à l'autre -------------------------
  const etats = useRef(new Map<string, { c: Rvb; h: number }>())
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !contours) return
    const visibles = Boolean(vue.departements)
    const relief = Boolean(vue.relief)
    const montrer = (couche: string, oui: boolean) => carte.setLayoutProperty(couche, 'visibility', oui ? 'visible' : 'none')
    montrer('dep-aplat', visibles && !relief)
    montrer('dep-trait', visibles && !relief)
    montrer('dep-volumes', visibles && relief)
    montrer('noms', visibles)
    carte.setPaintProperty('dep-aplat', 'fill-opacity', visibles && !relief ? 0.86 : 0)
    carte.setPaintProperty('dep-volumes', 'fill-extrusion-opacity', visibles && relief ? 0.94 : 0)
    carte.setFilter('dep-selection', ['==', ['get', 'GID_2'], (visibles && vue.selection) || ''])
    if (!visibles) return

    const cibles = new Map(
      contours.features.map((f) => {
        const code = f.properties.GID_2
        const e = vue.departements?.get(code)
        let c = e ? rvb(e.couleur) : GRIS
        if (relief && code === vue.selection) c = melanger(c, [255, 255, 255], 0.45)
        return [code, { c, h: relief ? Math.max(e?.hauteur ?? 0, 400) : 0 }] as const
      }),
    )
    const departs = new Map([...cibles].map(([code, cible]) => [code, etats.current.get(code) ?? { c: cible.c, h: 0 }]))
    const debut = performance.now()
    let image = 0
    const boucle = (t: number) => {
      const p = Math.min(Math.max((t - debut) / DUREE_TEINTE_MS, 0), 1)
      const k = adoucir(p)
      cibles.forEach((cible, code) => {
        const d = departs.get(code)!
        const c = melanger(d.c, cible.c, k)
        const h = d.h + (cible.h - d.h) * k
        etats.current.set(code, { c, h })
        carte.setFeatureState({ source: 'departements', id: code }, { r: c[0], g: c[1], b: c[2], h })
      })
      if (p < 1) image = requestAnimationFrame(boucle)
    }
    image = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(image)
  }, [prete, contours, vue.departements, vue.relief, vue.selection])

  // --- Alertes : les départements signalés battent en rouge (fixes si « réduire les animations ») ---
  const cleAlertes = JSON.stringify(vue.alertes ?? [])
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete) return
    const codes = JSON.parse(cleAlertes) as string[]
    const filtre: ExpressionSpecification = ['in', ['get', 'GID_2'], ['literal', codes]]
    carte.setFilter('dep-alerte-aplat', filtre)
    carte.setFilter('dep-alerte-trait', filtre)
    const battre = (fort: boolean) => {
      carte.setPaintProperty('dep-alerte-aplat', 'fill-opacity', codes.length ? (fort ? 0.85 : 0.3) : 0)
      carte.setPaintProperty('dep-alerte-trait', 'line-opacity', codes.length ? (fort ? 1 : 0.6) : 0)
    }
    battre(true)
    if (!codes.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let fort = true
    const minuteur = setInterval(() => battre((fort = !fort)), BATTEMENT_MS)
    return () => clearInterval(minuteur)
  }, [prete, cleAlertes])

  // --- Arcs de répartition : ils partent du dépôt et se tracent jusqu'aux départements ---------
  const cleArcs = JSON.stringify(vue.arcs ?? [])
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete) return
    const arcs = JSON.parse(cleArcs) as Arc[]
    ;(carte.getSource('arcs') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: arcs.map((a) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: ligne(a.de, a.vers) },
        properties: { poids: a.poids, fleche: 14000 + 42000 * Math.hypot(a.vers[0] - a.de[0], a.vers[1] - a.de[1]) },
      })),
    })
    if (!arcs.length) return
    const debut = performance.now()
    let image = 0
    const boucle = (t: number) => {
      const p = Math.min(Math.max((t - debut) / 1600, 0), 1)
      carte.setPaintProperty('arcs', 'line-trim-offset', [adoucir(p), 1])
      if (p < 1) image = requestAnimationFrame(boucle)
    }
    carte.setPaintProperty('arcs', 'line-trim-offset', [0, 1])
    image = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(image)
  }, [prete, cleArcs])

  // --- Repères (position de l'agriculteur, dépôt du stock) -------------------------------------
  const cleReperes = JSON.stringify(vue.reperes ?? [])
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete) return
    const marqueurs = (JSON.parse(cleReperes) as Repere[]).map((r) =>
      new mapboxgl.Marker({ element: elementRepere(r), anchor: 'center' }).setLngLat(r.position).addTo(carte),
    )
    return () => marqueurs.forEach((m) => m.remove())
  }, [prete, cleReperes])

  // --- Satellite, pluie, vent ------------------------------------------------------------------
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !carte.getLayer('satellite')) return
    if (vue.satellite) carte.setLayoutProperty('satellite', 'visibility', 'visible')
    carte.setPaintProperty('satellite', 'raster-opacity', vue.satellite ? 1 : 0)
  }, [prete, vue.satellite])

  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete) return
    const intensite = vue.pluie ?? 0
    try {
      if (intensite <= 0) carte.setRain(null)
      else
        carte.setRain({
          density: 0.25 + 0.55 * intensite, intensity: 0.5 + 0.5 * intensite, opacity: 0.55,
          color: vue.ambiance === 'clair' ? '#5b8fbf' : '#b9cde4',
          'droplet-size': [1, 6], 'distortion-strength': 0.25, 'center-thinning': 0.3, direction: [12, 78], vignette: 0,
        })
    } catch {
      // Effet de pluie absent de cette version de Mapbox : la carte reste lisible sans lui
    }
  }, [prete, vue.pluie, vue.ambiance])

  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !vue.vent) return
    // Le vent est un décor (prévisions mondiales GFS, jeu d'exemple de Mapbox), pas une donnée du projet
    carte.addSource('vent', { type: 'raster-array', url: 'mapbox://rasterarrayexamples.gfs-winds', tileSize: 512 })
    carte.addLayer({
      id: 'vent', type: 'raster-particle', source: 'vent', 'source-layer': '10winds', slot: 'top',
      paint: {
        'raster-particle-speed-factor': 0.3, 'raster-particle-fade-opacity-factor': 0.9, 'raster-particle-reset-rate-factor': 0.4,
        'raster-particle-count': 1400, 'raster-particle-max-speed': 40,
        'raster-particle-color': ['interpolate', ['linear'], ['raster-particle-speed'], 1.5, 'rgba(45,127,193,0.35)', 8, 'rgba(45,127,193,0.75)', 20, 'rgba(27,90,142,0.95)'],
      },
    })
    return () => {
      if (!carteRef.current) return
      carte.removeLayer('vent')
      carte.removeSource('vent')
    }
  }, [prete, vue.vent])

  return <div ref={conteneur} className={className ?? 'size-full'} />
}
