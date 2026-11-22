// Tableau de bord de l'ONG, posé sur la scène (bas de la carte, entre le dock et la fenêtre) : quelques chiffres clés
// et une visualisation compacte, au lieu de longs tableaux dans « Voir le détail ». Réductible ; le choix est gardé.
// Le tableau complet reste dans la fenêtre : c'est la vue texte (lecteurs d'écran, chiffres exacts).
import clsx from 'clsx'
import { ChevronDown, ChevronUp, LayoutDashboard } from 'lucide-react'
import { useState, type ReactNode } from 'react'

const CLE_REDUIT = 'assaman.tableauDeBord.reduit'

export type EtatTuile = 'non' | 'attention' | 'ok' | 'info'
const TEINTE_TUILE: Record<EtatTuile, string> = {
  non: 'var(--color-alerte-500)', attention: 'var(--color-soleil-500)', ok: 'var(--color-vert-500)', info: 'rgb(255 255 255 / 0.35)',
}

export interface Tuile {
  valeur: ReactNode
  libelle: string
  etat?: EtatTuile
}

function lireReduit(): boolean {
  try {
    return localStorage.getItem(CLE_REDUIT) === '1'
  } catch {
    return false
  }
}

/** Un chiffre clé : grand nombre, libellé court, liseré d'état (la couleur n'est jamais seule : le libellé dit tout). */
function TuileChiffre({ valeur, libelle, etat = 'info' }: Tuile) {
  return (
    <div className="min-w-0 border-l-2 pl-2.5" style={{ borderColor: TEINTE_TUILE[etat] }}>
      <p className="font-titre text-xl leading-none font-semibold text-white tabular-nums">{valeur}</p>
      <p className="mt-1 text-2xs leading-snug text-white/65">{libelle}</p>
    </div>
  )
}

export function TableauDeBord({ titre, tuiles, children }: { titre: string; tuiles: Tuile[]; children?: ReactNode }) {
  const [reduit, setReduit] = useState(lireReduit)
  const basculer = () => {
    setReduit((r) => {
      try {
        localStorage.setItem(CLE_REDUIT, r ? '0' : '1')
      } catch {
        /* stockage indisponible : le choix vaut pour la visite */
      }
      return !r
    })
  }

  if (reduit)
    return (
      <button type="button" onClick={basculer} aria-expanded={false}
        className="verre-scene pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-medium text-white/85 transition hover:text-white">
        <LayoutDashboard className="size-4" aria-hidden />Tableau de bord<ChevronUp className="size-4" aria-hidden />
      </button>
    )

  return (
    <section aria-label={`Tableau de bord : ${titre}`} className="verre-scene surgir pointer-events-auto w-full rounded-2xl px-4 pt-2.5 pb-3">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="size-3.5 text-white/55" aria-hidden />
        <h2 className="text-2xs font-semibold tracking-etiquette text-white/60 uppercase">{titre}</h2>
        <button type="button" onClick={basculer} aria-expanded aria-label="Réduire le tableau de bord" title="Réduire le tableau de bord"
          className="-my-2 -mr-2 ml-auto grid size-11 place-items-center rounded-lg text-white/55 transition hover:text-white">
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
      {/* Les chiffres clés en une ligne, la visualisation dessous, sur toute la largeur */}
      <div className="mt-1 grid grid-cols-4 gap-x-4">
        {tuiles.map((t) => <TuileChiffre key={t.libelle} {...t} />)}
      </div>
      {children && <div className="mt-3 border-t border-white/[0.08] pt-2.5">{children}</div>}
    </section>
  )
}

// ---- Visualisations réutilisables (une colonne ou une ligne par département ; survol : le détail ; clic : la carte) ----

export interface ElementDepartement {
  code: string
  nom: string
  /** null : non disponible (case vide en pointillés, jamais 0) */
  valeur: number | null
  couleur: string
  /** ce que dit la ligne de détail au survol, et le lecteur d'écran */
  detail: string
  /** alerte : un point blanc en haut de la barre (la forme double la couleur) */
  marque?: boolean
}

const HAUTEUR_COLONNES = 64

/** Une barre verticale par département, dans l'ordre donné. `min` < 0 : barres divergentes autour de zéro.
 *  `seuil` : une ligne de repère pointillée (ex. seuil d'alerte). */
