// État du réseau et des données, en tête de la fenêtre de résultats, pour tous les écrans (audit, constat FE-03).
// Sans lui, une coupure ressemblait à « non disponible » : l'utilisateur croyait que la donnée n'existait pas.
// - hors ligne : on le dit, et on rappelle que les données déjà consultées restent affichées (cache, FE-01) ;
// - une requête de la page en échec (réseau, serveur) : on le dit, avec « Réessayer ».
// Une absence de donnée (404, paramètre refusé) n'est pas une panne : l'écran l'explique lui-même.
import { useQueryClient, type Query } from '@tanstack/react-query'
import { CloudOff, RefreshCw } from 'lucide-react'
import { useCallback, useSyncExternalStore } from 'react'
import { ApiError } from '../../api/client'

const definitive = (e: unknown) => e instanceof ApiError && [401, 403, 404, 422].includes(e.status)
const enPanne = (q: Query) => q.state.status === 'error' && q.getObserversCount() > 0 && !definitive(q.state.error)

const ecouterReseau = (f: () => void) => {
  window.addEventListener('online', f)
  window.addEventListener('offline', f)
  return () => {
    window.removeEventListener('online', f)
    window.removeEventListener('offline', f)
  }
}

export function EtatReseau() {
  const client = useQueryClient()
  const enLigne = useSyncExternalStore(ecouterReseau, () => navigator.onLine, () => true)
  const cache = client.getQueryCache()
  const souscrire = useCallback((f: () => void) => cache.subscribe(f), [cache])
  const nbPannes = useSyncExternalStore(souscrire, () => cache.getAll().filter(enPanne).length, () => 0)

  if (enLigne && nbPannes === 0) return null
  const reessayer = () => void client.refetchQueries({ predicate: enPanne })

  return (
    <div role={enLigne ? 'alert' : 'status'} className="mt-2 flex items-start gap-3 rounded-lg border border-soleil-500/40 bg-soleil-500/10 px-3 py-2.5">
      <CloudOff className="mt-0.5 size-4 shrink-0 text-soleil-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{enLigne ? 'Le serveur ne répond pas' : 'Vous êtes hors ligne'}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/70">
          {enLigne
            ? 'Certaines données n’ont pas pu être chargées : ce n’est pas qu’elles manquent.'
            : 'Les données déjà consultées restent affichées. Le reste reviendra avec le réseau.'}
        </p>
      </div>
      {(enLigne || nbPannes > 0) && (
        <button type="button" onClick={reessayer} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-white underline-offset-4 hover:underline">
          <RefreshCw className="size-3.5" aria-hidden />Réessayer
        </button>
      )}
    </div>
  )
}
