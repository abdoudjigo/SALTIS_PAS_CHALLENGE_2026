import { AlertTriangle, Inbox, RotateCw, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PropsEtatVide {
  icone?: LucideIcon
  titre: ReactNode
  texte?: ReactNode
  action?: ReactNode
}

export function EtatVide({ icone: Icone = Inbox, titre, texte, action }: PropsEtatVide) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center animate-apparition">
      <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-vert-50 text-vert-700">
        <Icone className="size-6" aria-hidden />
      </div>
      <p className="font-semibold">{titre}</p>
      {texte && <p className="max-w-md text-sm text-encre-douce">{texte}</p>}
      {action}
    </div>
  )
}

export function Erreur({ erreur, reessayer }: { erreur: Error | null; reessayer?: () => void }) {
  return (
    <EtatVide
      icone={AlertTriangle}
      titre="Impossible de charger les données"
      texte={erreur?.message}
      action={
        reessayer && (
          <button onClick={reessayer} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-vert-700 px-4 py-2 text-sm font-medium text-white hover:bg-vert-900">
            <RotateCw className="size-4" /> Réessayer
          </button>
        )
      }
    />
  )
}
