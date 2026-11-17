// Dock des fonctionnalités. Grand écran : toujours visible à gauche, il entre en douceur à l'arrivée, puis
// les icônes grossissent sous le pointeur et chacune ouvre une bulle. Téléphone : une rangée en haut.
import clsx from 'clsx'
import { useRef } from 'react'
import type { Fonctionnalite } from './cadre'

const PORTEE_PX = 120

export function Dock({ fonctionnalites, actif, onChoisir }: { fonctionnalites: Fonctionnalite[]; actif: string; onChoisir: (id: string) => void }) {
  const boutons = useRef(new Map<string, HTMLButtonElement>())

  // Les icônes grossissent à l'approche du pointeur
  const grossir = (y: number | null) =>
    boutons.current.forEach((el) => {
      const r = el.getBoundingClientRect()
      const proche = y === null ? 0 : Math.max(0, 1 - Math.abs(y - (r.top + r.height / 2)) / PORTEE_PX)
      el.style.scale = String(1 + 0.24 * proche ** 2)
    })

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
                aria-label={`${f.titre}. ${f.phrase}`}
                className={clsx('dock-bouton grid size-14 place-items-center rounded-xl border', f.id === actif ? 'border-soleil-500/70 bg-soleil-500 text-encre-nuit' : 'border-white/10 bg-white/[0.07] text-white hover:bg-white/[0.16]')}
              >
                <f.icone className="size-6" aria-hidden />
              </button>
              <span className="dock-bulle verre-scene absolute left-[calc(100%+1.25rem)] w-56 rounded-lg px-3.5 py-2.5">
                <span className="block text-sm font-medium text-white">{f.titre}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-white/75">{f.phrase}</span>
              </span>
            </li>
          ))}
        </ul>
      </nav>

      {/* Téléphone */}
      <nav aria-label="Fonctionnalités" className="absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:hidden">
        {fonctionnalites.map((f) => (
          <button key={f.id} type="button" onClick={() => onChoisir(f.id)} aria-current={f.id === actif ? 'true' : undefined}
            className={clsx('verre-scene inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition', f.id === actif ? 'border-soleil-500! bg-soleil-500! text-encre-nuit' : 'text-white')}>
            <f.icone className="size-4" aria-hidden />{f.titre}
          </button>
        ))}
      </nav>
    </>
  )
}
