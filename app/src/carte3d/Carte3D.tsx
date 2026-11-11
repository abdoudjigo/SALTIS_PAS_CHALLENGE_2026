import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl, { type CameraOptions, type ExpressionSpecification, type GeoJSONSource } from 'mapbox-gl'
import { useEffect, useRef, useState } from 'react'
import { config } from '../config'
import { NB_ZONES, type Volumes, type Zones } from './donnees'
import { COUCHE_VOLUMES, coucheNomZone, coucheTraitZone, coucheZone, styleCarte } from './style'

export type Etape = 'vol' | 'zones' | 'departements' | 'fin'

interface PropsCarte3D {
  volumes: Volumes | null
  zones: Zones | null
  /** joue la plongée depuis le globe ; sinon la carte s'ouvre directement sur le Sénégal */
  plongee: boolean
  /** change de valeur pour rejouer la plongée */
  relance: number
  /** relief incliné et volumes qui se lèvent ; sinon carte à plat, sans mouvement */
  anime: boolean
  /** département où la caméra se pose à la fin (producteur, conseiller) */
  cible: { longitude: number; latitude: number } | null
  selection: string | null
  onSelect: (code: string) => void
  onEtape: (etape: Etape) => void
}

const SENEGAL: [number, number] = [-14.5, 14.4]
const EMPRISE: [[number, number], [number, number]] = [[-17.6, 12.25], [-11.3, 16.75]]
const DUREE_VOL_MS = 7000
const PAS_ZONE_MS = 450
const DUREE_MONTEE_MS = 1800
const ZOOM_DEPARTEMENT = 8.2

const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const adoucir = (t: number) => 1 - (1 - t) ** 3

