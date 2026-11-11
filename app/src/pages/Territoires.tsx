import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { LogOut, Menu, RotateCcw, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { peutAcceder } from '../auth/roles'
import type { Etape } from '../carte3d/Carte3D'
import { COULEUR_NON_DISPONIBLE, construireVolumes, construireZones, RISQUES, type Contours, type ZonesSource } from '../carte3d/donnees'
import { NAVIGATION } from '../components/layout/navigation'
import { useCarte, useReferentiels } from '../hooks/donnees'
import { useTerritoire } from '../hooks/territoire'
import { libelle, nombre } from '../lib/format'
import type { LigneCarte } from '../types/marts'
import { arrivee } from '../vitrine/bienvenue'
import { useModeRendu } from '../vitrine/modeRendu'

const Carte3D = lazy(() => import('../carte3d/Carte3D'))

const lireJson = <T,>(url: string) => async (): Promise<T | null> => {
  const r = await fetch(url)
  return r.ok && r.headers.get('content-type')?.includes('json') ? ((await r.json()) as T) : null
}

/** La pluie de la saison en une phrase. Une valeur absente est dite, jamais remplacée par 0. */
function phrasePluie(l: LigneCarte) {
  if (l.pluie_saison_mm === null) return 'Pluie de la saison non disponible.'
  const pluie = `${nombre(l.pluie_saison_mm, { unite: 'mm' })} de pluie`
  const ecart = l.anomalie_pluie_saison_pct
  if (ecart === null) return `${pluie}. Écart à la normale non disponible.`
  if (Math.abs(ecart) < 5) return `${pluie}, proche de la normale.`
  return `${pluie}, ${nombre(Math.abs(ecart), { unite: '%' })} ${ecart > 0 ? 'au-dessus' : 'en dessous'} de la normale.`
}

const LEGENDES_ETAPE: Record<Exclude<Etape, 'fin'>, string> = {
  vol: "De l'Afrique de l'Ouest au Sénégal",
  zones: '6 zones agroécologiques',
  departements: '45 départements : la hauteur est la pluie de la saison, la couleur son risque',
}

export default function Territoires() {
  const { user, logout } = useAuth()
  const mode = useModeRendu()
  const { choisir } = useTerritoire()
  const { data: ref } = useReferentiels()
  const [campagneChoisie, setCampagne] = useState<number>()
  const campagne = campagneChoisie ?? ref?.campagnes.at(-1)
  const { data: lignes, error } = useCarte(campagne)
  const { data: zonesSource } = useQuery({ queryKey: ['geo-zones'], queryFn: lireJson<ZonesSource>('/geo/zones_agroecologiques.geojson'), staleTime: Infinity })
  // Contours GADM des départements : absents aujourd'hui, pris en compte dès que le fichier existe
  const { data: contours } = useQuery({ queryKey: ['geo-departements'], queryFn: lireJson<Contours>('/geo/departements.geojson'), staleTime: Infinity })

  // La plongée se joue à l'arrivée après une connexion, pas à un rechargement
  const [sequence, setSequence] = useState(() => ({ plongee: arrivee.plongee, relance: 0 }))
  useEffect(() => {
    arrivee.plongee = false
  }, [])
  const [etape, setEtape] = useState<Etape>(sequence.plongee ? 'vol' : 'fin')
  const [selection, setSelection] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)

  const volumes = useMemo(
    () => (lignes && ref && contours !== undefined ? construireVolumes(lignes, ref.departements, contours) : null),
    [lignes, ref, contours],
  )
  const zones = useMemo(() => (zonesSource ? construireZones(zonesSource) : null), [zonesSource])

  // Producteur et conseiller : la plongée se termine sur leur département
  const aSonDepartement = user?.role === 'PRODUCTEUR' || user?.role === 'CONSEILLER'
  const cible = useMemo(
    () => (aSonDepartement ? (ref?.departements.find((d) => d.code_departement === user?.code_departement) ?? null) : null),
    [aSonDepartement, ref, user],
  )

  if (!mode.globe) return <Navigate to="/tableau-de-bord" replace />

  const selectionner = (code: string) => {
    setSelection(code)
    choisir(code)
  }
  const surEtape = (e: Etape) => {
    setEtape(e)
    if (e === 'fin' && cible) selectionner(cible.code_departement)
  }

  const ligne = lignes?.find((l) => l.code_departement === selection)
  const departement = ref?.departements.find((d) => d.code_departement === selection)
  const enScene = etape !== 'fin'
  const liens = NAVIGATION.filter((n) => n.to !== '/' && peutAcceder(user, n.acces))

  return (
    <div className="relative h-dvh overflow-hidden bg-nuit-900 text-white">
      <div className="decor-etoiles absolute inset-0" aria-hidden />
      <Suspense fallback={null}>
        <Carte3D volumes={volumes} zones={zones} plongee={sequence.plongee} relance={sequence.relance} anime={mode.animations}
          cible={cible} selection={selection} onSelect={selectionner} onEtape={surEtape} />
      </Suspense>
      {/* Pendant la plongée, la carte ne répond pas aux gestes */}
      {enScene && <div className="absolute inset-0" />}

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="verre pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pr-4 pl-2">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="font-titre tracking-tight max-sm:sr-only">Assaman & Suuf</span>
          {!enScene && ref && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-white/60">Saison</span>
              <select value={campagne} onChange={(e) => setCampagne(Number(e.target.value))} aria-label="Campagne agricole"
                className="min-h-9 rounded-full border border-white/20 bg-transparent px-2 font-medium focus:border-soleil-500 focus:outline-none">
                {[...ref.campagnes].reverse().map((c) => <option key={c} value={c} className="text-encre">{c}</option>)}
              </select>
            </label>
          )}
        </div>
        <button type="button" onClick={() => setMenu(true)} aria-expanded={menu}
          className="verre pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium">
          <Menu className="size-4" aria-hidden /> Menu
        </button>
      </header>

      {enScene ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-4 px-5 text-center">
          <p key={etape} className="vitrine-entree max-w-xl font-titre text-2xl leading-snug text-balance sm:text-3xl" aria-live="polite">
            {LEGENDES_ETAPE[etape]}
          </p>
          <button type="button" onClick={() => setSequence({ plongee: false, relance: 0 })}
            className="pointer-events-auto min-h-11 px-4 text-sm text-white/60 underline-offset-4 transition hover:text-white hover:underline">
            Passer
          </button>
        </div>
      ) : (
        <>
          <aside className={clsx('verre vitrine-entree absolute left-4 rounded-2xl p-3.5 text-xs sm:left-6', ligne ? 'max-md:hidden md:bottom-6' : 'bottom-[max(1.5rem,env(safe-area-inset-bottom))]')}>
            <p className="font-medium">Saison {campagne}</p>
            <p className="mt-0.5 text-white/60">Hauteur : pluie de la saison · Couleur : risque</p>
            <ul className="mt-2 space-y-1">
              {RISQUES.map((r) => (
                <li key={r.risque} className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: r.couleur }} />{r.libelle}</li>
              ))}
              <li className="flex items-center gap-2 text-white/60"><span className="size-2.5 rounded-sm" style={{ background: COULEUR_NON_DISPONIBLE }} />Donnée non disponible</li>
            </ul>
            {mode.animations && (
              <button type="button" onClick={() => { setSelection(null); setSequence((s) => ({ plongee: true, relance: s.relance + 1 })) }}
                className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-white/70 underline-offset-4 transition hover:text-white hover:underline">
                <RotateCcw className="size-3.5" aria-hidden /> Rejouer la plongée
              </button>
            )}
          </aside>

          {error && !lignes && (
            <p role="alert" className="verre absolute inset-x-4 top-24 mx-auto max-w-md rounded-2xl p-4 text-sm">
              {error.message}
            </p>
          )}

          {ligne && departement && (
            <section aria-label={`Département de ${departement.departement}`}
              className="verre vitrine-entree absolute inset-x-0 bottom-0 rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-x-auto md:right-6 md:bottom-6 md:w-[24rem] md:rounded-3xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="font-titre text-3xl leading-tight font-medium">{departement.departement}</h1>
                  <p className="mt-1 text-sm text-white/60">Région de {departement.region} · {libelle(departement.zone_agroecologique)}</p>
                </div>
                <button type="button" onClick={() => setSelection(null)} aria-label="Fermer la fiche"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <p className="mt-4 font-titre text-xl leading-snug">{phrasePluie(ligne)}</p>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1">
                  <span className="size-2.5 rounded-full" style={{ background: RISQUES.find((r) => r.risque === ligne.risque_saison)?.couleur ?? COULEUR_NON_DISPONIBLE }} />
                  {RISQUES.find((r) => r.risque === ligne.risque_saison)?.libelle ?? 'Risque non disponible'}
                </span>
                <span className="text-white/60">saison {ligne.campagne_agricole}</span>
              </p>
              <p className="mt-3 text-sm text-white/75">
                Vulnérabilité : {ligne.classe_vulnerabilite ?? 'non disponible'}
                {ligne.classe_vulnerabilite && <span className="ml-2 rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/60">relative et indicative</span>}
              </p>
              <nav aria-label="Aller plus loin" className="mt-5 flex flex-wrap gap-2">
                {[['/suivi', 'Suivi de la saison'], ['/cultures', 'Cultures conseillées'], ['/besoins', 'Besoins en intrants']].map(([to, texte]) => (
                  <Link key={to} to={to} className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-sm font-medium transition hover:border-soleil-500 hover:text-soleil-500">
                    {texte}
                  </Link>
                ))}
              </nav>
            </section>
          )}

          {!ligne && peutAcceder(user, 'agrodistrib') && (
            <Link to="/agrodistrib" className="vitrine-entree absolute right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] inline-flex min-h-12 items-center rounded-full bg-soleil-500 px-6 text-[15px] font-semibold text-nuit-900 transition hover:bg-soleil-100 sm:right-6">
              Répartir vos intrants
            </Link>
          )}
        </>
      )}

      {menu && (
        <div className="absolute inset-0 z-10 bg-nuit-900/60" onClick={() => setMenu(false)}>
          <nav aria-label="Menu" onClick={(e) => e.stopPropagation()}
            className="verre vitrine-entree absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{user?.nom}</p>
                <p className="truncate text-sm text-white/55">{user?.organisation?.nom ?? user?.email}</p>
              </div>
              <button type="button" onClick={() => setMenu(false)} aria-label="Fermer le menu" autoFocus
                className="grid size-11 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <ul className="mt-6 flex-1 space-y-1 overflow-y-auto">
              {liens.map(({ to, libelle: nom, icone: Icone }) => (
                <li key={to}>
                  <Link to={to} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] transition hover:bg-white/10">
                    <Icone className="size-4.5 text-brume" aria-hidden /> {nom}
                  </Link>
                </li>
              ))}
            </ul>
            <button type="button" onClick={logout} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] text-white/70 transition hover:bg-white/10 hover:text-white">
              <LogOut className="size-4.5" aria-hidden /> Se déconnecter
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
