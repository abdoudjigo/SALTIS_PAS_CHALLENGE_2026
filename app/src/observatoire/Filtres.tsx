// Barre des filtres (année, culture, zone), fixée au défilement ; repliable sur téléphone.
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { Selection } from './donnees'
import { codeCulture, nomCulture } from './outils'
import type { CultureObs, FiltresObs, ZoneObs } from './types'

const SANS_DONNEE = 'Pas de donnée pour cette année'

function etatAnnee(culture: CultureObs, annee: number) {
  if (culture.annees_couvertes.includes(annee)) return 'donnee'
  return culture.faostat_annees.includes(annee) ? 'faostat' : 'vide'
}

export function Filtres({ filtres, selection, culture, zone, changer }: {
  filtres: FiltresObs
  selection: Selection
  culture: CultureObs
  zone: ZoneObs
  changer: (s: Partial<Selection>) => void
}) {
  const [ouverte, setOuverte] = useState(false)
  const [recherche, setRecherche] = useState('')
  const id = useId()
  const annees = filtres.annees
  const etat = etatAnnee(culture, selection.annee)
  const aideAnnee = etat === 'vide' ? SANS_DONNEE : etat === 'faostat' ? 'Rendement national FAOSTAT seulement (pas de donnée par département)' : null

  const groupes = useMemo(() => {
    const t = recherche.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    const ok = (z: ZoneObs) => !t || z.code === selection.zone || z.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(t)
    const tri = (a: ZoneObs, b: ZoneObs) => a.nom.localeCompare(b.nom, 'fr')
    const regions = new Map(filtres.zones.filter((z) => z.niveau === 'REGION').map((z) => [z.code, z.nom]))
    return {
      pays: filtres.zones.filter((z) => z.niveau === 'PAYS' && ok(z)),
      regions: filtres.zones.filter((z) => z.niveau === 'REGION' && ok(z)).sort(tri),
      departements: filtres.zones.filter((z) => z.niveau === 'DEPARTEMENT' && ok(z)).sort(tri),
      nomRegion: (code: string | null) => (code ? regions.get(code) : undefined),
    }
  }, [filtres.zones, recherche, selection.zone])

  const resume = `${selection.annee} · ${nomCulture(culture.culture)} · ${zone.nom}`

  return (
    <div className="obs-barre-filtres" role="region" aria-label="Filtres de l'observatoire">
      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
        <button type="button" className="obs-bouton w-full justify-between md:hidden" aria-expanded={ouverte} aria-controls={`${id}-filtres`}
          onClick={() => setOuverte((o) => !o)}>
          <span className="inline-flex items-center gap-2"><SlidersHorizontal className="size-4" aria-hidden />Filtres : {resume}</span>
          <ChevronDown className={`size-4 transition-transform ${ouverte ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <div id={`${id}-filtres`} className={`${ouverte ? 'grid' : 'hidden'} gap-3 pt-3 md:grid md:grid-cols-12 md:items-start md:gap-5 md:pt-0`}>
          {/* Année */}
          <div className="md:col-span-5">
            <label htmlFor={`${id}-annee`} className="flex items-baseline justify-between text-xs font-semibold tracking-wide uppercase obs-doux">
              <span>Année</span>
              <span className="text-lg font-semibold tracking-normal normal-case" style={{ color: 'var(--obs-marine)' }}>{selection.annee}</span>
            </label>
            <input id={`${id}-annee`} type="range" className="obs-curseur" min={annees[0]} max={annees[annees.length - 1]} step={1}
              value={selection.annee} onChange={(e) => changer({ annee: Number(e.target.value) })}
              aria-valuetext={`${selection.annee}${aideAnnee ? `, ${aideAnnee.toLowerCase()}` : ''}`}
              aria-describedby={`${id}-aide-annee`} />
            {/* Graduation : années sans donnée pour la culture grisées, avec infobulle (souris) ; le curseur l'annonce au clavier */}
            <div className="obs-graduation" aria-hidden>
              {annees.map((a) => {
                const e = etatAnnee(culture, a)
                return <span key={a} data-etat={e} data-choisie={a === selection.annee} onClick={() => changer({ annee: a })}
                  title={`${a} : ${e === 'vide' ? SANS_DONNEE : e === 'faostat' ? 'rendement national FAOSTAT seulement' : 'données par département'}`} />
              })}
            </div>
            <p id={`${id}-aide-annee`} className="mt-1 min-h-4 text-xs obs-doux">
              {aideAnnee ?? `${annees[0]} → ${annees[annees.length - 1]} ; par département jusqu'en ${filtres.derniere_annee_departements}`}
            </p>
          </div>

          {/* Culture */}
          <div className="md:col-span-3">
            <label htmlFor={`${id}-culture`} className="text-xs font-semibold tracking-wide uppercase obs-doux">Culture</label>
            <select id={`${id}-culture`} className="obs-champ" value={selection.culture} aria-describedby={`${id}-aide-culture`}
              onChange={(e) => changer({ culture: e.target.value })}>
              {filtres.cultures.map((c) => (
                <option key={c.culture} value={codeCulture(c.culture)}>{nomCulture(c.culture)}{c.mention ? ` · ${c.mention}` : ''}</option>
              ))}
            </select>
            <p id={`${id}-aide-culture`} className="mt-1 text-xs obs-doux">{filtres.mention_sans_donnees}</p>
          </div>

          {/* Zone, avec recherche */}
          <div className="md:col-span-4">
            <label htmlFor={`${id}-zone`} className="text-xs font-semibold tracking-wide uppercase obs-doux">Zone</label>
            <div className="flex gap-2">
              <input type="search" className="obs-champ max-w-[40%]" placeholder="Rechercher" value={recherche}
                onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher une région ou un département" aria-controls={`${id}-zone`} />
              <select id={`${id}-zone`} className="obs-champ" value={selection.zone} onChange={(e) => changer({ zone: e.target.value })}
                aria-describedby={culture.a_totaux ? undefined : `${id}-aide-zone`}>
                {groupes.pays.map((z) => (
                  <option key={z.code} value={z.code} disabled={!culture.a_totaux}>Tout le Sénégal{culture.a_totaux ? '' : ' (pas de total)'}</option>
                ))}
                {groupes.regions.length > 0 && (
                  <optgroup label="Régions">
                    {groupes.regions.map((z) => <option key={z.code} value={z.code} disabled={!culture.a_totaux}>{z.nom}</option>)}
                  </optgroup>
                )}
                {groupes.departements.length > 0 && (
                  <optgroup label="Départements">
                    {groupes.departements.map((z) => <option key={z.code} value={z.code}>{z.nom}{groupes.nomRegion(z.code_region) ? ` (${groupes.nomRegion(z.code_region)})` : ''}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
            {!culture.a_totaux && (
              <p id={`${id}-aide-zone`} className="mt-1 text-xs obs-doux">{nomCulture(culture.culture)} : données trop partielles pour un total régional ou national, choisissez un département.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
