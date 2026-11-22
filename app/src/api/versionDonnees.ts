// Version des données servies par l'API (en-tête X-Data-Version, ex. v20261119T110626542Z), notée à chaque réponse.
// Affichée sous les résultats : on voit tout de suite si les chiffres datent (audit, constat ARC-03).
// Une réponse servie par le cache hors ligne garde son en-tête : la date reste vraie.
import { useSyncExternalStore } from 'react'

let version: string | null = null
const abonnes = new Set<() => void>()

export function noterVersion(v: string | null) {
  if (!v || v === version) return
  version = v
  abonnes.forEach((f) => f())
}

/** Date de la version (« v20261119T110626542Z » → 19/11/2026), ou null si le format est inconnu. */
export function dateVersion(v: string): Date | null {
  const m = /^v(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(v)
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : null
}

export function useVersionDonnees(): string | null {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => version,
    () => null,
  )
}
