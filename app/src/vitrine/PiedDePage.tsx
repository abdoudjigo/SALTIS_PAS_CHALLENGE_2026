import { Link } from 'react-router'
import { config } from '../config'

const RUBRIQUES: { titre: string; liens: { libelle: string; to: string }[] }[] = [
  {
    titre: 'Plateforme',
    liens: [
      { libelle: 'Découvrir', to: '/#decouvrir' },
      { libelle: 'Se connecter', to: '/connexion' },
      { libelle: 'Créer un compte producteur', to: '/inscription' },
    ],
  },
  {
    titre: 'Ressources',
    liens: [
      { libelle: 'Formations', to: '/formations' },
      { libelle: 'À propos du projet', to: '/a-propos' },
      { libelle: 'Nous contacter', to: '/contact' },
    ],
  },
  {
    titre: 'Informations',
    liens: [
      { libelle: 'Politique de confidentialité', to: '/confidentialite' },
      { libelle: 'Mentions et crédits', to: '/mentions-credits' },
    ],
  },
]

const LIEN = 'inline-flex min-h-9 items-center text-sm text-white/70 transition hover:text-white'

export function PiedDePage() {
  return (
    <footer className="relative border-t border-white/10 bg-nuit-900 px-5 pt-14 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-10 lg:px-[6vw]">
      <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
        <div className="max-w-xs sm:col-span-2 lg:col-span-1">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-9" />
            <span className="font-titre text-lg tracking-tight">Assaman & Suuf</span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Le ciel et la terre. Une aide à la décision agricole pour les 45 départements du Sénégal.
          </p>
        </div>

        {RUBRIQUES.map((r) => (
          <nav key={r.titre} aria-label={r.titre}>
            <h2 className="text-xs font-medium tracking-[0.18em] text-brume uppercase">{r.titre}</h2>
            <ul className="mt-3">
              {r.liens.map((l) => (
                <li key={l.to}><Link to={l.to} className={LIEN}>{l.libelle}</Link></li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <h2 className="text-xs font-medium tracking-[0.18em] text-brume uppercase">Nous suivre</h2>
          <ul className="mt-3">
            {config.reseaux.map((r) => (
              <li key={r.nom}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className={LIEN}>{r.nom}</a>
                ) : (
                  <span className="inline-flex min-h-9 items-center gap-2 text-sm text-white/40">
                    {r.nom} <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px]">bientôt</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-14 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/45 md:flex-row md:justify-between md:gap-8">
        <p>© 2026 Équipe AKAI · SALTIS PAS Challenge 2026</p>
        <p className="md:text-right">
          Photo du champ d'arachide : Amadou250599Ba, Djissa Aliou (Kaolack), CC BY-SA 4.0, Wikimedia Commons.
          Les vents du globe sont un décor (prévisions mondiales, Mapbox).
        </p>
      </div>
    </footer>
  )
}
