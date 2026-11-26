// Pied de page de la landing : la terre sous le ciel. Marque et mission, liens, puis les sources
// et crédits (obligatoires) dans un bloc à part, et la mention d'honnêteté du prototype.
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { config } from '../config'
import { consentement } from '../consentement/consentement'
import { EQUIPE } from './equipe'

const RUBRIQUES: { titre: string; liens: { libelle: string; to: string; ancre?: boolean }[] }[] = [
  {
    titre: 'Plateforme',
    liens: [
      { libelle: 'Les 6 zones', to: '/#zones', ancre: true },
      { libelle: 'Le récit : ciel, terre, décision', to: '/#ciel', ancre: true },
      { libelle: 'Entrer dans la carte', to: '/#entrer', ancre: true },
    ],
  },
  {
    titre: 'Le projet',
    liens: [
      { libelle: 'À propos', to: '/a-propos' },
      { libelle: 'Méthode et fiabilité', to: '/methode' },
      { libelle: 'Données et sources', to: '/donnees' },
      { libelle: 'Contact', to: '/contact' },
    ],
  },
  {
    titre: 'Informations',
    liens: [
      { libelle: 'Mentions légales', to: '/mentions-legales' },
      { libelle: 'Politique de confidentialité', to: '/confidentialite' },
      { libelle: 'Conditions générales', to: '/conditions-generales' },
    ],
  },
]

export function Linkedin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13M7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0"/>
    </svg>
  )
}


const LIEN = 'inline-flex min-h-11 items-center text-sm text-white/70 underline-offset-4 transition hover:text-white hover:underline'
const ETIQUETTE = 'text-2xs font-medium tracking-etiquette text-soleil-500 uppercase'

// Une fois entré par une porte, « / » affiche la carte et non plus l'accueil : les liens vers les sections
// de l'accueil (/#zones…) y mèneraient sans rien montrer. On propose alors seulement de revenir à la carte.
const PLATEFORME_CONNECTE: (typeof RUBRIQUES)[number] = { titre: 'Plateforme', liens: [{ libelle: 'Revenir à la carte', to: '/' }] }

export function PiedDePage() {
  const { estConnecte } = useAuth()
  const rubriques = estConnecte ? RUBRIQUES.map((r) => (r.titre === 'Plateforme' ? PLATEFORME_CONNECTE : r)) : RUBRIQUES
  return (
    <footer className="pointer-events-auto relative bg-vert-900 text-white">
      {/* L'horizon : deux lignes de terre, comme sur l'emblème, font la transition depuis la page claire */}
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-full block h-16 w-full sm:h-24" aria-hidden>
        <path d="M0 70c240-58 480-58 720 0s480 58 720 0v50H0z" className="fill-terre-500" />
        <path d="M0 96c240-44 480-44 720 0s480 44 720 0v24H0z" className="fill-vert-900" />
      </svg>

      <div className="mx-auto max-w-6xl px-5 pt-14 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-8 lg:pt-20">
        <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[1.25fr_2fr]">
          <div className="max-w-sm">
            <p className="flex items-center gap-3 font-titre text-2xl font-semibold"><img src="/favicon.svg" alt="" className="size-10 rounded-xl" />Assaman & Suuf</p>
            <p className="mt-4 text-md leading-relaxed text-white/70">
              La pluie, le sol et les cultures des 45 départements du Sénégal, pour décider quoi semer et où porter les intrants.
            </p>
            <p className="mt-6 text-sm text-white/60">Équipe AKAI · SALTIS PAS Challenge 2026</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {rubriques.map((r) => (
              <nav key={r.titre} aria-label={r.titre}>
                <h2 className={ETIQUETTE}>{r.titre}</h2>
                <ul className="mt-2">
                  {r.liens.map((l) => (
                    <li key={l.to}>{l.ancre ? <a href={l.to} className={LIEN}>{l.libelle}</a> : <Link to={l.to} className={LIEN}>{l.libelle}</Link>}</li>
                  ))}
                  {r.titre === 'Informations' && config.umamiId && <li><button type="button" onClick={consentement.rouvrir} className={LIEN}>Gérer les cookies</button></li>}
                </ul>
              </nav>
            ))}
            <nav aria-label="L'équipe sur LinkedIn">
              <h2 className={ETIQUETTE}>L'équipe</h2>
              <ul className="mt-2">
                {EQUIPE.map(([nom, url]) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer" className={`${LIEN} gap-2`}>
                      <Linkedin className="size-4 shrink-0" aria-hidden />{nom}<span className="sr-only"> (LinkedIn, nouvel onglet)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/12 pt-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p><strong className="font-medium text-white/80">Estimations indicatives, pas des garanties.</strong> Doses et recommandations à valider avec l'ISRA et les conseillers agricoles.</p>
          <p className="shrink-0">© 2026 AKAI</p>
        </div>
      </div>
    </footer>
  )
}
