// Préchargement léger (agriculteur) : une fois la fonctionnalité ouverte servie, on demande en arrière-plan ce que
// les autres fonctionnalités liront pour le même département et la même année. Changer de fonctionnalité ne
// lance alors plus de requête : la réponse s'affiche d'emblée. Les données déjà en cache ne sont pas redemandées.
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { optionsBesoins, optionsChoix, optionsOpportunite, optionsOpportunites } from './donnees'
import { optionsCarteSemis, optionsPrevisionRendement, optionsPrevisionSaison, optionsRisqueSemis } from './previsions'

/** Laisse passer les requêtes de l'écran ouvert, et les clics rapides d'un département à l'autre. */
const DELAI_MS = 900

export function usePrechargerDepartement(code: string | null, annee: number | undefined, culture: string | null, actif: boolean) {
  const client = useQueryClient()
  useEffect(() => {
    if (!actif || !code || !annee) return
    const minuteur = window.setTimeout(() => {
      void client.prefetchQuery(optionsChoix(code))
      void client.prefetchQuery(optionsBesoins({ code_departement: code }))
      void client.prefetchQuery(optionsOpportunite(code))
      void client.prefetchQuery(optionsOpportunites())
      void client.prefetchQuery(optionsPrevisionSaison(annee))
      void client.prefetchQuery(optionsPrevisionRendement(code, annee))
      void client.prefetchQuery(optionsRisqueSemis(code, annee))
      // « Quand semer ? » colore la carte pour la culture choisie (l'arachide par défaut)
      void client.prefetchQuery(optionsCarteSemis(culture ?? 'ARACHIDE', annee))
    }, DELAI_MS)
    return () => clearTimeout(minuteur)
  }, [client, code, annee, culture, actif])
}
