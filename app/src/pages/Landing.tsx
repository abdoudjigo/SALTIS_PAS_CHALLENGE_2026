import clsx from 'clsx'
import { ArrowDown, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useCarte, useReferentiels, useTerritoires, useVulnerabilite } from '../hooks/donnees'
import { Entete, type Chapitre } from '../landing/Entete'
import { PiedDePage } from '../landing/PiedDePage'
import { Portes } from '../landing/Portes'
import { Sources } from '../landing/Sources'
import { libelle, mm, nombre } from '../lib/format'
import type { VueCarte } from '../scene/Carte'
import { couleurAnomalie, couleurVulnerabilite, NIVEAUX, NON_DISPONIBLE } from '../scene/couleurs'
import { useContours, useContoursZones } from '../scene/fonds'
import { cleZone, SENEGAL, ZONES } from '../scene/geo'
import type { NiveauAdequation } from '../types/marts'
import { useModeRendu } from '../lib/modeRendu'

const Carte = lazy(() => import('../scene/Carte'))

type Etape = 'zones' | 'ciel' | 'terre' | 'decision' | 'entrer'

const CHAPITRES: Chapitre[] = [
  { id: 'zones', libelle: 'Les 6 zones' },
  { id: 'ciel', libelle: 'Le ciel' },
  { id: 'terre', libelle: 'La terre' },
  { id: 'decision', libelle: 'La décision' },
  { id: 'entrer', libelle: 'Deux portes' },
]

const delai = (s: number) => ({ '--delai': `${s}s` }) as CSSProperties
const ORDRE_NIVEAUX: NiveauAdequation[] = ['adaptée', 'à risque', 'déconseillée', 'irrigation requise']

function useLargeEcran() {
  const [large, setLarge] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const suivre = () => setLarge(mq.matches)
    mq.addEventListener('change', suivre)
    return () => mq.removeEventListener('change', suivre)
  }, [])
  return large
}

/** Révèle les éléments `.reveler` quand ils entrent à l'écran et suit le chapitre en cours. */
function useRecit(surChapitre: (id: Etape) => void) {
  const rappel = useRef(surChapitre)
  useEffect(() => {
    rappel.current = surChapitre
  })
  useEffect(() => {
    const reveler = new IntersectionObserver(
      (entrees) => entrees.forEach((e) => e.isIntersecting && e.target.classList.add('vu')),
      { threshold: 0.2 },
    )
    document.querySelectorAll('.reveler').forEach((el) => reveler.observe(el))
    const chapitres = new IntersectionObserver(
      (entrees) => entrees.forEach((e) => e.isIntersecting && rappel.current(e.target.id as Etape)),
      { rootMargin: '-45% 0px -45% 0px' },
    )
    document.querySelectorAll('[data-chapitre]').forEach((el) => chapitres.observe(el))
    return () => {
      reveler.disconnect()
      chapitres.disconnect()
    }
  }, [])
}

function Legende({ titre, gauche, droite, degrade }: { titre: string; gauche: string; droite: string; degrade: string }) {
  return (
    <div className="mt-5">
      <p className="text-2xs font-medium tracking-etiquette text-encre-douce uppercase">{titre}</p>
      <div className="mt-2 h-2 rounded-full" style={{ background: degrade }} />
      <div className="mt-1.5 flex justify-between text-xs text-encre-douce"><span>{gauche}</span><span>{droite}</span></div>
    </div>
  )
}

function Recit({ id, cote, surtitre, titre, children }: { id: Etape; cote: 'gauche' | 'droite'; surtitre: string; titre: string; children: ReactNode }) {
  return (
    <section id={id} data-chapitre className="pointer-events-none relative flex min-h-[120svh] scroll-mt-0 items-end px-4 pb-[12svh] sm:px-8 lg:items-center lg:px-[6vw] lg:pb-0">
      <div className={clsx('fiche reveler pointer-events-auto w-full max-w-[27rem] rounded-[28px] p-6 sm:p-8', cote === 'droite' && 'lg:ml-auto')}>
        <p className="text-2xs font-medium tracking-etiquette text-encre-douce uppercase">{surtitre}</p>
        <h2 className="mt-2 font-titre text-titre-recit font-semibold text-encre">{titre}</h2>
        {children}
      </div>
    </section>
  )
}

