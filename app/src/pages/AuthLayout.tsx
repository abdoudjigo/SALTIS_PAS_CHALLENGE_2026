import { CloudRain, Package, Split, Sprout, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const POINTS: [LucideIcon, string][] = [
  [CloudRain, 'Suivre la pluie décade par décade et la comparer à la normale'],
  [Sprout, 'Choisir la culture et le cycle adaptés à son département'],
  [Package, 'Estimer les besoins en engrais et en semences'],
  [Split, 'Répartir les intrants vers les territoires prioritaires'],
]

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-vert-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-soleil-500/25 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-20 h-80 w-[140%] rounded-[50%] bg-terre-500/40" aria-hidden />
        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-11" />
          <div>
            <div className="text-lg font-semibold">Assaman & Suuf</div>
            <div className="text-sm text-white/70">Ciel & Terre</div>
          </div>
        </div>
        <div className="relative max-w-lg">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">
            Savoir quelle pluie attendre, pour décider quoi semer.
          </h1>
          <ul className="mt-8 space-y-4">
            {POINTS.map(([Icone, texte]) => (
              <li key={texte} className="flex items-center gap-3 text-white/85">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10"><Icone className="size-5" /></span>
                {texte}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">45 départements · 6 zones agroécologiques · SALTIS PAS Challenge 2026 · équipe AKAI</p>
      </div>
      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-sm animate-apparition">{children}</div>
      </div>
    </div>
  )
}
