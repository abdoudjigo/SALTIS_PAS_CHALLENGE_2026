// Guides vocaux, en tête du dock. Chaque guide signale (pastille qui pulse) tant que son introduction n'a pas été
// écoutée, puis à chaque écran ouvert pas encore expliqué. Rien n'est lu sans appui ; un appui pendant la lecture
// l'arrête. ONG : une voix française. Agriculteur : deux voix côte à côte, française (Garçon) et wolof (Fille).
import clsx from 'clsx'
import { Loader2, Pointer, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EXPLICATION_AGRI } from './guideAgri'
import { EXPLICATION_ONG, INTRO_ONG } from './guideOng'
import { arreter, decouper, lectureDisponible, lire, lireWolof, phrasesWo, pourLOreille, prechargerFr, prechargerWo, useQuiParle } from './lecture'
import { Fille, Garcon } from './Mascottes'
import { MESSAGES } from './voiceMessages'

type Langue = 'fr' | 'wo'

function lu(cle: string): boolean {
  try {
    return localStorage.getItem(cle) === '1'
  } catch {
    return false
  }
}
function retenir(cle: string) {
  try {
    localStorage.setItem(cle, '1')
  } catch {
    /* stockage indisponible : l'introduction sera reproposée à la prochaine visite */
  }
}

interface PropsGuide {
  langue: Langue
  /** clé localStorage : introduction écoutée */
  cleIntro: string
  intro: string[]
  /** l'explication de l'écran ouvert (vide : seulement son résumé) */
  explication: string[]
  /** le résumé de l'écran ouvert, dans la langue du guide */
  resume?: string[]
  actif: string
  titre: string
  nom: string
  compact?: boolean
  /** un doigt animé pointe vers le guide tant qu'il a quelque chose de nouveau à dire (agriculteur, wolof) */
  doigt?: boolean
}

function Guide({ langue, cleIntro, intro: texteIntro, explication, resume, actif, titre, nom, compact = false, doigt = false }: PropsGuide) {
  const qui = useQuiParle()
  const [intro, setIntro] = useState(() => lu(cleIntro))
  const [explique, setExplique] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [attente, setAttente] = useState(false)
  const [echec, setEchec] = useState(false)
  const lignes = (resume ?? []).filter(Boolean)
  const aDire = [...explication, ...(lignes.length ? [langue === 'wo' ? '' : 'Pour votre sélection :', ...lignes].filter(Boolean) : [])]
  const disponible = langue === 'fr' ? lectureDisponible : true
  const parle = enCours && qui === langue
  const pret = disponible && (!intro || aDire.length > 0)
  const signal = pret && (!intro || explique !== actif)
  const Tete = langue === 'fr' ? Garcon : Fille
  const libelle = parle ? `Arrêter ${nom}` : attente ? `${nom} : la voix se prépare` : !intro ? `${nom} : écouter l’introduction` : `${nom} : écouter « ${titre} »`

  // Les deux premières phrases de ce qui sera dit au prochain appui sont demandées d'avance au serveur, pour que la
  // voix parte dès l'appui. Wolof : toute l'introduction (fixe, calculée une fois pour tous les visiteurs) ; les
  // résumés changent avec chaque choix, les calculer d'avance occuperait le serveur pour rien.
  const prochain = langue === 'fr'
    ? (intro ? aDire : texteIntro).slice(0, 2).map(pourLOreille).flatMap(decouper).slice(0, 2)
    : intro ? [] : phrasesWo(texteIntro.join(' '))
  const clePrechargement = prochain.join('|')
  useEffect(() => {
    if (!clePrechargement) return
    const phrases = clePrechargement.split('|')
    const minuteur = window.setTimeout(() => (langue === 'fr' ? phrases.forEach(prechargerFr) : prechargerWo(phrases)), 800)
    return () => clearTimeout(minuteur)
  }, [clePrechargement, langue])

  const appuyer = async () => {
    if (parle) {
      arreter()
      setEnCours(false)
      return
    }
    let texte = aDire
    if (!intro) {
      texte = texteIntro
      retenir(cleIntro)
      setIntro(true)
    } else setExplique(actif)
    setEchec(false)
    setEnCours(true)
    if (langue === 'fr') return lire(texte.map(pourLOreille))
    try {
      await lireWolof(texte.join(' '), () => setAttente(true))
    } catch {
      setEchec(true)
      setEnCours(false)
    } finally {
      setAttente(false)
    }
  }

  const pastille = signal && !parle && !attente && (
    <span className="absolute top-0 right-0 flex size-3" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-soleil-500 opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-3 rounded-full bg-soleil-500" />
    </span>
  )
  // Le doigt bouge tant que le guide a du nouveau (introduction pas écoutée, ou écran pas encore lu) ; il disparaît
  // dès l'appui, et revient quand on ouvre une autre fonctionnalité
  const main = doigt && signal && !parle && !attente && (
    <Pointer className={clsx('doigt-guide pointer-events-none shrink-0 -rotate-90 text-soleil-500 drop-shadow', compact ? 'size-5' : 'absolute top-1/2 left-full ml-2 size-7 -translate-y-1/2')} aria-hidden />
  )
  const voile = (parle || attente) && (
    <span className="absolute inset-0 grid place-items-center bg-encre-nuit/55">
      {attente ? <Loader2 className="size-4 animate-spin text-white" /> : <Square className="size-3 fill-white text-white" />}
    </span>
  )
  const badge = <span className={clsx('absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[0.6rem] leading-4 font-bold tracking-wide', langue === 'fr' ? 'bg-pluie-500 text-white' : 'bg-soleil-500 text-encre-nuit')}>{langue === 'fr' ? 'FR' : 'WLF'}</span>

  if (compact)
    return (
      <button type="button" onClick={() => void appuyer()} disabled={!pret && !parle} aria-label={libelle} title={echec ? 'La voix wolof ne répond pas pour le moment.' : libelle}
        className={clsx('verre-scene relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg py-1 pr-3.5 pl-1.5 text-sm font-medium text-white disabled:opacity-40', parle && 'ecoute-en-cours')}>
        <span className="relative size-8 overflow-hidden rounded-full"><Tete />{voile}</span>
        {nom}{pastille}{main}
      </button>
    )

  return (
    <div className="relative">
      <button type="button" onClick={() => void appuyer()} disabled={!pret && !parle} aria-label={libelle} aria-pressed={parle}
        className={clsx('peer relative grid size-14 place-items-center rounded-xl border border-white/10 bg-white/[0.07] transition hover:bg-white/[0.16] disabled:opacity-40', parle && 'ecoute-en-cours')}>
        <span className="relative size-10 overflow-hidden rounded-full"><Tete />{voile}</span>
        {badge}{pastille}
      </button>
      {main}
      {echec && <span role="status" className="verre-scene absolute top-0 left-[calc(100%+1.25rem)] z-10 w-56 rounded-lg px-3.5 py-2.5 text-xs text-white/85">La voix wolof ne répond pas pour le moment. Réessayez dans un instant.</span>}
    </div>
  )
}