export default function Carte3D({ volumes, zones, plongee, relance, anime, cible, selection, onSelect, onEtape }: PropsCarte3D) {
  const conteneur = useRef<HTMLDivElement>(null)
  const carteRef = useRef<mapboxgl.Map | null>(null)
  const [prete, setPrete] = useState(false)
  const rappels = useRef({ onSelect, onEtape, cible })
  useEffect(() => {
    rappels.current = { onSelect, onEtape, cible }
  })

  // --- Création de la carte ---------------------------------------------------------------
  useEffect(() => {
    const el = conteneur.current
    if (!el) return
    const carte = new mapboxgl.Map({
      container: el,
      accessToken: config.mapboxToken,
      style: styleCarte(),
      center: SENEGAL,
      zoom: 2,
      attributionControl: false,
      antialias: true,
      maxPitch: 70,
      dragRotate: anime,
      pitchWithRotate: anime,
      touchPitch: anime,
    })
    carte.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    carteRef.current = carte
    carte.once('style.load', () => setPrete(true))

    let survol: string | null = null
    const marquerSurvol = (code: string | null) => {
      if (survol) carte.setFeatureState({ source: 'volumes', id: survol }, { survol: false })
      survol = code
      if (code) carte.setFeatureState({ source: 'volumes', id: code }, { survol: true })
      carte.getCanvas().style.cursor = code ? 'pointer' : ''
    }
    carte.on('mousemove', COUCHE_VOLUMES, (e) => marquerSurvol((e.features?.[0]?.properties?.code as string | undefined) ?? null))
    carte.on('mouseleave', COUCHE_VOLUMES, () => marquerSurvol(null))
    carte.on('click', COUCHE_VOLUMES, (e) => {
      const code = e.features?.[0]?.properties?.code as string | undefined
      if (code) rappels.current.onSelect(code)
    })

    const observateur = new ResizeObserver(() => carte.resize())
    observateur.observe(el)
    return () => {
      observateur.disconnect()
      carteRef.current = null
      setPrete(false)
      carte.remove()
    }
  }, [anime])

  // --- Données ----------------------------------------------------------------------------
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !volumes) return
    ;(carte.getSource('volumes') as GeoJSONSource).setData(volumes.volumes)
    ;(carte.getSource('etiquettes') as GeoJSONSource).setData(volumes.etiquettes)
  }, [prete, volumes])

  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !zones) return
    ;(carte.getSource('zones') as GeoJSONSource).setData(zones.contours)
    ;(carte.getSource('zones-noms') as GeoJSONSource).setData(zones.noms)
  }, [prete, zones])

  // --- Département choisi -----------------------------------------------------------------
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !selection || !volumes) return
    carte.setFeatureState({ source: 'volumes', id: selection }, { choisi: true })
    return () => {
      if (carteRef.current === carte) carte.setFeatureState({ source: 'volumes', id: selection }, { choisi: false })
    }
  }, [prete, selection, volumes])

  // --- Mise en scène : plongée, zones, départements ---------------------------------------
  const donneesPretes = Boolean(volumes && zones)
  useEffect(() => {
    const carte = carteRef.current
    if (!carte || !prete || !donneesPretes) return
    let annule = false
    let image = 0

    const etroit = carte.getContainer().clientWidth < 768
    const vueSenegal = (): CameraOptions => {
      const marges = etroit ? { top: 90, bottom: 190, left: 16, right: 16 } : { top: 90, bottom: 50, left: 60, right: 60 }
      const options = anime ? { padding: marges, pitch: 52, bearing: -12 } : { padding: marges }
      return carte.cameraForBounds(EMPRISE, options) ?? { center: SENEGAL, zoom: 6 }
    }
    const vueDepartement = (c: { longitude: number; latitude: number }): CameraOptions => ({
      center: [c.longitude, c.latitude], zoom: ZOOM_DEPARTEMENT, pitch: anime ? 60 : 0, bearing: anime ? -18 : 0,
    })

    const zone = (i: number, aplat: number, trait: number, nom: number) => {
      carte.setPaintProperty(coucheZone(i), 'fill-opacity', aplat)
      carte.setPaintProperty(coucheTraitZone(i), 'line-opacity', trait)
      carte.setPaintProperty(coucheNomZone(i), 'text-opacity', nom)
    }
    const hauteur = (k: number) => {
      const expression: ExpressionSpecification = ['*', ['get', 'hauteur'], k]
      carte.setPaintProperty(COUCHE_VOLUMES, 'fill-extrusion-height', expression)
    }
    const voler = (vue: CameraOptions, duree: number) =>
      new Promise<void>((resoudre) => {
        carte.once('moveend', () => resoudre())
        carte.flyTo({ ...vue, duration: duree, curve: 1.5, essential: true })
      })

    // Sans plongée (rechargement, mode léger) : tout est en place d'un coup
    const poser = () => {
      const { cible } = rappels.current
      carte.jumpTo(cible ? vueDepartement(cible) : vueSenegal())
      for (let i = 0; i < NB_ZONES; i++) zone(i, 0.1, 0.55, 0.85)
      carte.setPaintProperty(COUCHE_VOLUMES, 'fill-extrusion-opacity', 0.94)
      hauteur(1)
      carte.setMinZoom(4.6)
      rappels.current.onEtape('fin')
    }

    const jouer = async () => {
      rappels.current.onEtape('vol')
      carte.setMinZoom(0)
      for (let i = 0; i < NB_ZONES; i++) zone(i, 0, 0, 0)
      carte.setPaintProperty(COUCHE_VOLUMES, 'fill-extrusion-opacity', 0)
      hauteur(0)
      carte.jumpTo({ center: SENEGAL, zoom: 2.1, pitch: 0, bearing: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 } })
      await attendre(700)
      if (annule) return
      await voler(vueSenegal(), DUREE_VOL_MS)
      if (annule) return

      // Les 6 zones agroécologiques s'allument l'une après l'autre, avec leur nom
      rappels.current.onEtape('zones')
      for (let i = 0; i < NB_ZONES; i++) {
        zone(i, 0.42, 1, 1)
        await attendre(PAS_ZONE_MS)
        if (annule) return
      }
      await attendre(700)
      if (annule) return
      for (let i = 0; i < NB_ZONES; i++) zone(i, 0.1, 0.55, 0.85)

      // Les 45 départements se lèvent : hauteur = pluie de la saison, couleur = risque
      rappels.current.onEtape('departements')
      carte.setPaintProperty(COUCHE_VOLUMES, 'fill-extrusion-opacity', 0.94)
      await new Promise<void>((resoudre) => {
        const debut = performance.now()
        const monter = (t: number) => {
          const p = Math.min((t - debut) / DUREE_MONTEE_MS, 1)
          hauteur(adoucir(p))
          if (p < 1 && !annule) image = requestAnimationFrame(monter)
          else resoudre()
        }
        image = requestAnimationFrame(monter)
      })
      if (annule) return
      await attendre(900)
      if (annule) return

      const { cible } = rappels.current
      if (cible) await voler(vueDepartement(cible), 2600)
      if (annule) return
      carte.setMinZoom(4.6)
      rappels.current.onEtape('fin')
    }

    if (anime && (plongee || relance > 0)) void jouer()
    else poser()

    return () => {
      annule = true
      cancelAnimationFrame(image)
      carte.stop()
    }
  }, [prete, donneesPretes, plongee, relance, anime])

  return <div ref={conteneur} className="size-full" />
}