export function ColonnesDepartements({ elements, code, choisir, min = 0, max, seuil, echelle, consigne, legende }: {
  elements: ElementDepartement[]
  code: string | null
  choisir: (code: string) => void
  min?: number
  max: number
  seuil?: { valeur: number; libelle: string }
  echelle: { haut: string; bas: string; zero?: string }
  consigne: string
  legende?: ReactNode
}) {
  const [survol, setSurvol] = useState<string | null>(null)
  const montre = elements.find((e) => e.code === (survol ?? code))
  const etendue = max - min || 1
  const y = (v: number) => ((max - Math.min(max, Math.max(min, v))) / etendue) * HAUTEUR_COLONNES
  const zero = y(0)
  return (
    <div>
      <p className="flex min-h-5 flex-wrap items-baseline gap-x-2 text-xs text-white/80" aria-live="polite">
        {montre ? <><span className="font-semibold text-white">{montre.nom}</span><span>{montre.detail}</span></> : <span className="text-white/55">{consigne}</span>}
      </p>
      <div className="mt-2 flex gap-2">
        <div className="relative w-14 shrink-0 text-right text-[0.65rem] leading-none text-white/55" style={{ height: HAUTEUR_COLONNES }} aria-hidden>
          <span className="absolute top-0 right-0">{echelle.haut}</span>
          {echelle.zero && min < 0 && <span className="absolute right-0 -translate-y-1/2" style={{ top: zero }}>{echelle.zero}</span>}
          <span className="absolute right-0 bottom-0">{echelle.bas}</span>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
          <ol className="relative grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${elements.length}, minmax(8px, ${elements.length <= 20 ? 44 : 18}px))`, height: HAUTEUR_COLONNES }} onMouseLeave={() => setSurvol(null)}>
            {/* Ligne de base (zéro) et repère éventuel, derrière les barres */}
            <span className="pointer-events-none absolute inset-x-0 border-t border-white/20" style={{ top: zero }} aria-hidden />
            {seuil && <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/50" style={{ top: y(seuil.valeur) }} aria-hidden />}
            {elements.map((e) => {
              const haut = e.valeur === null ? zero : Math.min(zero, y(e.valeur))
              const bas = e.valeur === null ? zero : Math.max(zero, y(e.valeur))
              return (
                <li key={e.code} className="relative min-w-0">
                  <button type="button" onClick={() => choisir(e.code)} onMouseEnter={() => setSurvol(e.code)} onFocus={() => setSurvol(e.code)} onBlur={() => setSurvol(null)}
                    aria-current={e.code === code ? 'true' : undefined} aria-label={`${e.nom} : ${e.detail}`}
                    className={clsx('absolute inset-0 rounded-[3px] transition', e.code === code ? 'bg-white/[0.12] ring-2 ring-soleil-500' : 'hover:bg-white/[0.08]')}>
                    {e.valeur === null
                      ? <span className="absolute inset-x-0 h-2 rounded-[2px] border border-dashed border-white/30" style={{ top: zero - 8 }} />
                      : <span className="absolute inset-x-0 grid justify-items-center rounded-[3px]" style={{ top: haut, height: Math.max(2, bas - haut), background: e.couleur }}>
                          {e.marque && <span className="mt-0.5 size-1 rounded-full bg-white" />}
                        </span>}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-white/55">
        {legende}
        {seuil && <span className="inline-flex items-center gap-1"><span className="w-4 border-t border-dashed border-white/60" aria-hidden />{seuil.libelle}</span>}
        <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-[2px] border border-dashed border-white/30" aria-hidden />non disponible</span>
        <span className="ml-auto">{elements.length} départements</span>
      </p>
    </div>
  )
}

/** Un classement court en barres horizontales (les premiers seulement), cliquable. */
export function ClassementBarres({ titre, elements, code, choisir, vide }: {
  titre: string
  elements: (ElementDepartement & { texte: string })[]
  code: string | null
  choisir: (code: string) => void
  vide: string
}) {
  const max = Math.max(...elements.map((e) => e.valeur ?? 0), 1e-9)
  return (
    <section className="min-w-0" aria-label={titre}>
      <h3 className="mb-1 text-[0.7rem] font-medium text-white/75">{titre}</h3>
      {elements.length ? (
        <ol className="space-y-0.5">
          {elements.map((e, i) => (
            <li key={e.code}>
              <button type="button" onClick={() => choisir(e.code)} aria-current={e.code === code ? 'true' : undefined} aria-label={`${i + 1}. ${e.nom} : ${e.detail}`}
                className={clsx('grid w-full grid-cols-[1rem_7.5rem_1fr_auto] items-center gap-2 rounded px-1 py-0.5 text-left text-xs transition hover:bg-white/[0.06]', e.code === code && 'bg-white/[0.09] shadow-[inset_2px_0_0_var(--color-soleil-500)]')}>
                <span className="text-[0.65rem] text-white/45 tabular-nums">{i + 1}</span>
                <span className="truncate text-white">{e.nom}</span>
                <span className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${((e.valeur ?? 0) / max) * 100}%`, background: e.couleur }} />
                </span>
                <span className="text-white/80 tabular-nums">{e.texte}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : <p className="text-xs text-white/50">{vide}</p>}
    </section>
  )
}
