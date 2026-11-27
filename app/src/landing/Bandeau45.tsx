// Bandeau de l'accueil : « 45 ans · 45 départements · N observations », tous comptés sur les saisons servies par l'API
// (aucun chiffre tapé à la main), et un bouton vers la page « 45 ans de données ».
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { nombre } from '../lib/format'
import { compter, usePluies } from '../observatoire/climat'

export function Bandeau45() {
  const pluies = usePluies()
  const c = pluies.pret && pluies.lignes.length > 0 ? compter(pluies.lignes) : null
  return (
    <div className="vitrine-entree mb-8 inline-flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-trait bg-white/80 px-4 py-2.5 text-sm text-encre backdrop-blur" aria-live="polite">
      <span className="font-semibold tabular-nums" aria-busy={!c}>
        {c ? `${c.annees} ans · ${c.departements} départements · ${nombre(c.observations)} observations` : '45 ans de données…'}
      </span>
      <Link to="/observatoire" className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-encre px-3.5 text-xs font-semibold text-white hover:bg-encre/85">
        Explorer<ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  )
}
