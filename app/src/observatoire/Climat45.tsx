// Page publique /observatoire : tableau de bord agricole du Sénégal (1981-2025). Une bande de filtres (année, région,
// département, catégorie, culture) et, pour cette sélection : chiffres clés et graphiques (Chart.js). Données réelles de
// l'API seulement, aucune prévision : une valeur absente est « non disponible », jamais 0. Couleurs et polices du site.
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip, type ChartOptions, type ChartType, type Plugin, type ScriptableContext,
} from 'chart.js'
import { ArrowLeft, CloudRain, FileDown, Info, LandPlot, Loader2, RotateCcw, Sprout, Wheat, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'
import { PiedDePage } from '../landing/PiedDePage'
import { nombre } from '../lib/format'
import { useMeta } from '../lib/meta'
import { PAGES } from '../lib/pages'
import { ANNEES as ANNEES_PLUIE, classeDe, dansZone, moyenne, parAnnee, usePluies } from './climat'
import { useFiltresObs } from './donnees'
import { codeCulture, NON_DISPONIBLE, nomCulture } from './outils'
import { SITE } from './palette'
import type { CultureObs, ZoneObs } from './types'

/** Pluie : de « beaucoup moins » (terre foncée) à « beaucoup plus » (pluie foncée) qu'une année normale */
const COULEUR_PLUIE: Record<string, string> = { 'très sèche': SITE.terre700, sèche: SITE.terre500, normale: '#d9d3c5', humide: SITE.pluie500, 'très humide': SITE.pluie700 }
const PALETTE = [SITE.vert700, SITE.terre500, SITE.pluie500, SITE.soleil500, SITE.vert500, SITE.pluie700, SITE.terre700, '#8fb59a', '#9cc3e4', SITE.douce]

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler)
ChartJS.defaults.font.family = "'IBM Plex Sans Variable', ui-sans-serif, system-ui, sans-serif"
ChartJS.defaults.font.size = 12
ChartJS.defaults.color = SITE.douce

// ---------------------------------------------------------------- relief et repères des graphiques (Chart.js)

// Réglages des repères, passés par options.plugins.<id> : ils suivent les filtres sans recréer le graphique
declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    repereHorizontal?: { valeur: number | null; texte: string; _t?: TType }
    repereAnnee?: { index: number }
    centre?: { haut: string; bas: string }
  }
}

/** Ombre portée sous les barres, la courbe et l'anneau : un léger relief */
const ombre: Plugin = {
  id: 'ombre',
  beforeDatasetsDraw: (c) => { const x = c.ctx; x.save(); x.shadowColor = 'rgba(29, 42, 34, 0.22)'; x.shadowBlur = 12; x.shadowOffsetY = 5 },
  afterDatasetsDraw: (c) => c.ctx.restore(),
}
/** Dégradé d'une couleur : plus claire à la base, pleine au sommet (vertical) ou au bout (horizontal) */
function degrade(ctx: ScriptableContext<'bar' | 'line'>, couleur: string, horizontal = false, clair = '66', fort = '') {
  const zone = ctx.chart.chartArea
  if (!zone) return couleur
  const g = horizontal ? ctx.chart.ctx.createLinearGradient(zone.left, 0, zone.right, 0) : ctx.chart.ctx.createLinearGradient(0, zone.bottom, 0, zone.top)
  g.addColorStop(0, `${couleur}${clair}`)
  g.addColorStop(1, `${couleur}${fort}`)
  return g
}
const police = (taille: number, poids = 500, famille = "'IBM Plex Sans Variable', sans-serif") => `${poids} ${taille}px ${famille}`

