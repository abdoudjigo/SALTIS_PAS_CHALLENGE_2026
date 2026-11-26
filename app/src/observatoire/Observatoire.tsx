// Page publique /observatoire : « Observatoire Sénégal 2050 ». Données de l'API seulement (/api/v1/observatoire/*) ;
// aucun chiffre écrit ici. État des filtres dans l'URL ; état courant exposé à l'export PDF (contexte.ts).
import { ArrowLeft, FileDown } from 'lucide-react'
import { createRef, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PiedDePage } from '../landing/PiedDePage'
import { PAGES } from '../lib/pages'
import { useMeta } from '../lib/meta'
import { nombre } from '../lib/format'
import { ChiffresCles } from './ChiffresCles'
import { Carte } from './Carte'
import { Classement } from './Classement'
import { Courbe } from './Courbe'
import { Filtres } from './Filtres'
import { Objectifs } from './Objectifs'
import { ContexteObservatoire, useEtatObservatoire, type EtatObservatoire, type RefsObservatoire } from './contexte'
import { cultureChoisie, useDonneesObs, useFiltresObs, useSelection, zoneChoisie, zoneServie } from './donnees'
import { dateTexte, nomCourt, nomCulture } from './outils'
import { phrasesARetenir } from './retenir'
import { LIBELLES, UNITES } from './types'
import './observatoire.css'

const NIVEAUX = { PAYS: 'pays', REGION: 'région', DEPARTEMENT: 'département' } as const

function Entete() {
  const etat = useEtatObservatoire()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const exporter = async () => {
    if (!etat?.pret || enCours) return
    setEnCours(true)
    setErreur(null)
    try {
      await new Promise((ok) => setTimeout(ok, 300)) // laisse finir les animations du graphique
      const { exporterObservatoire } = await import('./exportPdf')
      await exporterObservatoire(etat)
    } catch {
      setErreur("L'export PDF a échoué. Réessayez dans un instant.")
    } finally {
      setEnCours(false)
    }
  }
  return (
    <header className="border-b" style={{ borderColor: 'var(--obs-trait)' }}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="obs-bouton" aria-label="Assaman & Suuf, retour à l'accueil">
          <ArrowLeft className="size-4" aria-hidden /><span className="max-sm:sr-only">Accueil</span>
        </Link>
        <img src="/favicon.svg" alt="" className="size-7 rounded-lg" />
        <span className="font-titre text-base font-semibold" style={{ color: 'var(--obs-marine)' }}>Assaman & Suuf</span>
        {erreur && <span role="alert" className="ml-auto text-xs obs-doux">{erreur}</span>}
        <button type="button" className={`obs-bouton ${erreur ? '' : 'ml-auto'}`} disabled={!etat?.pret || enCours} onClick={exporter}
          data-emplacement="export-observatoire" aria-busy={enCours}
          aria-label={enCours ? 'Export PDF en cours' : 'Exporter la vue en PDF'} title={etat?.pret ? 'Exporter la vue en PDF' : 'Chargement des données'}>
          <FileDown className="size-4" aria-hidden /><span className="max-sm:sr-only">{enCours ? 'Export…' : 'Exporter en PDF'}</span>
        </button>
      </div>
    </header>
  )
}

