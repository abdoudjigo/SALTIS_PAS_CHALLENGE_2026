import clsx from 'clsx'
import { Info, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { STATUTS_DOSE, type Ton } from '../../lib/format'
import type { NiveauAdequation, RisqueSaison, StatutDose as TypeStatutDose } from '../../types/marts'

interface PropsPanneau {
  titre?: ReactNode
  sousTitre?: ReactNode
  action?: ReactNode
  className?: string
  corpsClassName?: string
  children: ReactNode
}

export function Panneau({ titre, sousTitre, action, className, children, corpsClassName }: PropsPanneau) {
  return (
    <section className={clsx('carte animate-apparition', className)}>
      {(titre || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-trait px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {titre && <h2 className="font-semibold leading-tight">{titre}</h2>}
            {sousTitre && <p className="mt-0.5 text-xs text-encre-douce">{sousTitre}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={clsx('p-4 sm:p-5', corpsClassName)}>{children}</div>
    </section>
  )
}

const TONS: Record<Ton, string> = {
  vert: 'bg-vert-50 text-vert-700 ring-vert-100',
  soleil: 'bg-soleil-100 text-terre-700 ring-soleil-500/30',
  terre: 'bg-terre-100 text-terre-700 ring-terre-500/20',
  pluie: 'bg-pluie-100 text-pluie-700 ring-pluie-500/20',
  alerte: 'bg-alerte-100 text-alerte-700 ring-alerte-500/20',
  gris: 'bg-stone-100 text-stone-600 ring-stone-200',
}

export function Badge({ ton = 'gris', children, title, className }: { ton?: Ton; children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONS[ton], className)}>
      {children}
    </span>
  )
}

export function StatutDose({ statut }: { statut: TypeStatutDose | null }) {
  const s = STATUTS_DOSE[statut ?? 'A_COMPLETER']
  return <Badge ton={s.ton} title={s.aide}>{s.texte}</Badge>
}

const TON_RISQUE: Record<RisqueSaison, Ton> = { normal: 'vert', sécheresse: 'alerte', 'excès de pluie': 'pluie', 'sécheresse et excès de pluie': 'soleil' }
export const BadgeRisque = ({ risque }: { risque: RisqueSaison | null }) => <Badge ton={risque ? TON_RISQUE[risque] : 'gris'}>{risque ?? '—'}</Badge>

const TON_ADEQUATION: Record<NiveauAdequation, Ton> = {
  adaptée: 'vert', 'à risque': 'soleil', déconseillée: 'alerte', 'irrigation requise': 'pluie',
  'non évaluée (culture pluriannuelle)': 'gris',
}
export const BadgeAdequation = ({ niveau }: { niveau: NiveauAdequation | null | undefined }) =>
  <Badge ton={niveau ? TON_ADEQUATION[niveau] : 'gris'}>{niveau ?? '—'}</Badge>

interface PropsIndicateur {
  libelle: ReactNode
  valeur: ReactNode
  detail?: ReactNode
  ton?: 'alerte' | 'vert' | 'pluie'
  icone?: LucideIcon
}

export function Indicateur({ libelle, valeur, detail, ton, icone: Icone }: PropsIndicateur) {
  return (
    <div className="carte flex flex-col gap-1 p-4 animate-apparition">
      <div className="flex items-center gap-2 text-xs font-medium text-encre-douce">
        {Icone && <Icone className="size-4" aria-hidden />}
        {libelle}
      </div>
      <div className={clsx('text-2xl font-semibold tracking-tight', ton === 'alerte' && 'text-alerte-700', ton === 'vert' && 'text-vert-700', ton === 'pluie' && 'text-pluie-700')}>
        {valeur}
      </div>
      {detail && <div className="text-xs text-encre-douce">{detail}</div>}
    </div>
  )
}

export function Squelette({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-stone-200/70', className)} aria-hidden />
}

export function SqueletteEcran() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement">
      <Squelette className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Squelette key={i} className="h-24" />)}
      </div>
      <Squelette className="h-80" />
    </div>
  )
}

interface PropsSegment<T extends string> {
  options: { valeur: T; libelle: string }[]
  valeur: T
  onChange: (v: T) => void
  libelle: string
  className?: string
}

/** Choix exclusif compact (remplace un groupe de boutons radio) */
export function Segment<T extends string>({ options, valeur, onChange, libelle, className }: PropsSegment<T>) {
  return (
    <div role="radiogroup" aria-label={libelle} className={clsx('inline-flex rounded-xl bg-stone-100 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.valeur}
          type="button"
          role="radio"
          aria-checked={valeur === o.valeur}
          onClick={() => onChange(o.valeur)}
          className={clsx(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition',
            valeur === o.valeur ? 'bg-white text-encre shadow-sm' : 'text-encre-douce hover:text-encre',
          )}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  )
}

export function Note({ children, ton = 'pluie' }: { children: ReactNode; ton?: 'pluie' | 'soleil' }) {
  return (
    <div className={clsx('flex gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed', ton === 'pluie' ? 'bg-pluie-100/60 text-pluie-700' : 'bg-soleil-100 text-terre-700')}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}

export function EnTetePage({ titre, description, actions }: { titre: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{titre}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-encre-douce">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
    </div>
  )
}
