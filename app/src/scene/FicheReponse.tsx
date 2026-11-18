// La fiche commune des 6 fonctionnalités de l'agriculteur : l'essentiel en 5 secondes.
// De haut en bas : la question et les choix (puces), la réponse en gros, 1 à 3 lignes à cocher, le détail replié,
// puis un pied collé en bas : écouter (français, wolof) et passer à la question suivante.
import clsx from 'clsx'
import { ArrowRight, Check, ChevronDown, Loader2, Square, TriangleAlert, X } from 'lucide-react'
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { PARCOURS_AGRICULTEUR, type Cadre, type ModeAgriculteur } from './cadre'
import type { EtatLigne, LigneCheck, Puce } from './fiche'
import { arreter, lectureDisponible, lire, lireWolof, pourLOreille, useQuiParle, type Parleur } from './lecture'
import { Fille, Garcon } from './Mascottes'
import { Lien } from './ui'

const PASTILLES: Record<EtatLigne, { Icone: typeof Check | null; classe: string; dit: string }> = {
  ok: { Icone: Check, classe: 'bg-vert-500 text-white', dit: 'Bon' },
  attention: { Icone: TriangleAlert, classe: 'bg-soleil-500 text-encre-nuit', dit: 'Attention' },
  non: { Icone: X, classe: 'bg-alerte-500 text-white', dit: 'Non' },
  // un fait sans règle validée : un point neutre, sans couleur de verdict
  info: { Icone: null, classe: 'bg-white/10 text-white/70', dit: 'À savoir' },
}

function Texte({ texte }: { texte: string }) {
  return <>{texte.split(/\*\*(.+?)\*\*/).map((m, i) => (i % 2 ? <strong key={i} className="font-semibold text-white">{m}</strong> : <Fragment key={i}>{m}</Fragment>))}</>
}

/** Les deux boutons d'écoute : les mascottes (mêmes avatars, même lecture, une seule voix à la fois), en cibles de 44 px. */
function Ecoute({ fr, wo }: { fr?: string[]; wo?: string[] }) {
  const qui = useQuiParle()
  const [attente, setAttente] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const parlerWolof = async () => {
    const texte = (wo ?? []).join(' ')
    if (!texte) return
    setMessage(null)
    try {
      await lireWolof(texte, () => {
        setAttente(true)
        setMessage('La voix wolof se prépare : quelques secondes.')
      })
      setMessage(null)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'La voix wolof ne répond pas.')
    } finally {
      setAttente(false)
    }
  }
  const bouton = (p: Parleur, Tete: () => React.JSX.Element, libelle: string, pret: boolean, agir: () => void) => {
    const parle = qui === p
    return (
      <button type="button" disabled={!pret && !parle} aria-pressed={parle} onClick={() => (parle ? arreter() : agir())}
        aria-label={parle ? `Arrêter la lecture ${p === 'fr' ? 'en français' : 'en wolof'}` : `${libelle} : l’essentiel ${p === 'fr' ? 'en français' : 'en wolof'}`}
        className={clsx('relative grid size-11 shrink-0 place-items-center rounded-full transition disabled:opacity-35', parle ? 'ecoute-en-cours ring-2 ring-white' : 'hover:scale-105')}>
        <span className="size-10 overflow-hidden rounded-full"><Tete /></span>
        {(parle || (p === 'wo' && attente)) && (
          <span className="absolute inset-0.5 grid place-items-center rounded-full bg-encre-nuit/55">
            {p === 'wo' && attente ? <Loader2 className="size-4 animate-spin text-white" aria-hidden /> : <Square className="size-3.5 fill-white text-white" aria-hidden />}
          </span>
        )}
        <span className={clsx('absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[0.6rem] leading-4 font-bold tracking-wide', p === 'fr' ? 'bg-pluie-500 text-white' : 'bg-soleil-500 text-encre-nuit')}>{p === 'fr' ? 'FR' : 'WLF'}</span>
      </button>
    )
  }
  return (
    <div className="relative flex shrink-0 items-center gap-1.5">
      {lectureDisponible && bouton('fr', Garcon, 'Écouter', Boolean(fr?.length), () => lire((fr ?? []).map(pourLOreille)))}
      {wo?.length ? bouton('wo', Fille, 'Wolof', !attente, () => void parlerWolof()) : null}
      {message && (
        <p role="status" className="absolute bottom-full left-0 z-10 mb-2 w-60 rounded-lg bg-encre-nuit px-3 py-2 text-xs text-white/80 shadow-lg">
          {message}
          <button type="button" onClick={() => setMessage(null)} className="ml-2 min-h-6 text-white underline">OK</button>
        </p>
      )}
    </div>
  )
}

