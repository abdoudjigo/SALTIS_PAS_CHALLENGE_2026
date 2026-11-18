// Préchargement léger (agriculteur) : une fois la fonctionnalité ouverte servie, on demande en arrière-plan ce que
// les autres fonctionnalités liront pour le même département et la même année. Changer de fonctionnalité ne
// lance alors plus de requête : la réponse s'affiche d'emblée. Les données déjà en cache ne sont pas redemandées.
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { optionsBesoins, optionsChoix, optionsOpportunite, optionsOpportunites } from './donnees'
import { anneeCouverte } from '../types/previsions'
import { optionsCarteSemis, optionsAlerteRecolte, optionsPrevisionSaison, optionsRisqueSemis } from './previsions'

/** Laisse passer les requêtes de l'écran ouvert, et les clics rapides d'un département à l'autre. */
const DELAI_MS = 900

export function usePrechargerDepartement(code: string | null, annee: number | undefined, culture: string | null, actif: boolean, campagnes: number[] | undefined) {
  const client = useQueryClient()
  // Chaque modèle ne couvre que ses années (anneeCouverte) : hors de ses années, pas de requête (pas de 404)
  const couvert = (modele: 'M1' | 'M3' | 'M4') => annee !== undefined && campagnes !== undefined && anneeCouverte(campagnes, modele, annee)
  const [saisonCouverte, rendementCouvert, semisCouvert] = [couvert('M1'), couvert('M3'), couvert('M4')]
  useEffect(() => {
    if (!actif || !code || !annee) return
    const minuteur = window.setTimeout(() => {
      void client.prefetchQuery(optionsChoix(code))
      void client.prefetchQuery(optionsBesoins({ code_departement: code }))
      void client.prefetchQuery(optionsOpportunite(code))
      void client.prefetchQuery(optionsOpportunites())
      if (saisonCouverte) void client.prefetchQuery(optionsPrevisionSaison(annee))
      if (rendementCouvert) void client.prefetchQuery(optionsAlerteRecolte(annee, 'FIN_MAI'))
      if (semisCouvert) {
        void client.prefetchQuery(optionsRisqueSemis(code, annee))
        // « Quand semer ? » colore la carte pour la culture choisie (l'arachide par défaut)
        void client.prefetchQuery(optionsCarteSemis(culture ?? 'ARACHIDE', annee))
      }
    }, DELAI_MS)
    return () => clearTimeout(minuteur)
  }, [client, code, annee, culture, actif, saisonCouverte, rendementCouvert, semisCouvert])
}
