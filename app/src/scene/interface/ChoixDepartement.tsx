// Choisir son département sans carte ni GPS : une liste native (région, puis département), utilisable sur tout
// téléphone, au clavier et avec un lecteur d'écran. Sert quand WebGL manque (pas de carte 3D), quand la localisation
// est refusée ou introuvable, et pour qui ne connaît pas ses coordonnées (audit, constat FE-02).
import { useId, useMemo } from 'react'
import type { Departement } from '../../types/marts'

interface Props {
  departements: Departement[]
  valeur: string | null
  onChoisir: (code: string) => void
  libelle?: string
  className?: string
}

export function ChoixDepartement({ departements, valeur, onChoisir, libelle = 'Choisir mon département', className }: Props) {
  const id = useId()
  // Régions par ordre alphabétique, puis leurs départements
  const regions = useMemo(() => {
    const parRegion = new Map<string, Departement[]>()
    departements.forEach((d) => parRegion.set(d.region, [...(parRegion.get(d.region) ?? []), d]))
    const tri = (a: string, b: string) => a.localeCompare(b, 'fr')
    return [...parRegion.entries()].sort(([a], [b]) => tri(a, b)).map(([region, ds]) => ({ region, ds: [...ds].sort((a, b) => tri(a.departement, b.departement)) }))
  }, [departements])

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium text-white/70">{libelle}</label>
      <select id={id} className="champ-scene mt-1 w-full" value={valeur ?? ''} onChange={(e) => e.target.value && onChoisir(e.target.value)}>
        <option value="" disabled>Région, puis département…</option>
        {regions.map(({ region, ds }) => (
          <optgroup key={region} label={region}>
            {ds.map((d) => <option key={d.code_departement} value={d.code_departement}>{d.departement}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
