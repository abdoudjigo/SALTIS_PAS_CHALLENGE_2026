// Carte SVG des 45 départements (GADM 4.1, contours simplifiés : public/geo/departements-svg.json,
// généré par scripts/simplifier_contours.py). Choroplèthe séquentielle bleue, département choisi souligné en or,
// départements sans donnée hachurés en gris. Chaque département est focusable ; Entrée ou Espace filtre la page.
import { useMemo, useState, type Ref } from 'react'
import { nombre } from '../lib/format'
import { useContours } from './donnees'
import { COULEURS, RAMPE, dateTexte, valeurTexte } from './outils'
import type { CarteDepartementObs, Indicateur, MetaObs } from './types'

/** Seuils de classes : quantiles des valeurs observées (au plus 5 classes, sans doublon) */
function seuils(valeurs: number[]) {
  const v = [...valeurs].sort((a, b) => a - b)
  if (v.length === 0) return []
  const s = [1, 2, 3, 4].map((k) => v[Math.min(v.length - 1, Math.floor((k * v.length) / 5))])
  return [...new Set(s)].filter((x) => x > v[0])
}

export function Carte({ lignes, meta, indicateur, unite, culture, annee, zone, codesRegion, allume, choisir, survoler, refSvg }: {
  lignes: CarteDepartementObs[] | null | undefined
  meta: MetaObs | undefined
  indicateur: Indicateur
  unite: string
  /** nom court (« mil ») */
  culture: string
  annee: number
  /** code de la zone choisie */
  zone: string
  /** départements de la région choisie (contour or fin) */
  codesRegion: Set<string>
  /** département allumé depuis le classement */
  allume: string | null
  choisir: (code: string) => void
  survoler: (code: string | null) => void
  refSvg: Ref<SVGSVGElement>
}) {
  const contours = useContours()
  const [survol, setSurvol] = useState<string | null>(null)
  const parCode = useMemo(() => new Map((lignes ?? []).map((l) => [l.code_departement, l])), [lignes])
  const bornes = useMemo(() => seuils((lignes ?? []).flatMap((l) => (l.valeur !== null ? [l.valeur] : []))), [lignes])
  const nbAvec = (lignes ?? []).filter((l) => l.valeur !== null).length
  const classe = (v: number) => bornes.filter((b) => v >= b).length
  const rampe = RAMPE.slice(RAMPE.length - (bornes.length + 1))
  const min = Math.min(...(lignes ?? []).flatMap((l) => (l.valeur !== null ? [l.valeur] : [])))
  const max = Math.max(...(lignes ?? []).flatMap((l) => (l.valeur !== null ? [l.valeur] : [])))

  const etiquette = (code: string, nom: string) => {
    const l = parCode.get(code)
    return `${l?.departement ?? nom}, ${culture} ${annee} : ${valeurTexte(l?.valeur ?? null, indicateur, unite)}`
  }
  const enAvant = (code: string) => code === zone || code === allume || code === survol
  const ordre = useMemo(() => {
    const d = contours.data?.departements ?? []
    return [...d.filter((x) => !(x.code === zone || x.code === allume)), ...d.filter((x) => x.code === zone || x.code === allume)]
  }, [contours.data, zone, allume])
  const info = survol ?? allume

  return (
    <section aria-labelledby="obs-titre-carte" className="obs-carte obs-entree space-y-3 p-5">
      <h2 id="obs-titre-carte" className="text-xl font-semibold">Carte des départements, {culture} {annee}</h2>
      {contours.isError && <p className="text-sm obs-doux">Contours des départements indisponibles.</p>}
      {!contours.data || lignes === undefined ? <div aria-busy className="aspect-[4/3] animate-pulse rounded-xl obs-fond" /> : (
        <svg ref={refSvg} viewBox={contours.data.viewBox} className="h-auto w-full" role="group"
          aria-label={`Carte des 45 départements : ${culture}, ${indicateur} ${annee}. Choisir un département filtre la page.`}>
          <defs>
            <pattern id="obs-hachures" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <rect width="8" height="8" fill="#EEF1F4" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#9AA5B0" strokeWidth="2.5" />
            </pattern>
          </defs>
          {ordre.map((d) => {
            const l = parCode.get(d.code)
            const v = l?.valeur ?? null
            const choisi = d.code === zone
            const fort = enAvant(d.code)
            return (
              <path key={d.code} d={d.d} className="obs-dep" tabIndex={0} role="button" aria-pressed={choisi}
                aria-label={etiquette(d.code, d.nom)}
                fill={v === null ? 'url(#obs-hachures)' : rampe[classe(v)]}
                stroke={fort || codesRegion.has(d.code) ? COULEURS.or : '#FFFFFF'}
                strokeWidth={choisi || d.code === allume ? 3.5 : fort ? 2.5 : codesRegion.has(d.code) ? 1.8 : 0.8}
                strokeLinejoin="round"
                onClick={() => choisir(d.code)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(d.code) } }}
                onMouseEnter={() => { setSurvol(d.code); survoler(d.code) }} onMouseLeave={() => { setSurvol(null); survoler(null) }}
                onFocus={() => setSurvol(d.code)} onBlur={() => setSurvol(null)}>
                <title>{etiquette(d.code, d.nom)}</title>
              </path>
            )
          })}
        </svg>
      )}
      <p className="min-h-5 text-sm" aria-live="polite" style={{ color: COULEURS.marine }}>
        {info && contours.data ? etiquette(info, contours.data.departements.find((d) => d.code === info)?.nom ?? '') : ''}
      </p>

      {/* Légende en texte */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Légende de la carte">
        {nbAvec > 0 && rampe.map((c, i) => {
          const bas = i === 0 ? min : bornes[i - 1]
          const haut = i === rampe.length - 1 ? max : bornes[i]
          return (
            <li key={c} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-3.5 rounded-sm" style={{ background: c }} />
              {i === rampe.length - 1 ? `${nombre(bas)} à ${nombre(haut, { unite })}` : `${nombre(bas)} à moins de ${nombre(haut, { unite })}`}
            </li>
          )
        })}
        <li className="flex items-center gap-1.5">
          <svg aria-hidden className="size-3.5" viewBox="0 0 14 14"><rect width="14" height="14" fill="url(#obs-hachures)" stroke="#9AA5B0" /></svg>
          Pas de donnée
        </li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-3.5 rounded-sm border-2" style={{ borderColor: COULEURS.or }} />Zone choisie</li>
      </ul>
      {nbAvec === 0 && lignes !== undefined && <p className="text-sm obs-doux">Aucun département n'a de donnée pour {culture} en {annee}.</p>}
      <p className="text-xs obs-doux">
        Source : {[...new Set((lignes ?? []).map((l) => l.source).filter(Boolean))].join(' ; ') || 'non disponible'} ; contours {contours.data?.source ?? 'GADM 4.1'}.
        {' '}Table {meta?.source ?? 'non disponible'}, données du {dateTexte(meta?.genere_le)}.
      </p>
    </section>
  )
}
