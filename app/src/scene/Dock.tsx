// Dock des fonctionnalités. Grand écran : caché à gauche, il sort quand la souris approche du bord,
// les icônes grossissent sous le pointeur et chacune ouvre une bulle. Téléphone : une rangée en haut.
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Fonctionnalite } from './cadre'

const BORD_PX = 22
const SORTIE_PX = 150
const PORTEE_PX = 120

export function Dock({ fonctionnalites, actif, onChoisir }: { fonctionnalites: Fonctionnalite[]; actif: string; onChoisir: (id: string) => void }) {
  // Ouvert à l'arrivée, le temps de se faire connaître
  const [ouvert, setOuvert] = useState(true)
  const [epingle, setEpingle] = useState(false)
  const boutons = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    const t = setTimeout(() => setOuvert(false), 3600)
    const suivre = (e: MouseEvent) => {
      if (e.clientX <= BORD_PX) {
        clearTimeout(t)
        setOuvert(true)
      } else if (e.clientX > SORTIE_PX) setOuvert(false)
    }
    window.addEventListener('mousemove', suivre)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousemove', suivre)
    }
  }, [])

  // Les icônes grossissent à l'approche du pointeur
  const grossir = (y: number | null) =>
    boutons.current.forEach((el) => {
      const r = el.getBoundingClientRect()
      const proche = y === null ? 0 : Math.max(0, 1 - Math.abs(y - (r.top + r.height / 2)) / PORTEE_PX)
      el.style.scale = String(1 + 0.42 * proche ** 2)
    })

  const visible = ouvert || epingle

  return (
    <>
      {/* Grand écran */}
      <nav aria-label="Fonctionnalités" className="pointer-events-none absolute inset-y-0 left-0 z-30 hidden items-center md:flex">
        <button type="button" onClick={() => setEpingle((e) => !e)} aria-label={visible ? 'Replier les fonctionnalités' : 'Ouvrir les fonctionnalités'} aria-expanded={visible}
          className={clsx('pointer-events-auto absolute left-0 grid h-24 w-5 place-items-center rounded-r-xl bg-white/15 text-white backdrop-blur transition-opacity duration-300 hover:bg-white/30', visible ? 'opacity-0' : 'dock-poignee')}>
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
        <ul
          className={clsx('dock verre-scene pointer-events-auto ml-3 flex flex-col gap-2 rounded-2xl p-2', !visible && 'dock-ferme')}
          onMouseMove={(e) => grossir(e.clientY)}
          onMouseLeave={() => grossir(null)}
          onFocus={() => setOuvert(true)}
        >
          {fonctionnalites.map((f) => (
            <li key={f.id} className="dock-item relative flex items-center">
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
              <span className="dock-bulle verre-scene absolute left-[calc(100%+1.6rem)] w-56 rounded-lg px-3.5 py-2.5">
                <span className="block text-sm font-medium text-white">{f.titre}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-white/65">{f.phrase}</span>
              </span>
            </li>
          ))}
        </ul>
      </nav>

      {/* Téléphone */}
      <nav aria-label="Fonctionnalités" className="absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:hidden">
        {fonctionnalites.map((f) => (
          <button key={f.id} type="button" onClick={() => onChoisir(f.id)} aria-current={f.id === actif ? 'true' : undefined}
            className={clsx('verre-scene inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition', f.id === actif ? '!border-soleil-500 !bg-soleil-500 text-encre-nuit' : 'text-white')}>
            <f.icone className="size-4" aria-hidden />{f.titre}
          </button>
        ))}
      </nav>
    </>
  )
}
