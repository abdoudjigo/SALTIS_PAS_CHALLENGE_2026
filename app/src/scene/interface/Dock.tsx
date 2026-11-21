// Dock des fonctionnalités. Grand écran : toujours visible à gauche, il entre en douceur à l'arrivée, puis
// les icônes grossissent sous le pointeur et chacune ouvre une bulle. Téléphone : une rangée en haut.
// L'agriculteur lit des questions (« Que semer ? ») ; la fonctionnalité ouverte y ajoute sa réponse en une ligne.
import clsx from 'clsx'
import { useEffect, useRef } from 'react'
import type { Fonctionnalite } from '../cadre'

const PORTEE_PX = 120

export function Dock({ fonctionnalites, actif, onChoisir, reponse }: { fonctionnalites: Fonctionnalite[]; actif: string; onChoisir: (id: string) => void; reponse?: string }) {
  const boutons = useRef(new Map<string, HTMLButtonElement>())
  const intitule = (f: Fonctionnalite) => f.question ?? f.titre
  const reponseDe = (f: Fonctionnalite) => (f.id === actif && reponse ? reponse : null)
  const etiquette = (f: Fonctionnalite) => [intitule(f), reponseDe(f) ? `Réponse : ${reponseDe(f)}` : f.phrase].join(f.question ? ' ' : '. ')

  // Les icônes grossissent à l'approche du pointeur. Une fois par image, et toutes les positions lues avant
  // d'écrire la moindre échelle : lire après écrire forcerait le navigateur à recalculer la page à chaque icône
  const image = useRef(0)
  const pointeur = useRef<number | null>(null)
  useEffect(() => () => cancelAnimationFrame(image.current), [])
  const grossir = (y: number | null) => {
    pointeur.current = y
    if (image.current) return
    image.current = requestAnimationFrame(() => {
      image.current = 0
      const y = pointeur.current
      const els = [...boutons.current.values()]
      const centres = els.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 })
      els.forEach((el, i) => {
        const proche = y === null ? 0 : Math.max(0, 1 - Math.abs(y - centres[i]) / PORTEE_PX)
        el.style.scale = String(1 + 0.24 * proche ** 2)
      })
    })
  }

  return (
    <>
      {/* Grand écran */}
      <nav aria-label="Fonctionnalités" className="pointer-events-none absolute inset-y-0 left-0 z-30 hidden items-center md:flex">
        <ul
          className="dock verre-scene pointer-events-auto ml-3 flex flex-col gap-2 rounded-2xl p-2"
          onMouseMove={(e) => grossir(e.clientY)}
          onMouseLeave={() => grossir(null)}
        >
          {fonctionnalites.map((f, i) => (
            <li key={f.id} className="dock-item relative flex items-center" style={{ animationDelay: `${0.25 + i * 0.06}s` }}>
              <button
                type="button"
                ref={(el) => {
                  if (el) boutons.current.set(f.id, el)
                  else boutons.current.delete(f.id)
                }}
                onClick={() => onChoisir(f.id)}
                aria-current={f.id === actif ? 'true' : undefined}
                aria-label={etiquette(f)}
                className={clsx('dock-bouton grid size-14 place-items-center rounded-xl border', f.id === actif ? 'border-soleil-500/70 bg-soleil-500 text-encre-nuit' : 'border-white/10 bg-white/[0.07] text-white hover:bg-white/[0.16]')}
              >
                <f.icone className="size-6" aria-hidden />
              </button>
              <span className="dock-bulle verre-scene absolute left-[calc(100%+1.25rem)] w-56 rounded-lg px-3.5 py-2.5">
                <span className="block text-sm font-medium text-white">{intitule(f)}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-white/75">{f.phrase}</span>
                {reponseDe(f) && <span className="mt-1.5 block border-t border-white/[0.09] pt-1.5 text-xs font-medium text-soleil-500">{reponseDe(f)}</span>}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      {/* Téléphone */}
      <nav aria-label="Fonctionnalités" className="absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:hidden">
        {fonctionnalites.map((f) => (
          <button key={f.id} type="button" onClick={() => onChoisir(f.id)} aria-current={f.id === actif ? 'true' : undefined} aria-label={etiquette(f)}
            className={clsx('verre-scene inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition', f.id === actif ? 'border-soleil-500! bg-soleil-500! text-encre-nuit' : 'text-white')}>
            <f.icone className="size-4" aria-hidden />{intitule(f)}
          </button>
        ))}
      </nav>
    </>
  )
}
