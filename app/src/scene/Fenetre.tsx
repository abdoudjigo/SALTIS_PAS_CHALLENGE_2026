// Fenêtre de résultats d'une fonctionnalité. Grand écran : un panneau étroit à droite, qu'on déplace par sa
// barre et qu'on réduit (bouton ou Échap). Téléphone : un tiroir à trois crans ; replié, il garde la réponse
// en une ligne. Pendant qu'on manipule la carte, la fenêtre s'efface (classe `scene-manip`, voir Scene.tsx).
import clsx from 'clsx'
import { ChevronDown, ChevronUp, GripHorizontal, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { HAUTEUR_REPLIE_PX, hauteurCran, type Cran } from './crans'
import { arreter } from './lecture'
import { Mascottes } from './Mascottes'

/** Largeur de la fenêtre et place gardée à gauche pour la légende : la fenêtre ne la recouvre jamais. */
export const LARGEUR_FENETRE_PX = 336
const RESERVE_LEGENDE_PX = 380

interface PropsFenetre {
  /** change à chaque fonctionnalité : le contenu rejoue son entrée */
  cle: string
  titre: string
  icone: LucideIcon
  /** la réponse en une ligne, visible quand le tiroir est replié ou la fenêtre réduite */
  resume?: string
  /** l'essentiel à lire à voix haute (bouton « Écouter ») */
  aEcouter?: string[]
  aEcouterWo?: string[]
  large: boolean
  hauteurEcran: number
  cran: Cran
  onCran: (cran: Cran) => void
  legende?: ReactNode
  children: ReactNode
}

export function Fenetre({ cle, titre, icone: Icone, resume, aEcouter, aEcouterWo, large, hauteurEcran, cran, onCran, legende, children }: PropsFenetre) {
  // Changer de fonctionnalité arrête la lecture en cours
  useEffect(() => () => arreter(), [cle])
  // Réduite pour une fonctionnalité donnée : en changer rouvre la fenêtre
  const [reduitePour, setReduitePour] = useState<string | null>(null)
  const reduite = reduitePour === cle
  const [decalage, setDecalage] = useState({ x: 0, y: 0 })
  const [tirage, setTirage] = useState<number | null>(null)
  const prise = useRef<{ x: number; y: number; dx: number; dy: number; bouge: boolean } | null>(null)

  // Échap : réduire la fenêtre (grand écran) ou replier le tiroir (téléphone)
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (large) setReduitePour(cle)
      else onCran(0)
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [large, cle, onCran])

  // --- Grand écran : déplacer la fenêtre par sa barre -----------------------------------------
  const saisir = (e: PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    prise.current = { x: e.clientX, y: e.clientY, dx: decalage.x, dy: decalage.y, bouge: false }
  }
  const deplacer = (e: PointerEvent<HTMLElement>) => {
    const p = prise.current
    if (!p) return
    const gauche = Math.min(-(window.innerWidth - LARGEUR_FENETRE_PX - 32 - RESERVE_LEGENDE_PX), 0)
    setDecalage({ x: Math.min(Math.max(p.dx + e.clientX - p.x, gauche), 0), y: Math.min(Math.max(p.dy + e.clientY - p.y, 0), window.innerHeight - 80) })
  }
  const lacher = () => {
    prise.current = null
  }

  // --- Téléphone : tirer le tiroir, il s'arrête au cran le plus proche --------------------------
  const hauteur = tirage ?? hauteurCran(cran, hauteurEcran)
  const saisirTiroir = (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    prise.current = { x: 0, y: e.clientY, dx: 0, dy: hauteur, bouge: false }
  }
  const tirer = (e: PointerEvent<HTMLElement>) => {
    const p = prise.current
    if (!p) return
    if (Math.abs(e.clientY - p.y) > 6) p.bouge = true
    if (p.bouge) setTirage(Math.min(Math.max(p.dy + p.y - e.clientY, HAUTEUR_REPLIE_PX), hauteurCran(2, hauteurEcran)))
  }
  const lacherTiroir = () => {
    const p = prise.current
    prise.current = null
    if (!p) return
    if (!p.bouge) return onCran(cran === 0 ? 1 : cran === 1 ? 2 : 0) // un toucher : cran suivant
    const h = tirage ?? hauteur
    setTirage(null)
    const crans: Cran[] = [0, 1, 2]
    onCran(crans.reduce((a, b) => (Math.abs(hauteurCran(b, hauteurEcran) - h) < Math.abs(hauteurCran(a, hauteurEcran) - h) ? b : a)))
  }

  // La réponse en une ligne ne s'affiche que fenêtre fermée : ouverte, le contenu la donne déjà
  const intitule = (avecResume: boolean) => (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-2xs font-medium tracking-etiquette text-white/55 uppercase">{titre}</span>
      {avecResume && resume && <span className="block truncate text-sm font-medium text-white">{resume}</span>}
    </span>
  )

  if (!large)
    return (
      <section aria-label={titre} style={{ height: hauteur }} className={clsx('panneau tiroir absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl', tirage === null && 'tiroir-pose')}>
        <button type="button" onPointerDown={saisirTiroir} onPointerMove={tirer} onPointerUp={lacherTiroir} onPointerCancel={lacherTiroir}
          aria-label={cran === 0 ? `Ouvrir ${titre}` : `Agrandir ou replier ${titre}`} aria-expanded={cran > 0}
          className="flex shrink-0 touch-none flex-col items-center px-4 pt-2 pb-2.5">
          <span className="h-1 w-9 rounded-full bg-white/25" aria-hidden />
          <span className="mt-2.5 flex w-full items-center gap-3 text-left">
            <Icone className="size-5 shrink-0 text-soleil-500" aria-hidden />
            {intitule(cran === 0 && tirage === null)}
            {cran === 2 ? <ChevronDown className="size-5 shrink-0 text-white/50" aria-hidden /> : <ChevronUp className="size-5 shrink-0 text-white/50" aria-hidden />}
          </span>
        </button>
        <Mascottes fr={aEcouter} wo={aEcouterWo} className="absolute top-2 right-12" />
        <div key={cle} className={clsx('panneau-entree min-h-0 flex-1 overscroll-contain border-t border-white/[0.09] px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]', cran === 0 && tirage === null ? 'invisible overflow-hidden' : 'overflow-y-auto')}>
          {children}
          {legende && <div className="mt-5 border-t border-white/[0.09] pt-4">{legende}</div>}
        </div>
      </section>
    )

  if (reduite)
    return (
      <button type="button" onClick={() => setReduitePour(null)} style={{ translate: `${decalage.x}px ${decalage.y}px` }} aria-label={`Rouvrir ${titre}`}
        className="panneau fenetre absolute top-4 right-4 z-20 flex min-h-12 max-w-80 items-center gap-3 rounded-xl py-2 pr-3 pl-3.5 text-left transition hover:bg-encre-nuit">
        <Icone className="size-4 shrink-0 text-soleil-500" aria-hidden />
        {intitule(true)}
        <ChevronDown className="size-4 shrink-0 text-white/50" aria-hidden />
      </button>
    )

  return (
    <section aria-label={titre} style={{ translate: `${decalage.x}px ${decalage.y}px`, width: LARGEUR_FENETRE_PX }}
      className="panneau fenetre absolute top-4 right-4 z-20 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-xl">
      <div onPointerDown={saisir} onPointerMove={deplacer} onPointerUp={lacher} onPointerCancel={lacher}
        className="flex h-11 shrink-0 cursor-grab touch-none items-center gap-2.5 border-b border-white/[0.09] pr-1 pl-4 select-none active:cursor-grabbing">
        <Icone className="size-4 shrink-0 text-soleil-500" aria-hidden />
        <span className="flex-1 truncate text-2xs font-medium tracking-etiquette text-white/70 uppercase">{titre}</span>
        <Mascottes fr={aEcouter} wo={aEcouterWo} />
        <GripHorizontal className="size-4 text-white/25" aria-hidden />
        <button type="button" onClick={() => setReduitePour(cle)} aria-label="Réduire la fenêtre (Échap)" title="Réduire (Échap)" className="grid size-11 place-items-center rounded-lg text-white/60 transition hover:text-white">
          <Minus className="size-4" />
        </button>
      </div>
      <div key={cle} className="panneau-entree min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">{children}</div>
    </section>
  )
}
