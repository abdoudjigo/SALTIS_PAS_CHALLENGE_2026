// Mode de rendu du décor : « vitrine » (tout animé) ou « léger » (calme, voire sans globe).
// Le mode léger s'active seul : appareil faible, connexion lente ou « réduire les animations ».
import { useMemo, useSyncExternalStore } from 'react'
import { config } from '../config'

export interface ModeRendu {
  /** globe en mouvement, vent, pluie, champ qui s'éveille */
  animations: boolean
  /** globe Mapbox affiché (sinon un ciel étoilé simple) */
  globe: boolean
}

interface NavigateurEtendu extends Navigator {
  connection?: { saveData?: boolean; effectiveType?: string }
  deviceMemory?: number
}

const REQUETE_CALME = '(prefers-reduced-motion: reduce)'

function abonnerCalme(f: () => void) {
  const mq = window.matchMedia(REQUETE_CALME)
  mq.addEventListener('change', f)
  return () => mq.removeEventListener('change', f)
}

/** Vrai si le navigateur sait créer un contexte WebGL 2 (Mapbox GL en a besoin). */
export function webglDisponible() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch {
    return false
  }
}

export function useModeRendu(): ModeRendu {
  const calme = useSyncExternalStore(abonnerCalme, () => window.matchMedia(REQUETE_CALME).matches)

  return useMemo(() => {
    const nav = navigator as NavigateurEtendu
    // « 3g » est une estimation instable du navigateur, fréquente sur une connexion moyenne : on garde le globe
    const connexionLente = Boolean(nav.connection?.saveData) || ['slow-2g', '2g'].includes(nav.connection?.effectiveType ?? '')
    const appareilFaible = (nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2
    return {
      animations: !calme && !connexionLente && !appareilFaible,
      globe: Boolean(config.mapboxToken) && !connexionLente && webglDisponible(),
    }
  }, [calme])
}