function Chiffre({ valeur, texte, teinte }: { valeur: string; texte: string; teinte?: string }) {
  return (
    <div>
      <p className={clsx('font-titre text-4xl leading-none font-semibold tabular-nums', teinte ?? 'text-encre')}>{valeur}</p>
      <p className="mt-1.5 text-sm leading-snug text-encre-douce">{texte}</p>
    </div>
  )
}

export default function Landing() {
  const { hash } = useLocation()
  const mode = useModeRendu()
  const large = useLargeEcran()
  const { data: ref } = useReferentiels()
  const campagne = ref?.campagnes.at(-1)
  const { data: saison } = useCarte(campagne)
  const { data: vulnerabilite } = useVulnerabilite()
  const { data: territoires } = useTerritoires()
  const { data: contours } = useContours()
  const { data: contoursZones } = useContoursZones()

  const [etape, setEtape] = useState<Etape>('zones')
  const [arrive, setArrive] = useState(false)
  const [zone, setZone] = useState<string | null>(null)
  const [cultureChoisie, setCulture] = useState<string | null>(null)
  const [portes, setPortes] = useState(false)
  useRecit(setEtape)

  // Le globe tourne un instant, puis la caméra descend sur le Sénégal et les 6 zones s'allument
  useEffect(() => {
    const t = setTimeout(() => setArrive(true), mode.animations ? 2600 : 0)
    return () => clearTimeout(t)
  }, [mode.animations])
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView()
  }, [hash])
  useEffect(() => {
    if (!portes) return
    const fermer = (e: KeyboardEvent) => e.key === 'Escape' && setPortes(false)
    window.addEventListener('keydown', fermer)
    return () => window.removeEventListener('keydown', fermer)
  }, [portes])

  // --- Chiffres tirés de l'API ---------------------------------------------------------------
  const cultures = useMemo(() => {
    const compte = new Map<string, number>()
    territoires?.forEach((t) => t.meilleur_niveau_adequation && compte.set(t.culture, (compte.get(t.culture) ?? 0) + 1))
    return [...compte].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c)
  }, [territoires])
  const culture = cultureChoisie ?? cultures[0] ?? null

  const ciel = useMemo(() => {
    const connus = saison?.filter((l) => l.anomalie_pluie_saison_pct !== null) ?? []
    return {
      plus: connus.filter((l) => l.anomalie_pluie_saison_pct! > 10).length,
      moins: connus.filter((l) => l.anomalie_pluie_saison_pct! < -10).length,
      secheresse: saison?.filter((l) => l.alerte_secheresse).length ?? 0,
    }
  }, [saison])

  const classement = useMemo(
    () => (vulnerabilite ?? []).filter((v) => v.score_vulnerabilite !== null).sort((a, b) => b.score_vulnerabilite! - a.score_vulnerabilite!),
    [vulnerabilite],
  )

  const niveaux = useMemo(() => {
    const lignes = territoires?.filter((t) => t.culture === culture) ?? []
    return ORDRE_NIVEAUX.map((n) => ({ niveau: n, nb: lignes.filter((t) => t.meilleur_niveau_adequation === n).length })).filter((n) => n.nb > 0)
  }, [territoires, culture])

  const ficheZone = useMemo(() => {
    const z = ZONES.find((x) => x.cle === zone)
    if (!z) return null
    const deps = saison?.filter((l) => cleZone(l.zone_agroecologique) === z.cle) ?? []
    const normales = deps.map((l) => l.pluie_saison_normale_mm).filter((v): v is number => v !== null)
    const adaptees = new Map<string, number>()
    territoires?.forEach((t) => cleZone(t.zone_agroecologique) === z.cle && t.meilleur_niveau_adequation === 'adaptée' && adaptees.set(t.culture, (adaptees.get(t.culture) ?? 0) + 1))
    return {
      ...z,
      nbDepartements: deps.length,
      pluie: normales.length ? [Math.min(...normales), Math.max(...normales)] : null,
      cultures: [...adaptees].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c),
    }
  }, [zone, saison, territoires])

  // --- La carte suit le récit ------------------------------------------------------------------
  const vue = useMemo<VueCarte>(() => {
    const marge = (cote: 'gauche' | 'droite') =>
      large
        ? { top: 90, bottom: 40, left: cote === 'gauche' ? window.innerWidth * 0.42 : 40, right: cote === 'droite' ? window.innerWidth * 0.4 : 40 }
        : { top: 76, left: 12, right: 12, bottom: window.innerHeight * 0.5 }
    const pays = (cote: 'gauche' | 'droite', inclinaison = 0, cap = 0) => ({ emprise: SENEGAL.emprise, marge: marge(cote), inclinaison, cap, duree: 2400 })

    if (etape === 'zones') {
      if (!arrive) return { ambiance: 'clair', camera: { centre: [-36, 17], zoom: large ? 1.75 : 0.9, marge: marge('gauche') }, derive: mode.animations, vent: mode.animations }
      return { ambiance: 'clair', camera: { ...pays('gauche'), duree: 5200 }, zones: { accent: zone } }
    }
    if (etape === 'ciel')
      return {
        ambiance: 'clair', camera: pays('droite'), pluie: mode.animations ? 0.45 : 0,
        departements: new Map(saison?.map((l) => [l.code_departement, { couleur: couleurAnomalie(l.anomalie_pluie_saison_pct) }])),
      }
    if (etape === 'terre')
      return {
        ambiance: 'clair', camera: pays('gauche', 52, -14), relief: true,
        departements: new Map(vulnerabilite?.map((v) => [v.code_departement, { couleur: couleurVulnerabilite(v.score_vulnerabilite), hauteur: (v.score_vulnerabilite ?? 0) * 650 }])),
      }
    return {
      ambiance: 'clair', camera: pays('droite'),
      departements: new Map(
        territoires?.filter((t) => t.culture === culture).map((t) => [t.code_departement, { couleur: t.meilleur_niveau_adequation ? NIVEAUX[t.meilleur_niveau_adequation].couleur : NON_DISPONIBLE }]),
      ),
    }
  }, [etape, arrive, zone, large, mode.animations, saison, vulnerabilite, territoires, culture])

  return (
    <div className="landing relative bg-white text-encre">
      <Entete chapitres={CHAPITRES} actif={etape} onEntrer={() => setPortes(true)} />

      {/* La carte reste en place ; la page défile par-dessus */}
      <div className="fixed inset-0" aria-hidden>
        {mode.globe ? (
          <Suspense fallback={null}>
            <Carte vue={vue} contours={contours} contoursZones={contoursZones} departements={ref?.departements} interactive={false}
              onZone={(cle) => setZone((z) => (z === cle ? null : cle))} onSurvolZone={(cle) => etape === 'zones' && cle && setZone(cle)} />
          </Suspense>
        ) : (
          <div className="size-full bg-[radial-gradient(60%_50%_at_70%_40%,#dcecf8,transparent),radial-gradient(40%_40%_at_30%_80%,#eef6f0,transparent)]" />
        )}
      </div>

      <main className="relative">
        {/* --- Hero : du globe aux 6 zones agroécologiques ------------------------------------ */}
        <section id="zones" data-chapitre className="pointer-events-none relative flex min-h-svh flex-col justify-end px-4 pt-28 pb-6 sm:px-8 lg:justify-center lg:px-[6vw] lg:pb-24">
          <div className="voile-clair absolute inset-0" aria-hidden />
          <div className="aurore absolute inset-0" aria-hidden />
          <div className="pointer-events-auto relative max-w-[35rem]">
            <p className="vitrine-entree flex items-center gap-2.5 text-xs font-medium tracking-etiquette text-encre-douce uppercase">
              <span className="text-pluie-500">Assaman</span> le ciel
              <span className="h-px w-6 bg-trait" aria-hidden />
              <span className="text-terre-500">Suuf</span> la terre
            </p>
            <h1 className="vitrine-entree mt-5 font-titre text-titre-hero font-semibold text-balance text-encre" style={delai(0.1)} lang="wo">
              Dalal ak <span className="text-pluie-500">jàmm</span>.
            </h1>
            <p className="vitrine-entree mt-2 font-titre text-xl text-encre-douce italic" style={delai(0.18)}>Bienvenue, en paix.</p>
            <p className="vitrine-entree mt-6 max-w-md text-lg leading-relaxed text-encre-douce" style={delai(0.25)}>
              La pluie, le sol et les cultures des 45 départements du Sénégal, réunis sur une seule carte pour savoir quoi semer et où porter les intrants.
            </p>
            <div className="vitrine-entree mt-8 flex flex-wrap items-center gap-3" style={delai(0.4)}>
              <button type="button" onClick={() => setPortes(true)} className="bouton-ciel inline-flex min-h-12 items-center rounded-full bg-vert-700 px-6 text-md font-semibold text-white transition hover:bg-vert-900 active:scale-[0.98]">
                Entrer dans la carte
              </button>
              <a href="#ciel" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-trait bg-white/70 px-5 text-md font-medium text-encre backdrop-blur transition hover:border-encre/30">
                Suivre le récit <ArrowDown className="size-4" aria-hidden />
              </a>
            </div>
          </div>

          {/* Les 6 zones : survol ou clic, la carte répond */}
          <div className="pointer-events-auto relative mt-9 lg:absolute lg:inset-x-[6vw] lg:bottom-7 lg:mt-0">
            {ficheZone && (
              <div key={ficheZone.cle} className="fiche surgir mb-3 max-w-md rounded-3xl p-5 lg:absolute lg:right-0 lg:bottom-0 lg:z-10 lg:mb-0 lg:w-[24rem]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 font-titre text-xl font-medium tracking-tight">
                      <span className="size-2.5 rounded-full" style={{ background: ficheZone.couleur }} aria-hidden />
                      {ficheZone.nom}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-encre-douce">{ficheZone.repere}</p>
                  </div>
                  <button type="button" onClick={() => setZone(null)} aria-label="Fermer" className="grid size-9 shrink-0 place-items-center rounded-full text-encre-douce transition hover:bg-encre/5">
                    <X className="size-4" />
                  </button>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-trait pt-4 text-sm">
                  <div>
                    <dt className="text-xs text-encre-douce">Départements</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{ficheZone.nbDepartements || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-encre-douce">Pluie normale de la saison</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{ficheZone.pluie ? `${nombre(ficheZone.pluie[0])} à ${mm(ficheZone.pluie[1])}` : 'non disponible'}</dd>
                  </div>
                  {ficheZone.cultures.length > 0 && (
                    <div className="col-span-2">
                      <dt className="text-xs text-encre-douce">Cultures le plus souvent adaptées</dt>
                      <dd className="mt-1.5 flex flex-wrap gap-1.5">
                        {ficheZone.cultures.map((c) => <span key={c} className="rounded-full bg-vert-50 px-2.5 py-1 text-xs font-medium text-vert-700">{libelle(c)}</span>)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
            <p className="mb-2.5 text-2xs font-medium tracking-etiquette text-encre-douce uppercase">6 zones agroécologiques</p>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {ZONES.map((z, i) => (
                <button
                  key={z.cle}
                  type="button"
                  onClick={() => setZone((c) => (c === z.cle ? null : z.cle))}
                  onMouseEnter={() => setZone(z.cle)}
                  aria-pressed={zone === z.cle}
                  style={delai(0.5 + i * 0.07)}
                  className={clsx(
                    'vitrine-entree inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition duration-300',
                    zone === z.cle ? 'border-encre bg-encre text-white' : 'border-trait bg-white/80 text-encre backdrop-blur hover:border-encre/40',
                  )}
                >
                  <span className="size-2 rounded-full" style={{ background: z.couleur }} aria-hidden />
                  {z.nom}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* --- Le récit : la carte change à chaque chapitre ------------------------------------ */}
        <Recit id="ciel" cote="droite" surtitre={campagne ? `Campagne ${campagne}` : 'Dernière campagne'} titre="Le ciel">
          <p className="mt-3 text-md leading-relaxed text-encre-douce">
            La pluie de la saison dans chaque département, comparée à sa propre normale (1991-2020).
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-trait pt-5">
            <Chiffre valeur={saison ? String(ciel.plus) : '—'} texte="départements nettement plus arrosés" teinte="text-pluie-700" />
            <Chiffre valeur={saison ? String(ciel.moins) : '—'} texte="nettement plus secs que la normale" teinte="text-terre-700" />
            <Chiffre valeur={saison ? String(ciel.secheresse) : '—'} texte="en alerte sécheresse" teinte="text-alerte-700" />
          </div>
          <Legende titre="Écart à la normale" gauche="−40 %" droite="+40 %" degrade="linear-gradient(to right,#8a5527,#d9a56b,#f1ece0,#8fc0e6,#1b5a8e)" />
        </Recit>

        <Recit id="terre" cote="gauche" surtitre="Vulnérabilité" titre="La terre">
          <p className="mt-3 text-md leading-relaxed text-encre-douce">
            Là où une mauvaise saison pèse le plus : fréquence des sécheresses, pluie des années sèches, rendements qui varient.
          </p>
          <ol className="mt-6 space-y-3 border-t border-trait pt-5">
            {classement.slice(0, 4).map((v, i) => (
              <li key={v.code_departement} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-xs text-encre-douce tabular-nums">{i + 1}</span>
                <span className="w-28 shrink-0 font-medium">{v.departement}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-trait">
                  <span className="block h-full rounded-full" style={{ width: `${v.score_vulnerabilite}%`, background: couleurVulnerabilite(v.score_vulnerabilite) }} />
                </span>
                <span className="w-8 text-right font-semibold tabular-nums">{nombre(v.score_vulnerabilite)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs leading-relaxed text-encre-douce">
            Score relatif et indicatif, sur {classement.length || '—'} départements notés. La hauteur des volumes est le score. À valider avec les techniciens.
          </p>
        </Recit>

        <Recit id="decision" cote="droite" surtitre="Choix des cultures" titre="La décision">
          <p className="mt-3 text-md leading-relaxed text-encre-douce">
            Pour chaque culture, la saison est-elle assez longue et assez arrosée ? Choisissez une culture, la carte répond.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {cultures.map((c) => (
              <button key={c} type="button" onClick={() => setCulture(c)} aria-pressed={c === culture}
                className={clsx('min-h-10 rounded-full border px-3.5 text-sm font-medium transition duration-300', c === culture ? 'border-vert-700 bg-vert-700 text-white' : 'border-trait text-encre hover:border-encre/40')}>
                {libelle(c)}
              </button>
            ))}
          </div>
          <ul className="mt-6 space-y-2.5 border-t border-trait pt-5 text-sm">
            {niveaux.map((n) => (
              <li key={n.niveau} className="flex items-center gap-3">
                <span className="size-2.5 rounded-full" style={{ background: NIVEAUX[n.niveau].couleur }} aria-hidden />
                <span className="flex-1">{NIVEAUX[n.niveau].libelle}</span>
                <span className="font-semibold tabular-nums">{n.nb} <span className="font-normal text-encre-douce">dép.</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-encre-douce">Meilleur niveau parmi les cycles court, moyen et long, dans les départements où la culture a une superficie de référence.</p>
        </Recit>

        {/* --- Les deux portes ---------------------------------------------------------------- */}
        <section id="entrer" data-chapitre className="fond-ciel relative px-4 pt-24 pb-36 sm:px-8 lg:px-[6vw] lg:pt-36 lg:pb-48">
          <div className="mx-auto max-w-5xl">
            <p className="reveler text-2xs font-medium tracking-etiquette text-encre-douce uppercase">Deux portes d'entrée</p>
            <h2 className="reveler mt-3 max-w-2xl font-titre text-titre-section font-semibold text-balance" style={delai(0.05)}>
              La même carte, lue à votre échelle.
            </h2>
            <div className="reveler mt-12" style={delai(0.12)}><Portes /></div>

            <Sources className="reveler mt-24" />

            <div className="reveler mt-24 grid gap-10 border-t border-trait pt-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
              <div>
                <h3 className="font-titre text-3xl leading-tight font-medium tracking-tight">Ce que nous ne savons pas, nous l'écrivons.</h3>
                <p className="mt-4 max-w-lg leading-relaxed text-encre-douce">
                  Une valeur absente s'affiche « non disponible », jamais zéro. Une dose qui n'a pas été validée porte la mention « à confirmer ».
                  La vulnérabilité d'un département est relative et indicative, et c'est écrit à côté du chiffre.
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-7">
                <Chiffre valeur="45" texte="départements suivis, saison après saison depuis 1981" />
                <Chiffre valeur="3" texte="modèles d'IA : la pluie de la saison, le semis, la récolte" />
                <Chiffre valeur={ref ? String(ref.cultures.length) : '12'} texte="cultures, avec leurs cycles court, moyen et long" />
                <Chiffre valeur="6" texte="zones agroécologiques, du fleuve à la Casamance" />
              </dl>
            </div>
          </div>
        </section>

        <PiedDePage />
      </main>

      {/* --- Pop-up d'entrée ------------------------------------------------------------------ */}
      {portes && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-white/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Choisir son profil" onClick={() => setPortes(false)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="surgir font-titre text-3xl font-medium tracking-tight sm:text-4xl">Qui entre ?</h2>
              <button type="button" onClick={() => setPortes(false)} aria-label="Fermer" className="grid size-11 place-items-center rounded-full border border-trait bg-white text-encre transition hover:border-encre/40">
                <X className="size-5" />
              </button>
            </div>
            <Portes compact />
          </div>
        </div>
      )}
    </div>
  )
}
