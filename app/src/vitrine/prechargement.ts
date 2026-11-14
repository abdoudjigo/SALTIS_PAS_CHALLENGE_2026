import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '../api'

/** Pendant la saisie d'un formulaire, on précharge en silence ce que l'écran suivant demandera. */
export function usePrechargementAccueil() {
  const queryClient = useQueryClient()
  useEffect(() => {
    void queryClient.prefetchQuery({ queryKey: ['referentiels'], queryFn: api.referentiels, staleTime: Infinity })
    void import('../pages/Territoires')
    void import('../carte3d/Carte3D')
  }, [queryClient])
}