const bulle = (titre: string, texte: string) => (
  <span className="dock-bulle verre-scene absolute left-[calc(100%+1.25rem)] w-56 rounded-lg px-3.5 py-2.5">
    <span className="block text-sm font-medium text-white">{titre}</span>
    <span className="mt-0.5 block text-xs leading-relaxed text-white/75">{texte}</span>
  </span>
)

/** ONG : une voix française, en tête de la liste du dock (compact : en tête de la rangée du téléphone). */
export function GuideOng({ actif, titre, resume, compact = false }: { actif: string; titre: string; resume?: string[]; compact?: boolean }) {
  const guide = <Guide langue="fr" cleIntro="assaman.ong.intro.entendue" intro={INTRO_ONG} explication={EXPLICATION_ONG[actif as keyof typeof EXPLICATION_ONG] ?? []} resume={resume} actif={actif} titre={titre} nom="Guide" compact={compact} doigt />
  if (compact) return guide
  return (
    <li className="dock-item relative flex items-center border-b border-white/[0.09] pb-2">
      {guide}
      {bulle('Guide vocal', `Touchez-moi : je vous présente l’espace, puis j’explique « ${titre} ».`)}
    </li>
  )
}

/** Agriculteur : deux voix côte à côte, française et wolof, au-dessus du dock (compact : en tête de la rangée). */
export function GuidesAgri({ actif, titre, fr, wo, compact = false }: { actif: string; titre: string; fr?: string[]; wo?: string[]; compact?: boolean }) {
  const commun = { actif, titre, compact }
  const voixFr = <Guide langue="fr" cleIntro="assaman.agri.intro.fr" intro={MESSAGES.agriculteur.fr?.phrases ?? []} explication={EXPLICATION_AGRI[actif] ?? []} resume={fr} nom="Français" {...commun} />
  // Wolof : l'introduction est traduite à l'avance ; les écrans sont lus par leur résumé wolof
  const voixWo = <Guide langue="wo" cleIntro="assaman.agri.intro.wo" intro={MESSAGES.agriculteur.wo?.phrases ?? []} explication={[]} resume={wo} nom="Wolof" doigt {...commun} />
  if (compact) return <>{voixFr}{voixWo}</>
  return (
    <div className="dock-item group relative ml-3 flex items-center gap-2 rounded-2xl p-2 verre-scene pointer-events-auto">
      {voixFr}{voixWo}
      <span className="pointer-events-none absolute left-[calc(100%+1.25rem)] w-56 rounded-lg px-3.5 py-2.5 opacity-0 transition group-hover:opacity-100 verre-scene">
        <span className="block text-sm font-medium text-white">Guides vocaux</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-white/75">Touchez une voix, en français ou en wolof : elle vous présente l’espace, puis explique « {titre} ».</span>
      </span>
    </div>
  )
}
