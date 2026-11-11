import { useEffect, type ReactNode } from 'react'
import { EnTetePublic } from './EnTetePublic'
import { PiedDePage } from './PiedDePage'

interface PropsPagePublique {
  surtitre: string
  titre: string
  chapeau: ReactNode
  children: ReactNode
}

/** Gabarit des pages de base (à propos, contact, formations, confidentialité, mentions). */
export function PagePublique({ surtitre, titre, chapeau, children }: PropsPagePublique) {
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = `${titre} · Assaman & Suuf`
    return () => {
      document.title = 'Assaman & Suuf'
    }
  }, [titre])

  return (
    <div className="vitrine min-h-svh bg-nuit-900 text-white">
      <div className="relative overflow-hidden px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10 lg:px-[6vw]">
        <div className="decor-etoiles absolute inset-0" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-nuit-900 to-transparent" aria-hidden />
        <EnTetePublic className="relative" />
        <div className="relative max-w-3xl pt-16 pb-14 lg:pt-24 lg:pb-20">
          <p className="vitrine-entree text-xs font-medium tracking-[0.22em] text-brume uppercase">{surtitre}</p>
          <h1 className="vitrine-entree mt-4 font-titre text-[clamp(2.1rem,6vw,3.75rem)] leading-[1.06] font-medium tracking-tight text-balance" style={{ animationDelay: '0.1s' }}>
            {titre}
          </h1>
          <p className="vitrine-entree mt-5 max-w-2xl text-lg leading-relaxed text-white/75" style={{ animationDelay: '0.2s' }}>{chapeau}</p>
        </div>
      </div>
      <main className="px-5 pb-24 sm:px-10 lg:px-[6vw]">{children}</main>
      <PiedDePage />
    </div>
  )
}

/** Bloc de texte titré, pour les pages longues. */
export function Rubrique({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-12 gap-y-3 border-t border-white/10 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <h2 className="font-titre text-2xl leading-tight font-medium">{titre}</h2>
      <div className="max-w-2xl space-y-4 leading-relaxed text-white/75">{children}</div>
    </section>
  )
}
