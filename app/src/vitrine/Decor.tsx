import clsx from 'clsx'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Scene } from './Globe'
import { useModeRendu } from './modeRendu'
import { Pluie } from './Pluie'
import { usePointeur } from './pointeur'

const Globe = lazy(() => import('./Globe'))

/**
 * Décor « ciel et terre » : nuit étoilée, globe, pluie et champ d'arachide de Kaolack (photo).
 * Il reste en place derrière la landing puis derrière la connexion et l'inscription.
 */
export function Decor({ scene, intensitePluie = 1 }: { scene: Scene; intensitePluie?: number }) {
  const mode = useModeRendu()
  const sol = useRef<HTMLImageElement>(null)
  const [hauteurSol, setHauteurSol] = useState(160)
  const [globePret, setGlobePret] = useState(false)
  usePointeur(mode.animations)

  useEffect(() => {
    const el = sol.current
    if (!el) return
    const observateur = new ResizeObserver(() => setHauteurSol(el.clientHeight))
    observateur.observe(el)
    return () => observateur.disconnect()
  }, [])

  return (
    <div className="decor fixed inset-0 overflow-hidden bg-nuit-900">
      <div className="decor-etoiles absolute inset-0" aria-hidden />
      {mode.globe ? (
        <div className={clsx('absolute inset-0 transition-opacity duration-[1400ms]', globePret ? 'opacity-100' : 'opacity-0')}>
          <Suspense fallback={null}>
            <Globe anime={mode.animations} scene={scene} onPret={() => setGlobePret(true)} />
          </Suspense>
        </div>
      ) : (
        <div className="decor-astre absolute" aria-hidden />
      )}
      <div className={clsx('absolute inset-0', scene === 'accueil' ? 'decor-voile' : 'decor-voile-formulaire')} />
      {mode.animations && <Pluie intensite={intensitePluie} hauteurSol={hauteurSol} />}
      <picture>
        <source media="(max-width: 767px)" srcSet="/decor/champ-arachide-kaolack-1280.webp" />
        <img
          ref={sol}
          src="/decor/champ-arachide-kaolack.webp"
          alt=""
          decoding="async"
          className={clsx('decor-sol absolute inset-x-0 bottom-0 w-full object-cover object-bottom', mode.animations && 'decor-sol-eveil')}
        />
      </picture>
    </div>
  )
}
