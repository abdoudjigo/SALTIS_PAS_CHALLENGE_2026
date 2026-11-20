// Consentement aux cookies et traceurs non indispensables (mesure d'audience).
// Le choix est gardé dans le navigateur, 6 mois ; sans choix, rien de facultatif n'est chargé.
// Le stockage indispensable (profil choisi, saisies) ne dépend pas de ce consentement.
import { useSyncExternalStore } from 'react'
import { config } from '../config'

const CLE = 'assaman.consentement'
/** À augmenter quand la liste des traceurs change : le bandeau est alors reproposé. */
const VERSION = 2 // 2 : Umami (17/11/2026)
const DUREE_MS = 1000 * 60 * 60 * 24 * 183

export type Consentement = { audience: boolean; version: number; date: number }
type Etat = { choix: Consentement | null; ouvert: boolean }

function lire(): Consentement | null {
  try {
    const c = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Consentement | null
    if (!c || c.version !== VERSION || typeof c.audience !== 'boolean' || Date.now() - c.date > DUREE_MS) return null
    return c
  } catch {
    return null
  }
}

const choixInitial = lire()
// Sans outil de mesure configuré, rien de facultatif à accepter : pas de bandeau
let etat: Etat = { choix: choixInitial, ouvert: choixInitial === null && Boolean(config.umamiId) }
const abonnes = new Set<() => void>()

function publier(suivant: Etat) {
  etat = suivant
  abonnes.forEach((f) => f())
}

export const consentement = {
  get: (): Etat => etat,
  /** Vrai seulement après un accord explicite pour la mesure d'audience. */
  audienceAcceptee: (): boolean => etat.choix?.audience === true,
  choisir(audience: boolean) {
    const choix: Consentement = { audience, version: VERSION, date: Date.now() }
    try {
      localStorage.setItem(CLE, JSON.stringify(choix))
    } catch {
      /* navigation privée : le choix vaut pour la visite en cours */
    }
    publier({ choix, ouvert: false })
  },
  /** Rouvre le bandeau pour changer d'avis (lien « Gérer les cookies » du pied de page). */
  rouvrir() {
    publier({ ...etat, ouvert: true })
  },
  subscribe(f: () => void) {
    abonnes.add(f)
    return () => {
      abonnes.delete(f)
    }
  },
}

export function useConsentement(): Etat {
  return useSyncExternalStore(consentement.subscribe, consentement.get)
}
