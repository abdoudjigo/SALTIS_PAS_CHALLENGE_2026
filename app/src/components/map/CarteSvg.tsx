import { useState } from 'react'
import type { PropsCarteInterne } from './types'
import { valeurTexte } from './valeurTexte'

// Carte de secours sans fond (pas de token Mapbox) : un point par chef-lieu, projection simple.
const LON = [-17.65, -11.2]
const LAT = [12.2, 16.85]
const L = 640
const H = Math.round((L * (LAT[1] - LAT[0])) / (LON[1] - LON[0]) / Math.cos((14.5 * Math.PI) / 180))

const projeter = (lon: number, lat: number) => [((lon - LON[0]) / (LON[1] - LON[0])) * L, H - ((lat - LAT[0]) / (LAT[1] - LAT[0])) * H]

export function CarteSvg({ points, indicateur, selection, onSelect }: PropsCarteInterne) {
  const [survol, setSurvol] = useState<string | null>(null)
  const actif = points.find((p) => p.code_departement === (survol ?? selection))

  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <svg viewBox={`-20 -20 ${L + 40} ${H + 40}`} className="h-full w-full" role="img" aria-label={`Carte : ${indicateur.libelle}`}>
        {points.map((p) => {
          const [x, y] = projeter(p.longitude, p.latitude)
          const choisi = p.code_departement === selection
          return (
            <g key={p.code_departement} transform={`translate(${x},${y})`} className="cursor-pointer"
              onMouseEnter={() => setSurvol(p.code_departement)} onMouseLeave={() => setSurvol(null)}
              onClick={() => onSelect?.(p.code_departement)}>
              <circle r={choisi ? 17 : 13} fill={p.couleur} stroke={choisi ? '#1d2a22' : '#fff'} strokeWidth={choisi ? 3 : 2}
                className="transition-all duration-200" />
              <title>{`${p.departement} : ${valeurTexte(p.valeur, indicateur)}`}</title>
            </g>
          )
        })}
      </svg>
      {actif && (
        <div className="pointer-events-none absolute top-3 right-3 rounded-xl bg-white/95 px-3 py-2 text-sm shadow-sm">
          <div className="font-semibold">{actif.departement}</div>
          <div className="text-xs text-encre-douce">{actif.region} · {valeurTexte(actif.valeur, indicateur)}</div>
        </div>
      )}
      <div className="pointer-events-none absolute right-3 bottom-3 hidden rounded-lg bg-white/80 px-2 py-1 text-[11px] text-encre-douce sm:block">
        Aperçu simplifié (ajoutez VITE_MAPBOX_TOKEN pour le fond de carte)
      </div>
    </div>
  )
}
