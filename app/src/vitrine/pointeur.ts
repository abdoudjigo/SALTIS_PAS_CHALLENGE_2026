// Position du pointeur (ou inclinaison du téléphone), partagée par le globe et la pluie.
// x et y vont de -1 à 1 ; px et py sont en pixels (hors écran tant que rien n'a bougé).
import { useEffect } from 'react'

export const pointeur = { x: 0, y: 0, px: -9999, py: -9999 }

const borner = (v: number) => Math.max(-1, Math.min(1, v))

export function usePointeur(actif: boolean) {
  useEffect(() => {
    if (!actif) return

    const surPointeur = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      pointeur.px = e.clientX
      pointeur.py = e.clientY
      pointeur.x = borner((e.clientX / window.innerWidth) * 2 - 1)
      pointeur.y = borner((e.clientY / window.innerHeight) * 2 - 1)
    }
    const surInclinaison = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return
      pointeur.x = borner(e.gamma / 30)
      pointeur.y = borner((e.beta - 45) / 30)
    }

    window.addEventListener('pointermove', surPointeur, { passive: true })
    window.addEventListener('deviceorientation', surInclinaison, { passive: true })
    return () => {
      window.removeEventListener('pointermove', surPointeur)
      window.removeEventListener('deviceorientation', surInclinaison)
    }
  }, [actif])
}