export default function Observatoire() {
  useMeta({ titrePage: PAGES.observatoire.titre, description: PAGES.observatoire.description })
  const filtresQ = useFiltresObs()
  const filtres = filtresQ.data?.donnees
  const { selection, changer } = useSelection(filtres)
  const culture = filtres && selection ? cultureChoisie(filtres, selection) : null
  const zone = filtres && selection ? zoneChoisie(filtres, selection) : null
  const servie = culture && zone ? zoneServie(culture, zone) : false
  const d = useDonneesObs(selection, servie)
  const [allume, setAllume] = useState<string | null>(null)

  // Blocs à capturer par l'export PDF (créés une fois)
  const [blocs] = useState<RefsObservatoire>(() => ({
    chiffres: createRef<HTMLElement>(), objectifs: createRef<HTMLElement>(), courbe: createRef<HTMLElement>(),
    carte: createRef<SVGSVGElement>(), classement: createRef<HTMLElement>(), retenir: createRef<HTMLElement>(),
    sources: createRef<HTMLElement>(),
  }))
  const { retenir: retenirRef, sources: sourcesRef } = blocs

  useEffect(() => { window.scrollTo(0, 0) }, [])

  const codesRegion = new Set(filtres && zone?.niveau === 'REGION' ? filtres.zones.filter((z) => z.code_region === zone.code).map((z) => z.code) : [])

  const indicateurs = d.indicateurs.data
  const serie = d.serie.data
  const carte = d.carte.data
  const classement = d.classement.data
  const objectifs = d.objectifs.data
  const nomC = culture ? nomCourt(culture.culture) : ''
  const phrases = selection && servie ? phrasesARetenir({
    indicateurs: indicateurs?.donnees, classement: classement?.donnees, indicateurClassement: selection.indicateur, culture: nomC, zone: zone?.nom ?? '',
  }) : []

  if (filtresQ.isError) {
    return (
      <div className="obs min-h-dvh">
        <Entete />
        <main className="mx-auto max-w-3xl px-5 py-16">
          <h1 className="text-3xl font-semibold">Observatoire Sénégal 2050</h1>
          <p role="alert" className="mt-4 obs-doux">{filtresQ.error.message}</p>
        </main>
      </div>
    )
  }

  const sansTotal = culture && zone && !servie
    ? `${nomCulture(culture.culture)} : pas de total ${zone.niveau === 'PAYS' ? 'national' : 'régional'}, les données sont trop partielles${culture.mention ? ` (${culture.mention})` : ''}. Choisissez un département dans le filtre Zone ou sur la carte.`
    : null
  const pret = Boolean(filtres && selection) && [d.carte, d.classement, d.objectifs, ...(servie ? [d.indicateurs, d.serie] : [])].every((q) => q.isSuccess && !q.isPlaceholderData)
  const etat: EtatObservatoire | null = filtres && selection && culture && zone ? {
    pret, selection, filtres, phrases, refs: blocs,
    libelles: { culture: nomCulture(culture.culture), zone: zone.nom, niveau: NIVEAUX[zone.niveau], indicateur: LIBELLES[selection.indicateur] },
    donnees: { indicateurs, serie, carte, classement, objectifs },
  } : null

  const points = serie?.donnees.points_officiels ?? []
  const notesObjectifs = (objectifs?.donnees.objectifs ?? []).filter((o) => o.note && /contradi|erreur|coquille|faux/i.test(o.note))

  return (
    <ContexteObservatoire value={etat}>
      <div className="obs min-h-dvh">
        <Entete />
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">Observatoire Sénégal 2050</h1>
          <p className="mt-3 max-w-3xl text-lg obs-doux">Ce que le Sénégal produit, et où il en est de ses objectifs de souveraineté alimentaire.</p>
          <aside aria-labelledby="obs-titre-couverture" className="mt-6 rounded-2xl p-4 text-sm obs-fond sm:p-5">
            <h2 id="obs-titre-couverture" className="text-base font-semibold">Couverture des données</h2>
            {filtres ? (
              <>
                <ul className="mt-2 list-disc space-y-1 pl-5">{filtres.couverture.map((t) => <li key={t}>{t}</li>)}</ul>
                <p className="mt-2 text-xs obs-doux">Sources : {filtres.sources.join(' · ')}</p>
              </>
            ) : <p className="mt-2 obs-doux" aria-busy>Chargement…</p>}
          </aside>
        </div>

        {filtres && selection && culture && zone && (
          <Filtres filtres={filtres} selection={selection} culture={culture} zone={zone} changer={changer} />
        )}

        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
          {selection && culture && zone && filtres && (
            <>
              <p className="text-sm obs-doux" aria-live="polite">
                {nomCulture(culture.culture)} · {zone.nom} ({NIVEAUX[zone.niveau]}) · {selection.annee}
              </p>
              <ChiffresCles reponse={servie ? indicateurs?.donnees ?? (indicateurs === null ? null : undefined) : undefined} meta={indicateurs?.meta}
                refBloc={blocs.chiffres} sansTotal={sansTotal} />

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <Courbe serie={servie ? serie?.donnees ?? (serie === null ? null : undefined) : undefined} meta={serie?.meta} indicateur={selection.indicateur}
                    changerIndicateur={(i) => changer({ indicateur: i })} derniereAnnee={filtres.annees[filtres.annees.length - 1]}
                    refBloc={blocs.courbe} sansTotal={sansTotal} />
                </div>
                <div className="lg:col-span-4">
                  <Objectifs reponse={objectifs === undefined ? undefined : objectifs?.donnees ?? null} meta={objectifs?.meta}
                    culture={culture.culture} refBloc={blocs.objectifs} />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <Carte lignes={carte === undefined ? undefined : carte?.donnees ?? null} meta={carte?.meta} indicateur={selection.indicateur}
                    unite={UNITES[selection.indicateur]} culture={nomC} annee={selection.annee} zone={selection.zone} codesRegion={codesRegion}
                    allume={allume} choisir={(code) => changer({ zone: code })} survoler={setAllume} refSvg={blocs.carte} />
                </div>
                <div className="lg:col-span-5">
                  <Classement lignes={classement === undefined ? undefined : classement?.donnees ?? null} meta={classement?.meta}
                    indicateur={selection.indicateur} unite={UNITES[selection.indicateur]} annee={selection.annee} zone={selection.zone}
                    choisir={(code) => changer({ zone: code })} allumer={setAllume} refBloc={blocs.classement} />
                </div>
              </div>

              <section ref={retenirRef} aria-labelledby="obs-titre-retenir" className="obs-carte p-5">
                <h2 id="obs-titre-retenir" className="text-xl font-semibold">Ce qu'il faut retenir</h2>
                {phrases.length > 0
                  ? <ul className="mt-3 list-disc space-y-2 pl-5">{phrases.map((p) => <li key={p}>{p}</li>)}</ul>
                  : <p className="mt-3 text-sm obs-doux">Pas assez de données pour cette vue.</p>}
                <p className="mt-3 text-xs obs-doux">Phrases écrites par des gabarits fixes à partir des chiffres affichés ; une phrase dont une donnée manque est omise.</p>
              </section>

              <section ref={sourcesRef} aria-labelledby="obs-titre-sources" className="obs-carte space-y-3 p-5 text-sm">
                <h2 id="obs-titre-sources" className="text-xl font-semibold">Sources et limites</h2>
                <ul className="list-disc space-y-1 pl-5">
                  {filtres.sources.map((s) => <li key={s}>{s}</li>)}
                  <li>Contours des départements : GADM 4.1 (gadm.org), simplifiés.</li>
                </ul>
                {(filtresQ.data?.meta.avertissements ?? []).length > 0 && (
                  <>
                    <h3 className="text-base font-semibold">Règles de calcul</h3>
                    <ul className="list-disc space-y-1 pl-5">{filtresQ.data!.meta.avertissements!.map((a) => <li key={a}>{a}</li>)}</ul>
                  </>
                )}
                {(points.length > 0 || notesObjectifs.length > 0) && (
                  <>
                    <h3 className="text-base font-semibold">Chiffres officiels : contradictions et erreurs probables</h3>
                    <ul className="list-disc space-y-1 pl-5">
                      {points.map((o) => (
                        <li key={`${o.indicateur}${o.annee}${o.document}${o.page}${o.valeur}`}>
                          {o.document}, p. {o.page}{o.annee ? ` (${o.annee})` : ''} : {nombre(o.valeur, { unite: o.unite ?? '' })}{o.note ? `. ${o.note}` : ''}
                        </li>
                      ))}
                      {notesObjectifs.map((o) => <li key={`${o.indicateur}${o.culture}${o.document}`}>{o.libelle} ({o.document}, p. {o.page}) : {o.note}</li>)}
                    </ul>
                  </>
                )}
                <p className="text-xs obs-doux">
                  Table {filtresQ.data?.meta.source ?? 'non disponible'}, données du {dateTexte(filtresQ.data?.meta.genere_le)}.
                </p>
              </section>
            </>
          )}
          {!filtres && <div aria-busy aria-label="Chargement de l'observatoire" className="h-96 animate-pulse rounded-2xl obs-fond" />}
        </main>
        <PiedDePage />
      </div>
    </ContexteObservatoire>
  )
}
