import { ArrowRight, Sprout, Truck } from 'lucide-react'
import { useEntrer, type Profil } from './entrer'

const PORTES: { profil: Profil; icone: typeof Sprout; titre: string; phrase: string; points: string[]; teinte: string; fond: string }[] = [
  {
    profil: 'agriculteur', icone: Sprout, titre: 'Agriculteur', teinte: 'text-vert-700', fond: 'bg-vert-50',
    phrase: 'Votre parcelle, du ciel au sol.',
    points: ['Votre parcelle : le sol, les risques, la campagne', 'La saison qui vient, et quand semer', 'Quelle culture, avec quel cycle', 'Vos besoins selon la culture, la surface et l’année'],
  },
  {
    profil: 'organisation', icone: Truck, titre: 'ONG et services de l’État', teinte: 'text-terre-700', fond: 'bg-terre-100',
    phrase: 'Le pays entier, pour décider où porter les intrants.',
    points: ['Les départements à surveiller cette campagne', 'Alerte récolte : où le rendement peut chuter', 'Vulnérabilité et besoins en intrants', 'Répartir un stock, département par département'],
  },
]

/** Deux grandes cartes : on choisit son profil et on entre. */
export function Portes({ compact = false }: { compact?: boolean }) {
  const { entrer, enCours, erreur } = useEntrer()

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-2">
        {PORTES.map((p, i) => (
          <button
            key={p.profil}
            type="button"
            disabled={enCours !== null}
            onClick={() => void entrer(p.profil)}
            style={{ '--delai': `${i * 0.08}s` } as React.CSSProperties}
            className="porte surgir group flex flex-col rounded-3xl border border-trait bg-white p-6 text-left disabled:opacity-60 sm:p-8"
          >
            <span className={`grid size-12 place-items-center rounded-2xl ${p.fond} ${p.teinte}`}>
              <p.icone className="size-6" aria-hidden />
            </span>
            <span className="mt-5 font-titre text-2xl font-semibold text-encre sm:text-3xl">{p.titre}</span>
            <span className="mt-1.5 text-md leading-relaxed text-encre-douce">{p.phrase}</span>
            {!compact && (
              <ul className="mt-5 space-y-2 border-t border-trait pt-5 text-sm text-encre">
                {p.points.map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span className={`mt-[7px] size-1.5 shrink-0 rounded-full bg-current ${p.teinte}`} aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <span className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${p.teinte}`}>
              {enCours === p.profil ? 'Ouverture…' : 'Entrer'}
              <ArrowRight className="porte-fleche size-4" aria-hidden />
            </span>
          </button>
        ))}
      </div>
      {erreur && <p role="alert" className="mt-4 text-sm text-alerte-700">{erreur}</p>}
    </div>
  )
}
