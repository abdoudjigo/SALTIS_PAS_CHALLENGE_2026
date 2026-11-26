// La fiche commune des 6 fonctionnalités de l'agriculteur et des 7 étapes de l'ONG : l'essentiel en 5 secondes.
// De haut en bas : la question et les choix (puces), la réponse en gros, 1 à 3 lignes à cocher, le détail replié,
// puis un pied collé en bas : écouter (français, wolof) et passer à la question suivante.
import clsx from 'clsx'
import { ArrowRight, Check, ChevronDown, TriangleAlert, X } from 'lucide-react'
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { parcoursDe, type Cadre, type IdEtape } from '../cadre'
import type { EtatLigne, LigneCheck, Puce } from './fiche'
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


interface PropsFiche {
  cadre: Cadre
  mode: IdEtape
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
  /** ouvre le détail dès l'arrivée sur l'écran */
  detailOuvertParDefaut?: boolean
  /** change avec le département, l'année ou la culture : le détail et les menus se referment */
  cle: string
  aEcouter?: string[]
  aEcouterWo?: string[]
  /** la culture montrée ; sans culture choisie, « Suivant » la transmet : l'écran suivant parle de la même */
  culture?: string | null
}

export function FicheReponse({ cadre, mode, puces = [], titre, teinte, lignes, avant, etat, detail, detailOuvertParDefaut = false, cle, culture }: PropsFiche) {
  // Le parcours du profil : 6 questions de l'agriculteur, ou 7 étapes de l'ONG
  const parcours = parcoursDe(cadre)
  const i = parcours.findIndex((p) => p.id === mode)
  const question = parcours[i].question
  const suivant = parcours[i + 1]
  const agriculteur = cadre.user.role === 'PRODUCTEUR'
  // Ouvert pour une clé donnée : changer de département, d'année ou de culture le referme
  const [etatDetail, setEtatDetail] = useState<{ cle: string; ouvert: boolean } | null>(null)
  const ouvert = etatDetail?.cle === cle ? etatDetail.ouvert : detailOuvertParDefaut
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
  // À l'ouverture d'un menu, le focus va sur son champ de saisie, sinon sur l'option cochée ; il revient à la puce à la fermeture
  useEffect(() => {
    if (!menuOuvert) return
    const menu = document.getElementById(idMenu)
    const cible = menu?.querySelector<HTMLElement>('input') ?? menu?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu?.querySelector<HTMLElement>('select, button')
    cible?.focus()
  }, [menuOuvert, idMenu])
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
            <button key={p.id} type="button" id={`${idMenu}-${p.id}`} data-puce={p.id} aria-haspopup="dialog" onClick={() => setMenu(menuOuvert === p.id ? null : p.id)}
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

      <div aria-live="polite" aria-atomic="true" className="mt-2">
        <h2 className="maj font-titre text-titre-fiche font-semibold text-white" style={teinte ? { color: teinte } : undefined}>{titre}</h2>
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

      {/* ONG : le détail est déjà sur le tableau de bord de la carte, la palette n'en garde que la réponse */}
      {detail && agriculteur && (
        <div className="mt-4">
          <button type="button" onClick={() => setEtatDetail({ cle, ouvert: !ouvert })} aria-expanded={ouvert} aria-controls={idDetail}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-white/20 bg-white/[0.04] px-3.5 text-sm font-medium text-white transition hover:border-white/45 hover:bg-white/[0.08]">
            {ouvert ? 'Masquer le détail' : 'Voir le détail'}
            <ChevronDown className={clsx('size-4 shrink-0 transition-transform duration-300', ouvert && 'rotate-180')} aria-hidden />
          </button>
          {ouvert && <div id={idDetail} className="maj">{detail}</div>}
        </div>
      )}

      <div className="sticky -bottom-4 z-10 -mx-4 mt-4 flex items-center gap-2 border-t border-white/[0.09] bg-encre-nuit px-4 py-2.5">
        {/* La lecture passe par les guides vocaux, en tête du dock */}
        <button type="button" onClick={() => { if (culture && !cadre.culture) cadre.choisirCulture(culture); cadre.aller(suivant?.id ?? parcours[0].id) }}
          className="ml-auto inline-flex min-h-11 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-lg bg-soleil-500 px-3 py-1 text-left text-xs leading-tight font-semibold text-encre-nuit transition hover:bg-soleil-100 active:scale-[0.98]">
          <span className="min-w-0">{suivant ? <>Suivant : {suivant.question}</> : agriculteur ? 'Revenir à mon champ' : <>Revenir au début : {parcours[0].question}</>}</span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </button>
      </div>
    </div>
  )
}
