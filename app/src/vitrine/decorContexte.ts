import { useOutletContext } from 'react-router'

export interface ContexteDecor {
  /** 1 = pluie fine ; au-delà, la pluie s'intensifie (attente d'une réponse, réussite) */
  reglerPluie: (intensite: number) => void
}

/** Accès au décor depuis une page de la vitrine (connexion, inscription). */
export const useDecor = () => useOutletContext<ContexteDecor>()
