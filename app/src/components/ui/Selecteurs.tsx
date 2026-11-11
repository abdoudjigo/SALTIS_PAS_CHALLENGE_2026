import { ChevronDown, MapPin, type LucideIcon } from 'lucide-react'
import { useMemo, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useReferentiels } from '../../hooks/donnees'
import { useTerritoire } from '../../hooks/territoire'
import { libelle } from '../../lib/format'
import type { Departement } from '../../types/marts'

type PropsSelect = SelectHTMLAttributes<HTMLSelectElement> & { icone?: LucideIcon; children: ReactNode }

export function SelectNatif({ icone: Icone, className = '', children, ...props }: PropsSelect) {
  return (
    <div className={`relative ${className}`}>
      {Icone && <Icone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-encre-douce" aria-hidden />}
      <select {...props} className={`champ appearance-none pr-9 ${Icone ? 'pl-9' : ''}`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-encre-douce" aria-hidden />
    </div>
  )
}

/** Sélecteur natif groupé par région : rapide et accessible, y compris sur mobile. */
export function SelecteurDepartement({ className }: { className?: string }) {
  const { data: ref } = useReferentiels()
  const { code, choisir } = useTerritoire()
  const groupes = useMemo(() => {
    const m = new Map<string, Departement[]>()
    ;(ref?.departements ?? []).forEach((d) => m.set(d.region, [...(m.get(d.region) ?? []), d]))
    return [...m.entries()]
  }, [ref])

  return (
    <SelectNatif icone={MapPin} aria-label="Département" value={code ?? ''} onChange={(e) => choisir(e.target.value)} className={className ?? 'w-full sm:w-64'}>
      {groupes.map(([region, deps]) => (
        <optgroup key={region} label={`Région de ${region}`}>
          {deps.map((d) => <option key={d.code_departement} value={d.code_departement}>{d.departement}</option>)}
        </optgroup>
      ))}
    </SelectNatif>
  )
}

interface PropsAnnee {
  valeur: number | undefined
  onChange: (annee: number) => void
  annees: number[] | undefined
  libelleAria?: string
}

export function SelecteurAnnee({ valeur, onChange, annees, libelleAria = 'Campagne' }: PropsAnnee) {
  return (
    <SelectNatif aria-label={libelleAria} value={valeur ?? ''} onChange={(e) => onChange(Number(e.target.value))} className="w-32">
      {[...(annees ?? [])].reverse().map((a) => <option key={a} value={a}>{a}</option>)}
    </SelectNatif>
  )
}

interface PropsCulture {
  valeur: string | null
  onChange: (culture: string | null) => void
  cultures: string[] | undefined
  tous?: string
}

export function SelecteurCulture({ valeur, onChange, cultures, tous = 'Toutes les cultures' }: PropsCulture) {
  return (
    <SelectNatif aria-label="Culture" value={valeur ?? ''} onChange={(e) => onChange(e.target.value || null)} className="w-full sm:w-56">
      {tous && <option value="">{tous}</option>}
      {(cultures ?? []).map((c) => <option key={c} value={c}>{libelle(c)}</option>)}
    </SelectNatif>
  )
}
