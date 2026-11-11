import clsx from 'clsx'
import type { ReactNode } from 'react'
import { EnTetePublic } from './EnTetePublic'

interface PropsCadre {
  titre: string
  chapeau: ReactNode
  /** vrai après une réussite : le formulaire se dissout avant d'entrer dans l'application */
  dissolution: boolean
  children: ReactNode
}

/** Formulaire en verre dépoli posé sur le décor : à droite sur grand écran, sous le globe sur téléphone. */
export function CadreFormulaire({ titre, chapeau, dissolution, children }: PropsCadre) {
  return (
    <main className="pointer-events-none relative flex min-h-svh flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10 lg:px-[6vw]">
      <EnTetePublic className="pointer-events-auto" />
      <div className="flex flex-1 items-start pt-[24svh] pb-[calc(var(--sol)*0.55)] md:items-center md:justify-end md:pt-8">
        <section
          className={clsx(
            'verre pointer-events-auto w-full rounded-3xl p-5 sm:p-8 md:max-w-[27rem]',
            dissolution ? 'vitrine-dissolution' : 'vitrine-entree',
          )}
        >
          <h1 className="font-titre text-3xl leading-tight font-medium tracking-tight">{titre}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/65">{chapeau}</p>
          {children}
        </section>
      </div>
    </main>
  )
}

export const BOUTON_FORMULAIRE =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-soleil-500 px-5 text-[15px] font-semibold text-nuit-900 transition hover:bg-soleil-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45'

export function MessageErreur({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-alerte-500/40 bg-alerte-500/15 px-3.5 py-2.5 text-sm text-[#ffd0c6]">
      {children}
    </p>
  )
}
