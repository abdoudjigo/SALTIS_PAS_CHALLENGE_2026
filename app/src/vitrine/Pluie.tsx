import { useEffect, useRef } from 'react'
import { pointeur } from './pointeur'

interface Goutte { x: number; y: number; longueur: number; vitesse: number; opacite: number; profondeur: number }
interface Impact { x: number; y: number; age: number }

const DELAI_MS = 1800
const MONTEE_MS = 2600
const RAYON_ECART = 130
const DUREE_IMPACT_S = 0.45

/**
 * Pluie fine qui tombe jusqu'au sol. `intensite` (0 à 1 et plus) règle la densité :
 * elle servira aussi d'état d'attente (la pluie s'intensifie au lieu d'un rond qui tourne).
 */
export function Pluie({ intensite = 1, hauteurSol }: { intensite?: number; hauteurSol: number }) {
  const toile = useRef<HTMLCanvasElement>(null)
  const reglages = useRef({ intensite, hauteurSol })
  useEffect(() => {
    reglages.current = { intensite, hauteurSol }
  })

  useEffect(() => {
    const el = toile.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return

    let largeur = 0
    let hauteur = 0
    let gouttes: Goutte[] = []
    const impacts: Impact[] = []

    const nouvelle = (partout: boolean): Goutte => ({
      x: Math.random() * (largeur + 120) - 60,
      y: partout ? Math.random() * hauteur : -20 - Math.random() * 80,
      longueur: 9 + Math.random() * 15,
      vitesse: 520 + Math.random() * 380,
      opacite: 0.16 + Math.random() * 0.3,
      // le champ est vu en perspective : chaque goutte touche le sol plus ou moins loin
      profondeur: 0.12 + Math.random() * 0.6,
    })

    const dimensionner = () => {
      const densite = Math.min(window.devicePixelRatio || 1, 1.5)
      largeur = el.clientWidth
      hauteur = el.clientHeight
      el.width = Math.round(largeur * densite)
      el.height = Math.round(hauteur * densite)
      ctx.setTransform(densite, 0, 0, densite, 0, 0)
      const nombre = Math.round(Math.max(24, Math.min(90, (largeur * hauteur) / 16000)) * (largeur < 640 ? 0.55 : 1))
      gouttes = Array.from({ length: nombre }, () => nouvelle(true))
    }
    dimensionner()
    const observateur = new ResizeObserver(dimensionner)
    observateur.observe(el)

    const debut = performance.now()
    let precedent = debut
    let image = 0

    const boucle = (t: number) => {
      image = requestAnimationFrame(boucle)
      const dt = Math.min(t - precedent, 50) / 1000
      precedent = t
      const montee = Math.max(0, Math.min(1, (t - debut - DELAI_MS) / MONTEE_MS))
      const actives = Math.round(gouttes.length * Math.min(montee * reglages.current.intensite, 1.6))

      ctx.clearRect(0, 0, largeur, hauteur)
      ctx.lineCap = 'round'
      ctx.lineWidth = 1.1

      for (let i = 0; i < Math.min(actives, gouttes.length); i++) {
        const g = gouttes[i]
        g.y += g.vitesse * dt
        g.x -= g.vitesse * dt * 0.14

        // Les gouttes s'écartent un peu du pointeur
        const dx = g.x - pointeur.px
        const dy = g.y - pointeur.py
        const distance = Math.hypot(dx, dy)
        if (distance < RAYON_ECART) g.x += (dx / (distance || 1)) * (RAYON_ECART - distance) * 6 * dt

        const sol = hauteur - reglages.current.hauteurSol * g.profondeur
        if (g.y > sol) {
          if (impacts.length < 30) impacts.push({ x: g.x, y: sol, age: 0 })
          Object.assign(g, nouvelle(false))
          continue
        }
        ctx.strokeStyle = `rgba(170,208,240,${g.opacite})`
        ctx.beginPath()
        ctx.moveTo(g.x, g.y)
        ctx.lineTo(g.x + g.longueur * 0.14, g.y - g.longueur)
        ctx.stroke()
      }

      for (let i = impacts.length - 1; i >= 0; i--) {
        const p = impacts[i]
        p.age += dt
        const k = p.age / DUREE_IMPACT_S
        if (k >= 1) {
          impacts.splice(i, 1)
          continue
        }
        ctx.strokeStyle = `rgba(190,220,245,${0.4 * (1 - k)})`
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, 2 + k * 9, 0.8 + k * 2.2, 0, Math.PI, Math.PI * 2)
        ctx.stroke()
      }
    }
    image = requestAnimationFrame(boucle)

    return () => {
      cancelAnimationFrame(image)
      observateur.disconnect()
    }
  }, [])

  return <canvas ref={toile} className="pointer-events-none absolute inset-0 size-full" aria-hidden />
}