/** Ligne horizontale pointillée avec son étiquette (ex. « Année normale : 650 mm ») */
const repereHorizontal: Plugin<'bar', { valeur: number | null; texte: string }> = {
  id: 'repereHorizontal',
  afterDatasetsDraw: (c, _a, { valeur, texte }) => {
    if (valeur === null || valeur === undefined) return
    const { ctx, chartArea: z, scales } = c
    const y = scales.y.getPixelForValue(valeur)
    ctx.save()
    ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = SITE.encre
    ctx.beginPath(); ctx.moveTo(z.left, y); ctx.lineTo(z.right, y); ctx.stroke()
    ctx.setLineDash([]); ctx.font = police(11, 600)
    const l = ctx.measureText(texte).width + 14
    ctx.fillStyle = SITE.encre
    ctx.beginPath(); ctx.roundRect(z.right - l, y - 22, l, 18, 9); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(texte, z.right - l + 7, y - 13)
    ctx.restore()
  },
}
/** Trait vertical sur l'année choisie */
const repereAnnee: Plugin<'line', { index: number }> = {
  id: 'repereAnnee',
  beforeDatasetsDraw: (c, _a, { index }) => {
    if (index === undefined || index < 0) return
    const { ctx, chartArea: z, scales } = c
    const x = scales.x.getPixelForValue(index)
    ctx.save()
    const g = ctx.createLinearGradient(0, z.top, 0, z.bottom)
    g.addColorStop(0, 'rgba(242, 181, 68, 0)'); g.addColorStop(0.5, 'rgba(242, 181, 68, 0.9)'); g.addColorStop(1, 'rgba(242, 181, 68, 0)')
    ctx.strokeStyle = g; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(x, z.top); ctx.lineTo(x, z.bottom); ctx.stroke()
    ctx.restore()
  },
}
/** Valeur écrite au bout de chaque barre horizontale */
const valeursAuBout: Plugin<'bar'> = {
  id: 'valeursAuBout',
  afterDatasetsDraw: (c) => {
    const { ctx } = c
    const meta = c.getDatasetMeta(0)
    ctx.save(); ctx.font = police(11, 600); ctx.fillStyle = SITE.encre; ctx.textBaseline = 'middle'
    meta.data.forEach((b, i) => {
      const v = c.data.datasets[0].data[i] as number | null
      if (v !== null) ctx.fillText(nd(v, 't'), b.x + 8, b.y)
    })
    ctx.restore()
  },
}
/** Texte au centre de l'anneau */
const centre: Plugin<'doughnut', { haut: string; bas: string }> = {
  id: 'centre',
  afterDatasetsDraw: (c, _a, { haut, bas }) => {
    const m = c.getDatasetMeta(0).data[0] as unknown as { x: number; y: number } | undefined
    if (!m) return
    const { ctx } = c
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = police(12, 500); ctx.fillStyle = SITE.douce; ctx.fillText(haut, m.x, m.y - 14)
    ctx.font = police(22, 600, "'Source Serif 4 Variable', Georgia, serif"); ctx.fillStyle = SITE.encre; ctx.fillText(bas, m.x, m.y + 8)
    ctx.restore()
  },
}

const ANNEES = Array.from({ length: 2025 - 1981 + 1 }, (_, i) => 1981 + i)
const UNE_HEURE = 1000 * 60 * 60
const CATEGORIES = [
  { id: 'cereales', nom: 'Céréales', motif: /mil|sorgho|mais|riz|fonio|ble/ },
  { id: 'legumineuses', nom: 'Arachide et légumineuses', motif: /arachide|niebe|sesame|soja|pois|haricot/ },
  { id: 'autres', nom: 'Autres cultures', motif: /.*/ },
] as const
const categorieDe = (c: string) => CATEGORIES.find((k) => k.motif.test(codeCulture(c)))!.id

const COLLES: Record<string, string> = { malemhodar: 'Malem-Hodar', malemehodar: 'Malème-Hodar', medinayorofoula: 'Médina Yoro Foula', niorodurip: 'Nioro du Rip', ranerouferlo: 'Ranérou-Ferlo' }
const nomLieu = (n: string) => COLLES[n.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()] ?? n
const nd = (v: number | null | undefined, unite = '', decimales = 0, signe = false) =>
  v === null || v === undefined || !Number.isFinite(v) ? NON_DISPONIBLE : nombre(v, { unite, decimales, signe })
/** « de mil », « d'arachide » */
const de = (mot: string) => (/^[aeiouyhâéèêîïôû]/i.test(mot) ? `d'${mot}` : `de ${mot}`)
const sansErreur = <T,>(p: Promise<T>) => p.catch(() => null)

export interface KpiTableau { titre: string; valeur: string; phrase: string; teinte?: string; tendance?: number | null }
export interface EtatTableau { titre: string; filtres: string; kpi: KpiTableau[]; graphiques: { titre: string; sousTitre: string; image: string | null; source: string }[] }

// ---------------------------------------------------------------- briques visuelles

/** « 12 345 kg/ha » → valeur « 12 345 », unité « kg/ha » (l'unité est affichée plus petite) */
const decouper = (v: string) => { const m = /^(.*\d)\s([^\d\s]+)$/.exec(v); return m ? [m[1], m[2]] : [v, ''] }