interface PropsFiche {
  cadre: Cadre
  mode: ModeAgriculteur
  puces?: Puce[]
  titre: string
  /** la couleur du verdict ; blanc par défaut */
  teinte?: string
  lignes: LigneCheck[]
  /** au-dessus du titre (« Me localiser ») */
  avant?: ReactNode
  /** sous le titre : chargement, avis, culture remplacée */
  etat?: ReactNode
  /** tout le reste ; absent : pas de bouton « Voir le détail » */
  detail?: ReactNode
  /** change avec le département, l'année ou la culture : le détail et les menus se referment */
  cle: string
  aEcouter?: string[]
  aEcouterWo?: string[]
  /** la culture montrée ; sans culture choisie, « Suivant » la transmet : l'écran suivant parle de la même */
  culture?: string | null
}

export function FicheReponse({ cadre, mode, puces = [], titre, teinte, lignes, avant, etat, detail, cle, aEcouter, aEcouterWo, culture }: PropsFiche) {
  const i = PARCOURS_AGRICULTEUR.findIndex((p) => p.id === mode)
  const question = PARCOURS_AGRICULTEUR[i].question
  const suivant = PARCOURS_AGRICULTEUR[i + 1]
  // Ouvert pour une clé donnée : changer de département, d'année ou de culture le referme
  const [detailPour, setDetailPour] = useState<string | null>(null)
  const ouvert = detailPour === cle
  // Un seul menu ouvert à la fois ; il se ferme par Échap, un clic à côté ou un choix fait
  const [menuOuvert, setMenu] = useState<string | null>(null)
  const entete = useRef<HTMLDivElement>(null)
  const idMenu = useId()
  const fermer = () => {
    const id = menuOuvert
    setMenu(null)
    document.getElementById(`${idMenu}-${id}`)?.focus()
  }
  const idDetail = useId()

  // Un clic à côté ferme le menu ; Échap aussi, avant que la fenêtre ne le prenne pour elle (réduire, replier)
  useEffect(() => {
    if (!menuOuvert) return
    const clic = (e: PointerEvent) => {
      if (!entete.current?.contains(e.target as Node)) setMenu(null)
    }
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setMenu(null)
      document.getElementById(`${idMenu}-${menuOuvert}`)?.focus()
    }
    document.addEventListener('pointerdown', clic)
    window.addEventListener('keydown', touche, true)
    return () => {
      document.removeEventListener('pointerdown', clic)
      window.removeEventListener('keydown', touche, true)
    }
  }, [menuOuvert, idMenu])
  const puceOuverte = puces.find((p) => p.id === menuOuvert)
  // Une autre réponse (département, année, culture) se lit depuis le haut
  useEffect(() => {
    entete.current?.closest('.overflow-y-auto')?.scrollTo({ top: 0 })
  }, [cle])

  return (
    <div>
      <div ref={entete} className="relative">
        {/* Une ligne ; si les puces n'y tiennent pas à côté de la question, elles passent dessous, à droite */}
        <div className={clsx('flex flex-wrap items-center gap-x-2 gap-y-1', puces.length > 0 && 'min-h-11')}>
          <p className="max-w-full text-xs font-medium text-white/60">{question}</p>
          {puces.length > 0 && <div className="ml-auto flex flex-wrap justify-end gap-1.5">{puces.map((p) => (
            <button key={p.id} type="button" id={`${idMenu}-${p.id}`} data-puce={p.id} onClick={() => setMenu(menuOuvert === p.id ? null : p.id)}
              aria-expanded={menuOuvert === p.id} aria-controls={menuOuvert === p.id ? idMenu : undefined} aria-label={`${p.nom} : ${p.libelle}. Changer`}
              className={clsx('inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition',
                menuOuvert === p.id ? 'border-soleil-500 text-soleil-500' : 'border-white/15 text-white hover:border-white/40 hover:bg-white/5')}>
              {p.libelle}
              <ChevronDown className={clsx('size-3.5 shrink-0 transition-transform', menuOuvert === p.id && 'rotate-180')} aria-hidden />
            </button>
          ))}</div>}
        </div>
        {puceOuverte && (
          <div id={idMenu} role="dialog" aria-label={puceOuverte.nom} className="maj absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-white/15 bg-encre-nuit p-3 shadow-lg">
            {puceOuverte.contenu(fermer)}
          </div>
        )}
      </div>

      {avant}

      <div aria-live="polite" className="mt-2">
        <h2 key={titre} className="maj font-titre text-titre-fiche font-semibold text-white" style={teinte ? { color: teinte } : undefined}>{titre}</h2>
      </div>
      {etat}

      {lignes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {lignes.slice(0, 3).map((l) => {
            const { Icone, classe, dit } = PASTILLES[l.etat]
            return (
              <li key={l.texte} className="flex items-start gap-2.5 text-sm leading-snug text-white/80">
                <span className={clsx('mt-px grid size-5 shrink-0 place-items-center rounded-full', classe)} aria-hidden>{!Icone ? <span className="size-1.5 rounded-full bg-current" /> : <Icone className="size-3" strokeWidth={3} />}</span>
                <span className="min-w-0 flex-1"><span className="sr-only">{dit} : </span><Texte texte={l.texte} />
                  {l.lien && <> · <Lien compact onClick={() => cadre.aller(l.lien!.mode)}>{l.lien.libelle}</Lien></>}</span>
              </li>
            )
          })}
        </ul>
      )}

      {detail && (
        <div className="mt-4">
          <button type="button" onClick={() => setDetailPour(ouvert ? null : cle)} aria-expanded={ouvert} aria-controls={idDetail}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-white/20 bg-white/[0.04] px-3.5 text-sm font-medium text-white transition hover:border-white/45 hover:bg-white/[0.08]">
            {ouvert ? 'Masquer le détail' : 'Voir le détail'}
            <ChevronDown className={clsx('size-4 shrink-0 transition-transform duration-300', ouvert && 'rotate-180')} aria-hidden />
          </button>
          {ouvert && <div id={idDetail} className="maj">{detail}</div>}
        </div>
      )}

      <div className="sticky -bottom-4 z-10 -mx-4 mt-4 flex items-center gap-2 border-t border-white/[0.09] bg-encre-nuit px-4 py-2.5">
        <Ecoute fr={aEcouter} wo={aEcouterWo} />
        <button type="button" onClick={() => { if (culture && !cadre.culture) cadre.choisirCulture(culture); cadre.aller(suivant?.id ?? 'parcelle') }}
          className="ml-auto inline-flex min-h-11 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-lg bg-soleil-500 px-3 py-1 text-left text-xs leading-tight font-semibold text-encre-nuit transition hover:bg-soleil-100 active:scale-[0.98]">
          <span className="min-w-0">{suivant ? <>Suivant : {suivant.question}</> : 'Revenir à mon champ'}</span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </button>
      </div>
    </div>
  )
}
