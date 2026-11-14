import { lazy, Suspense, useMemo } from 'react'
import { config } from '../../config'
import type { IndicateurCarte, ValeurCarte } from '../../lib/echelles'
import type { Departement } from '../../types/marts'
import { Squelette } from '../ui/base'
import { CarteSvg } from './CarteSvg'
import type { PointCarte } from './types'

const CarteMapbox = lazy(() => import('./CarteMapbox'))

interface PropsCarte<L extends { code_departement: string }> {
  /** lignes d'un mart (une par département) */
  lignes: L[] | undefined
  /** référentiel des départements (latitude, longitude) */
  departements: Departement[] | undefined
  /** colonne de la ligne à représenter */
  champ: keyof L & string
  indicateur: IndicateurCarte
  selection: string | null
  onSelect?: (code: string) => void
  hauteur?: string
}

/** Carte des départements colorés selon un indicateur (Mapbox si un token est fourni, sinon SVG). */
export function CarteSenegal<L extends { code_departement: string }>({
  lignes, departements, champ, indicateur, selection, onSelect, hauteur = 'h-[460px]',
}: PropsCarte<L>) {
  const points = useMemo<PointCarte[]>(() => {
    const parCode = new Map((lignes ?? []).map((l) => [l.code_departement, l]))
    return (departements ?? []).map((d) => {
      const valeur = (parCode.get(d.code_departement)?.[champ] ?? null) as ValeurCarte
      return { ...d, valeur, couleur: indicateur.echelle.couleur(valeur) }
    })
  }, [lignes, departements, champ, indicateur])

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-trait bg-[#eef1ec] ${hauteur}`}>
      {config.mapboxToken ? (
        <Suspense fallback={<Squelette className="absolute inset-0 rounded-none" />}>
          <CarteMapbox points={points} indicateur={indicateur} selection={selection} onSelect={onSelect} />
        </Suspense>
      ) : (
        <CarteSvg points={points} indicateur={indicateur} selection={selection} onSelect={onSelect} />
      )}
      <Legende indicateur={indicateur} />
    </div>
  )
}

function Legende({ indicateur }: { indicateur: IndicateurCarte }) {
  const { echelle, libelle } = indicateur
  return (
    <div className="pointer-events-none absolute bottom-9 left-3 rounded-xl bg-white/90 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
      <div className="mb-1 font-semibold text-encre">{libelle}</div>
      {echelle.type === 'continue' ? (
        <div>
          <div className="h-2 w-44 rounded-full" style={{ background: `linear-gradient(to right, ${echelle.legende.map((l) => l.couleur).join(',')})` }} />
          <div className="mt-0.5 flex w-44 justify-between text-encre-douce">
            <span>{echelle.legende[0].texte}</span>
            <span>{echelle.legende[echelle.legende.length - 1].texte}</span>
          </div>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {echelle.legende.map((l) => (
            <li key={l.texte} className="flex items-center gap-1.5 text-encre-douce">
              <span className="size-2.5 rounded-full" style={{ background: l.couleur }} /> {l.texte}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1 flex items-center gap-1.5 text-encre-douce">
        <span className="size-2.5 rounded-full bg-[#c9c4b8]" /> donnée absente
      </div>
    </div>
  )
}