function Tuile({ titre, valeur, phrase, icone: Icone, teinte, fond, tendance }: KpiTableau & { icone: LucideIcon; teinte: string; fond: string }) {
  const [chiffre, unite] = decouper(valeur)
  const vide = valeur === NON_DISPONIBLE
  return (
    <article className="flex flex-col rounded-2xl border border-trait bg-carte p-5 shadow-[0_1px_2px_rgb(29_42_34/0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgb(29_42_34/0.35)]">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: fond, color: teinte }}><Icone className="size-5" aria-hidden /></span>
        <h3 className="text-md font-medium text-encre-douce">{titre}</h3>
      </div>
      <p className={`mt-4 font-titre leading-none font-semibold tracking-tight text-encre tabular-nums ${vide ? 'text-xl text-encre-douce!' : 'text-[2.25rem]'}`}>
        {chiffre}{unite && <span className="ml-1.5 font-sans text-base font-medium text-encre-douce">{unite}</span>}
      </p>
      <div className="mt-3 flex flex-1 items-start gap-2 text-sm leading-relaxed text-encre-douce">
        {tendance !== undefined && tendance !== null && Number.isFinite(tendance) && (
          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tendance >= 0 ? 'bg-vert-50 text-vert-700' : 'bg-alerte-100 text-alerte-700'}`}>
            {tendance >= 0 ? '↑' : '↓'} {nd(Math.abs(tendance), '%')}
          </span>
        )}
        <span>{phrase}</span>
      </div>
    </article>
  )
}

function Panneau({ titre, sousTitre, source, children, className = '' }: { titre: string; sousTitre: string; source: string; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col rounded-2xl border border-trait bg-carte p-5 shadow-[0_1px_2px_rgb(29_42_34/0.04)] sm:p-6 ${className}`}>
      <h2 className="font-titre text-xl font-semibold text-encre">{titre}</h2>
      <p className="mt-1 text-sm leading-relaxed text-encre-douce">{sousTitre}</p>
      <div className="relative mt-5 mb-4 h-80 shrink-0">{children}</div>
      <p className="mt-auto flex gap-1.5 border-t border-trait pt-3 text-2xs text-encre-douce"><Info className="mt-0.5 size-3 shrink-0" aria-hidden />{source}</p>
    </section>
  )
}

const Vide = ({ texte }: { texte: string }) => <div className="grid h-full place-items-center rounded-xl bg-sol text-center text-sm text-encre-douce"><p className="max-w-xs px-4">{texte}</p></div>
const Attente = () => <div aria-busy aria-label="Chargement" className="h-full animate-pulse rounded-xl bg-sol" />

function Choix({ libelle, valeur, changer, children }: { libelle: string; valeur: string; changer: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-2xs font-semibold tracking-[0.08em] text-encre-douce uppercase">{libelle}</span>
      <select className="h-11 w-full min-w-0 cursor-pointer rounded-xl border border-trait bg-carte px-3 text-md font-medium text-encre transition outline-none hover:border-vert-500/60 focus-visible:border-vert-500 focus-visible:ring-2 focus-visible:ring-vert-100"
        value={valeur} onChange={(e) => changer(e.target.value)}>{children}</select>
    </label>
  )
}

const grille = '#eee9df'
const axes = (unite = ''): ChartOptions<'bar' | 'line'>['scales'] => ({
  x: { grid: { display: false }, border: { color: SITE.trait }, ticks: { maxRotation: 0, autoSkipPadding: 14 } },
  y: { grid: { color: grille }, border: { display: false }, ticks: { padding: 8, callback: (v) => `${nombre(Number(v))}${unite}` } },
})
const infobulle = { backgroundColor: SITE.encre, padding: 12, cornerRadius: 10, titleFont: { weight: 600 as const, size: 13 }, bodyFont: { size: 12 }, boxPadding: 5, usePointStyle: true }

// ---------------------------------------------------------------- page

