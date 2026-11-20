// Titre et balises meta de la page affichée, mises à jour à chaque changement de page. Les valeurs viennent de
// src/lib/pages.ts, qui sert aussi au pré-rendu : un robot qui n'exécute pas JavaScript (aperçus de partage)
// reçoit déjà les bonnes balises dans le HTML de chaque adresse.
import { useEffect } from 'react'
import { ACCUEIL, NOM_SITE } from './pages'

export { ACCUEIL, NOM_SITE }

function balise(selecteur: string, creer: () => HTMLElement): HTMLElement {
  let e = document.head.querySelector<HTMLElement>(selecteur)
  if (!e) {
    e = creer()
    document.head.appendChild(e)
  }
  return e
}

function meta(attribut: 'name' | 'property', cle: string, contenu: string) {
  balise(`meta[${attribut}="${cle}"]`, () => {
    const m = document.createElement('meta')
    m.setAttribute(attribut, cle)
    return m
  }).setAttribute('content', contenu)
}

type Meta = {
  /** Titre complet de l'onglet. Sans lui : `titrePage · Assaman & Suuf` */
  titre?: string
  titrePage?: string
  description: string
  /** false : la page n'est pas proposée aux moteurs de recherche (page introuvable) */
  indexable?: boolean
}

export function useMeta({ titre, titrePage, description, indexable = true }: Meta) {
  useEffect(() => {
    const complet = titre ?? (titrePage ? `${titrePage} · ${NOM_SITE}` : ACCUEIL.titre)
    const url = `${location.origin}${location.pathname}`
    document.title = complet
    meta('name', 'description', description)
    meta('name', 'robots', indexable ? 'index, follow' : 'noindex, follow')
    meta('property', 'og:title', complet)
    meta('property', 'og:description', description)
    meta('property', 'og:url', url)
    meta('name', 'twitter:title', complet)
    meta('name', 'twitter:description', description)
    const canonique = document.head.querySelector('link[rel="canonical"]')
    if (indexable) {
      balise('link[rel="canonical"]', () => {
        const l = document.createElement('link')
        l.setAttribute('rel', 'canonical')
        return l
      }).setAttribute('href', url)
    } else canonique?.remove()
  }, [titre, titrePage, description, indexable])
}
