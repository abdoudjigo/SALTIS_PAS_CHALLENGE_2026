import { useCallback, useState } from 'react'
import { useDecor } from './decorContexte'

export type Phase = 'saisie' | 'envoi' | 'sortie'

const DUREE_DISSOLUTION_MS = 700
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Mise en scène d'un envoi de formulaire : pendant l'attente la pluie s'intensifie (pas de rond qui tourne),
 * puis, en cas de réussite, le formulaire se dissout avant qu'on entre dans l'application.
 */
export function useEnvoiFormulaire() {
  const { reglerPluie } = useDecor()
  const [phase, setPhase] = useState<Phase>('saisie')
  const [erreur, setErreur] = useState<string | null>(null)

  const envoyer = useCallback(async (action: () => Promise<unknown>, ensuite: () => void, messageParDefaut: string) => {
    setErreur(null)
    setPhase('envoi')
    reglerPluie(1.6)
    try {
      await action()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : messageParDefaut)
      setPhase('saisie')
      reglerPluie(1)
      return
    }
    setPhase('sortie')
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) await pause(DUREE_DISSOLUTION_MS)
    reglerPluie(1)
    ensuite()
  }, [reglerPluie])

  return { phase, erreur, setErreur, envoyer }
}