export default function Climat45() {
  useMeta({ titrePage: PAGES.observatoire.titre, description: PAGES.observatoire.description })
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const [params, setParams] = useSearchParams()
  const filtresQ = useFiltresObs()
  const brut = filtresQ.data?.donnees
  const filtres = useMemo(() => brut && { ...brut, zones: brut.zones.map((z) => ({ ...z, nom: nomLieu(z.nom) })) }, [brut])
  const gPluie = useRef<ChartJS<'bar'>>(null), gRendement = useRef<ChartJS<'line'>>(null), gCultures = useRef<ChartJS<'doughnut'>>(null), gTop = useRef<ChartJS<'bar'>>(null)
  const [enCours, setEnCours] = useState(false)

  // ---- Filtres (dans l'URL : vue partageable)
  const derniereObs = Math.min(filtres?.annees[filtres.annees.length - 1] ?? 2024, 2025)
  const annee = ANNEES.includes(Number(params.get('annee'))) ? Number(params.get('annee')) : Math.min(derniereObs, filtres?.derniere_annee_departements ?? 2021)
  const regions = (filtres?.zones ?? []).filter((z) => z.niveau === 'REGION').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const region = regions.find((z) => z.code === params.get('region')) ?? null
  const departements = (filtres?.zones ?? []).filter((z) => z.niveau === 'DEPARTEMENT' && (!region || z.code_region === region.code)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const departement = departements.find((z) => z.code === params.get('zone')) ?? null
  const pays = filtres?.zones.find((z) => z.niveau === 'PAYS') ?? null
  const zone: ZoneObs | null = departement ?? region ?? pays
  const categorie = CATEGORIES.some((c) => c.id === params.get('categorie')) ? params.get('categorie')! : ''
  const cultures = (filtres?.cultures ?? []).filter((c) => !categorie || categorieDe(c.culture) === categorie)
  const culture: CultureObs | null = cultures.find((c) => codeCulture(c.culture) === params.get('culture')) ?? cultures.find((c) => codeCulture(c.culture) === 'mil') ?? cultures[0] ?? null
  const changer = (cle: string, v: string, effacer: string[] = []) => setParams((p) => {
    const s = new URLSearchParams(p)
    if (v) s.set(cle, v); else s.delete(cle)
    for (const e of effacer) s.delete(e)
    return s
  }, { replace: true })
  const servie = (c: CultureObs | null) => Boolean(c && zone && (zone.niveau === 'DEPARTEMENT' || c.a_totaux))
  const anneeObs = annee <= derniereObs
  const lieu = zone ? (zone.niveau === 'PAYS' ? 'Sénégal' : zone.niveau === 'REGION' ? `Région de ${zone.nom}` : zone.nom) : 'Sénégal'
  const aLieu = zone && zone.niveau !== 'PAYS' ? (zone.niveau === 'REGION' ? `dans la région de ${zone.nom}` : `à ${zone.nom}`) : 'au Sénégal'
  const nomC = culture ? nomCulture(culture.culture) : ''
  const petit = nomC.toLowerCase()

  // ---- Données réelles
  const indicQ = useQueries({
    queries: cultures.map((c) => ({
      queryKey: ['obs', 'indicateurs', annee, codeCulture(c.culture), zone?.code],
      queryFn: () => sansErreur(api.observatoire.indicateurs(annee, codeCulture(c.culture), zone!.code)),
      enabled: Boolean(zone) && anneeObs && servie(c), staleTime: UNE_HEURE,
    })),
  })
  const indicDe = (c: CultureObs | null) => (c ? indicQ[cultures.indexOf(c)]?.data?.donnees ?? null : null)
  const ind = indicDe(culture)
  const valeur = (k: string) => ind?.indicateurs.find((x) => x.indicateur === k) ?? null
  const serieQ = useQuery({
    queryKey: ['obs', 'serie', culture && codeCulture(culture.culture), 'rendement', zone?.code],
    queryFn: () => sansErreur(api.observatoire.serie(codeCulture(culture!.culture), 'rendement', zone!.code)),
    enabled: Boolean(culture && zone) && servie(culture), staleTime: UNE_HEURE,
  })
  const anneeClassement = Math.min(annee, filtres?.derniere_annee_departements ?? 2021)
  const topQ = useQuery({
    queryKey: ['obs', 'classement', anneeClassement, culture && codeCulture(culture.culture), 'production'],
    queryFn: () => sansErreur(api.observatoire.classement(anneeClassement, codeCulture(culture!.culture), 'production')),
    enabled: Boolean(culture), staleTime: UNE_HEURE,
  })
  const pluies = usePluies()

  // ---- Calculs d'affichage (moyennes des départements du lieu, rien d'inventé)
  const lignesZone = zone ? dansZone(pluies.lignes, zone) : []
  const annees = parAnnee(lignesZone)
  /** pluie d'une année normale (1991-2020), moyenne des départements du lieu */
  const normaleZone = moyenne(lignesZone.map((l) => l.pluie_saison_normale_mm))
  const pluieAnnee = annees.find((a) => a.annee === annee) ?? null
  const parCulture = cultures.map((c) => ({ c, prod: indicDe(c)?.indicateurs.find((x) => x.indicateur === 'production')?.valeur ?? null })).filter((x) => x.prod !== null && x.prod > 0).sort((a, b) => b.prod! - a.prod!)
  const totalProd = parCulture.reduce((t, x) => t + x.prod!, 0)
  const top = (topQ.data?.donnees ?? []).filter((d) => !region || filtres?.zones.find((z) => z.code === d.code_departement)?.code_region === region.code).slice(0, 10)
  const prod = valeur('production'), surf = valeur('surface'), rdt = valeur('rendement')
  const fao = ind?.rendement_faostat?.rendement_kg_ha ?? null
  const classePluie = classeDe(pluieAnnee?.ecart ?? null)
  const sansDonnee = `Pas de donnée pour ${annee}.`

  const kpi: (KpiTableau & { icone: LucideIcon; teinte: string; fond: string })[] = [
    { titre: 'Production', valeur: nd(prod?.valeur, 't'), tendance: prod?.variation_n1_pct, icone: Wheat, teinte: SITE.terre700, fond: SITE.terre100,
      phrase: !servie(culture) ? 'Pas de total ici : choisissez un département.' : prod?.valeur == null ? sansDonnee : `${de(petit)} récoltées en ${annee}, comparé à ${annee - 1}.` },
    { titre: 'Surface cultivée', valeur: nd(surf?.valeur, 'ha'), icone: LandPlot, teinte: SITE.vert700, fond: SITE.vert50,
      phrase: surf?.valeur == null ? sansDonnee : `de champs semés en ${petit}.` },
    { titre: 'Rendement', valeur: nd(rdt?.valeur ?? (zone?.niveau === 'PAYS' ? fao : null), 'kg/ha'), tendance: rdt?.ecart_moyenne_10_ans_pct, icone: Sprout, teinte: SITE.vert500, fond: SITE.vert100,
      phrase: rdt?.valeur != null ? 'récoltés par hectare, comparé aux 10 années précédentes.' : fao !== null && zone?.niveau === 'PAYS' ? 'récoltés par hectare (FAOSTAT, chiffre national).' : sansDonnee },
    { titre: 'Pluie de la saison', valeur: nd(pluieAnnee?.pluie, 'mm'), tendance: pluieAnnee?.ecart, icone: CloudRain, teinte: SITE.pluie700, fond: SITE.pluie100,
      phrase: pluieAnnee?.pluie == null ? sansDonnee : `de juin à octobre : ${classePluie?.texte ?? 'écart inconnu'}, comparé à une année normale.` },
  ]

  // ---- Graphiques
  const donneesPluie = {
    labels: ANNEES_PLUIE,
    datasets: [{
      label: 'Pluie de la saison',
      data: ANNEES_PLUIE.map((a) => annees.find((x) => x.annee === a)?.pluie ?? null),
      backgroundColor: (ctx: ScriptableContext<'bar'>) => {
        const a = ANNEES_PLUIE[ctx.dataIndex]
        const c = COULEUR_PLUIE[classeDe(annees.find((x) => x.annee === a)?.ecart ?? null)?.libelle ?? ''] ?? '#d9d3c5'
        return degrade(ctx, c, false, a === annee ? 'aa' : '55')
      },
      hoverBackgroundColor: (ctx: ScriptableContext<'bar'>) => COULEUR_PLUIE[classeDe(annees.find((x) => x.annee === ANNEES_PLUIE[ctx.dataIndex])?.ecart ?? null)?.libelle ?? ''] ?? '#d9d3c5',
      borderColor: ANNEES_PLUIE.map((a) => (a === annee ? SITE.encre : 'transparent')),
      borderWidth: ANNEES_PLUIE.map((a) => (a === annee ? 2 : 0)), borderRadius: { topLeft: 5, topRight: 5 }, borderSkipped: false as const, categoryPercentage: 0.86, barPercentage: 0.92,
    }],
  }
  const points = serieQ.data?.donnees.points ?? []
  const faoSerie = serieQ.data?.donnees.serie_faostat ?? []
  const etiquettesRdt = Array.from(new Set([...points.map((p) => p.annee), ...faoSerie.map((p) => p.annee)])).sort((a, b) => a - b)
  const donneesRdt = {
    labels: etiquettesRdt,
    datasets: [
      { label: lieu, data: etiquettesRdt.map((a) => points.find((p) => p.annee === a)?.valeur ?? null), borderColor: SITE.vert500, borderWidth: 3, backgroundColor: (ctx: ScriptableContext<'line'>) => degrade(ctx, SITE.vert500, false, '00', '55'), fill: 'origin' as const, tension: 0.38, pointHoverBackgroundColor: SITE.vert700,
        pointRadius: etiquettesRdt.map((a) => (a === annee ? 6 : 0)), pointHoverRadius: 6, pointBackgroundColor: SITE.soleil500, pointBorderColor: '#fff', pointBorderWidth: 2, spanGaps: false },
      ...(zone?.niveau === 'PAYS' && faoSerie.length ? [{ label: 'Sénégal (FAOSTAT)', data: etiquettesRdt.map((a) => faoSerie.find((p) => p.annee === a)?.rendement_kg_ha ?? null), borderColor: SITE.terre500, borderWidth: 2, borderDash: [6, 5], pointRadius: 0, tension: 0.35, fill: false, spanGaps: false }] : []),
    ],
  }
  const donneesCultures = { labels: parCulture.map((x) => nomCulture(x.c.culture)), datasets: [{ data: parCulture.map((x) => x.prod), backgroundColor: PALETTE, borderColor: '#fff', borderWidth: 2, hoverOffset: 16, borderRadius: 6, spacing: 3 }] }
  const donneesTop = { labels: top.map((d) => nomLieu(d.departement)), datasets: [{ label: 'Production', data: top.map((d) => d.valeur), backgroundColor: (ctx: ScriptableContext<'bar'>) => degrade(ctx, top[ctx.dataIndex]?.code_departement === departement?.code ? SITE.soleil500 : SITE.vert700, true, '80'), borderRadius: 6, borderSkipped: false as const, categoryPercentage: 0.8, barPercentage: 0.85 }] }

  const plPluie = [ombre as Plugin<'bar'>, repereHorizontal as Plugin<'bar'>]
  const indexAnnee = etiquettesRdt.indexOf(annee)
  const plRendement = [ombre as Plugin<'line'>, repereAnnee as Plugin<'line'>]
  const plTop = [ombre as Plugin<'bar'>, valeursAuBout]
  const totalTexte = nd(totalProd, 't')
  const plCultures = [ombre as Plugin<'doughnut'>, centre as Plugin<'doughnut'>]
  const baseBarres: ChartOptions<'bar'> = { responsive: true, maintainAspectRatio: false, animation: { duration: 600 }, plugins: { legend: { display: false }, tooltip: infobulle } }
  const barresH: ChartOptions<'bar'> = { ...baseBarres, indexAxis: 'y', layout: { padding: { right: 64 } }, scales: { x: { grid: { color: grille }, border: { display: false }, ticks: { callback: (v) => nombre(Number(v)) } }, y: { grid: { display: false }, border: { display: false }, ticks: { autoSkip: false, color: SITE.encre, font: { weight: 500 } } } },
    plugins: { ...baseBarres.plugins, tooltip: { ...infobulle, callbacks: { label: (c) => ` ${nd(c.parsed.x, 't')}` } } } }

  const sources = {
    pluie: "Pluie : CHIRPS 1981-2025, moyenne des départements du lieu choisi. Couleur : écart avec une année normale (1991-2020).",
    rendement: `Rendement : ${serieQ.data?.meta.source ?? NON_DISPONIBLE}, par département jusqu'en ${filtres?.derniere_annee_departements ?? 2021}${zone?.niveau === 'PAYS' ? ' ; FAOSTAT pour le pays' : ''}.`,
    cultures: `Production : ${indicQ.find((q) => q.data)?.data?.meta.source ?? NON_DISPONIBLE}, ${annee}.`,
    top: `Classement : ${topQ.data?.meta.source ?? NON_DISPONIBLE}, ${anneeClassement}.`,
  }
  const textes = {
    pluie: { titre: 'Pluie de chaque saison', sousTitre: `${lieu}, 1981-2025. Brun : moins de pluie que d'habitude. Bleu : plus. Cliquez sur une barre pour choisir l'année.` },
    rendement: { titre: `Rendement de ${petit} depuis 1981`, sousTitre: `Kilos récoltés par hectare, ${aLieu}. Le point jaune marque ${annee}.` },
    cultures: { titre: `Ce qui est cultivé, ${annee}`, sousTitre: `Part de chaque culture dans la production ${aLieu}.` },
    top: { titre: `Les 10 premiers producteurs ${de(petit)}`, sousTitre: `Départements ${region ? `de la région de ${region.nom}` : 'du Sénégal'}, ${anneeClassement}${anneeClassement !== annee ? ' (dernière année connue)' : ''}. Cliquez pour choisir un département.` },
  }

  const exporter = async () => {
    if (enCours) return
    setEnCours(true)
    try {
      const img = (g: { current: ChartJS<'bar'> | ChartJS<'line'> | ChartJS<'doughnut'> | null }) => g.current?.toBase64Image('image/png', 1) ?? null
      const { exporterTableau } = await import('./exportClimat')
      await exporterTableau({
        titre: 'Tableau de bord agricole du Sénégal', filtres: `${lieu} · ${nomC} · ${annee}`,
        kpi: kpi.map(({ titre, valeur, phrase, teinte, tendance }) => ({ titre, valeur, phrase, teinte, tendance })),
        graphiques: [
          { ...textes.pluie, image: img(gPluie), source: sources.pluie },
          { ...textes.cultures, image: img(gCultures), source: sources.cultures },
          { ...textes.rendement, image: img(gRendement), source: sources.rendement },
          { ...textes.top, image: img(gTop), source: sources.top },
        ],
      })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="min-h-dvh bg-sol font-sans text-encre">
      {/* En-tête, aux couleurs du site */}
      <header className="border-b border-trait bg-carte">
        <div className="mx-auto flex max-w-[88rem] items-center gap-3 px-4 py-3 sm:px-8">
          <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-encre-douce transition hover:bg-vert-50 hover:text-vert-700" aria-label="Retour à l'accueil">
            <ArrowLeft className="size-4" aria-hidden /><span className="max-sm:sr-only">Accueil</span>
          </Link>
          <span className="h-6 w-px bg-trait" aria-hidden />
          <img src="/favicon.svg" alt="" className="size-8 rounded-[10px]" />
          <span className="font-titre text-lg font-semibold max-sm:sr-only"><span className="text-pluie-500">Assaman</span> & <span className="text-terre-500">Suuf</span></span>
          <button type="button" onClick={exporter} disabled={enCours || !filtres}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl bg-vert-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-vert-900 disabled:opacity-50">
            {enCours ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileDown className="size-4" aria-hidden />}{enCours ? 'Préparation…' : 'Télécharger le rapport PDF'}
          </button>
        </div>
      </header>

      {/* Titre */}
      <div className="mx-auto max-w-[88rem] px-4 pt-10 pb-6 sm:px-8 sm:pt-12">
        <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.18em] text-vert-700 uppercase">
          <span className="h-px w-8 bg-vert-500/60" aria-hidden />Tableau de bord · données réelles 1981-2025
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-titre text-titre-recit font-semibold text-balance text-encre">{lieu} · {nomC} · {annee}</h1>
          <p className="max-w-md text-md leading-relaxed text-encre-douce">Production, surfaces, rendement et pluie, mesurés chaque saison. Une valeur absente est indiquée « {NON_DISPONIBLE} ».</p>
        </div>
        {filtresQ.isError && <p role="alert" className="mt-4 rounded-xl bg-alerte-100 px-4 py-3 text-sm text-alerte-700">{filtresQ.error.message}</p>}
      </div>

      {/* Bande de filtres */}
      <div className="sticky top-0 z-30 border-y border-trait bg-sol/90 backdrop-blur-md" role="region" aria-label="Filtres">
        <div className="mx-auto grid max-w-[88rem] grid-cols-2 items-end gap-3 px-4 py-3.5 sm:px-8 md:grid-cols-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <Choix libelle="Année" valeur={String(annee)} changer={(v) => changer('annee', v)}>
            {[...ANNEES].reverse().map((a) => <option key={a} value={a}>{a}</option>)}
          </Choix>
          <Choix libelle="Région" valeur={region?.code ?? ''} changer={(v) => changer('region', v, ['zone'])}>
            <option value="">Tout le Sénégal</option>
            {regions.map((r) => <option key={r.code} value={r.code}>{r.nom}</option>)}
          </Choix>
          <Choix libelle="Département" valeur={departement?.code ?? ''} changer={(v) => changer('zone', v)}>
            <option value="">{region ? 'Toute la région' : 'Tous'}</option>
            {departements.map((d) => <option key={d.code} value={d.code}>{d.nom}</option>)}
          </Choix>
          <Choix libelle="Catégorie" valeur={categorie} changer={(v) => changer('categorie', v, ['culture'])}>
            <option value="">Toutes</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </Choix>
          <Choix libelle="Culture" valeur={culture ? codeCulture(culture.culture) : ''} changer={(v) => changer('culture', v)}>
            {cultures.map((c) => <option key={c.culture} value={codeCulture(c.culture)}>{nomCulture(c.culture)}</option>)}
          </Choix>
          <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })} title="Revenir aux filtres par défaut"
            className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-trait bg-carte px-4 text-sm font-medium text-encre-douce transition hover:border-vert-500/60 hover:text-vert-700 md:col-span-1">
            <RotateCcw className="size-4" aria-hidden />Réinitialiser
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-[88rem] space-y-6 px-4 pt-8 pb-24 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpi.map((k) => <Tuile key={k.titre} {...k} />)}</div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panneau className="lg:col-span-2" {...textes.pluie} source={sources.pluie}>
            {pluies.pret ? <Bar ref={gPluie} data={donneesPluie} plugins={plPluie} options={{ ...baseBarres, scales: axes(' mm') as ChartOptions<'bar'>['scales'],
              plugins: { ...baseBarres.plugins, repereHorizontal: { valeur: normaleZone, texte: `Année normale : ${nd(normaleZone, 'mm')}` }, tooltip: { ...infobulle, callbacks: { title: (c) => `Saison ${c[0].label}`, label: (c) => ` ${nd(c.parsed.y, 'mm')}`, afterLabel: (c) => ` ${classeDe(annees.find((x) => x.annee === ANNEES_PLUIE[c.dataIndex])?.ecart ?? null)?.texte ?? ''}` } } },
              onClick: (_e, el) => { if (el[0]) changer('annee', String(ANNEES_PLUIE[el[0].index])) } }} /> : <Attente />}
          </Panneau>
          <Panneau {...textes.cultures} source={sources.cultures}>
            {!anneeObs ? <Vide texte={`Pas de production connue pour ${annee}.`} /> : indicQ.some((q) => q.isPending && q.fetchStatus !== 'idle') ? <Attente /> : parCulture.length ? (
                <Doughnut ref={gCultures} data={donneesCultures} plugins={plCultures} options={{ responsive: true, maintainAspectRatio: false, cutout: '66%', radius: '94%', layout: { padding: 6 },
                  plugins: { centre: { haut: `Total ${annee}`, bas: totalTexte }, legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 12, color: SITE.encre } },
                    tooltip: { ...infobulle, callbacks: { label: (c) => ` ${nd(c.parsed, 't')} (${nd(totalProd ? (c.parsed / totalProd) * 100 : null, '%')})` } } } }} />
            ) : <Vide texte="Pas de production connue cette année ici." />}
          </Panneau>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panneau className="lg:col-span-2" {...textes.rendement} source={sources.rendement}>
            {!servie(culture) ? <Vide texte={`${nomC} : pas de total pour ce lieu, choisissez un département.`} /> : serieQ.isPending ? <Attente /> : etiquettesRdt.length ? (
              <Line ref={gRendement} data={donneesRdt} plugins={plRendement} options={{ responsive: true, maintainAspectRatio: false, animation: { duration: 700 }, interaction: { mode: 'index', intersect: false },
                plugins: { repereAnnee: { index: indexAnnee }, legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'line', padding: 16, color: SITE.encre } }, tooltip: { ...infobulle, callbacks: { label: (c) => ` ${c.dataset.label} : ${nd(c.parsed.y, 'kg/ha')}` } } },
                scales: axes(' kg') as ChartOptions<'line'>['scales'] }} />
            ) : <Vide texte="Pas de rendement connu ici." />}
          </Panneau>
          <Panneau {...textes.top} source={sources.top}>
            {topQ.isPending ? <Attente /> : top.length ? <Bar ref={gTop} data={donneesTop} plugins={plTop} options={{ ...barresH, onClick: (_e, el) => { if (el[0]) changer('zone', top[el[0].index].code_departement) } }} /> : <Vide texte="Pas de classement pour cette culture." />}
          </Panneau>
        </div>
      </main>
      <PiedDePage />
    </div>
  )
}
