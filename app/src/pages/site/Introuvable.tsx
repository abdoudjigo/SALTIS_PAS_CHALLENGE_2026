// Page introuvable (404) : dit ce qui s'est passé, rappelle l'adresse demandée et propose de quoi repartir.
// Le serveur (deploy/Caddyfile) la sert avec le statut HTTP 404 ; elle n'est pas proposée aux moteurs de recherche.
import { ArrowRight, Home } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { PAGES } from '../../lib/pages'
import { PageSite, Partie } from './PageSite'

const LIENS = [
  { to: '/a-propos', libelle: 'À propos', detail: 'le projet et l’équipe' },
  { to: '/methode', libelle: 'Méthode et fiabilité', detail: 'comment les prévisions sont faites' },
  { to: '/donnees', libelle: 'Données et sources', detail: 'd’où viennent les chiffres' },
  { to: '/contact', libelle: 'Contact', detail: 'écrire à l’équipe' },
]

export default function Introuvable() {
  const { pathname } = useLocation()
  const { estConnecte } = useAuth()

  return (
    <PageSite
      titre={PAGES.introuvable.titre}
      description={PAGES.introuvable.description}
      chapeau="Cette adresse ne mène à aucune page : le lien est peut-être ancien, ou une lettre a glissé en la tapant."
      indexable={false}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* Le soleil et la terre de l'emblème, avec une pluie qui ne tombe nulle part */}
        <svg viewBox="0 0 120 96" className="h-24 w-30 shrink-0" aria-hidden>
          <circle cx="44" cy="44" r="22" className="fill-soleil-500" />
          <path d="M0 68c40-18 80-18 120 0v28H0z" className="fill-terre-500" />
          <path d="M0 82c40-12 80-12 120 0v14H0z" className="fill-vert-700" />
          <path d="M84 14l-5 12M96 10l-5 12M90 28l-5 12" className="stroke-pluie-500" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <p className="leading-relaxed text-encre-douce">
          Adresse demandée : <code className="rounded-md bg-terre-100 px-1.5 py-0.5 text-sm break-all text-encre">{pathname}</code>
          <br />
          Erreur 404 : la page n'existe pas, ou plus.
        </p>
      </div>

      {/* Un seul appel à l'action, le même que partout sur le site ; l'accueil reste à portée par un lien */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to={estConnecte ? '/' : '/#entrer'} className="bouton-action group min-h-12 pr-5 pl-6 text-md">
          {estConnecte ? 'Revenir à la carte' : 'Entrer dans la carte'} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
        {!estConnecte && (
          <Link to="/" className="inline-flex min-h-12 items-center gap-2 px-2 font-medium text-encre-douce underline-offset-4 transition hover:text-encre hover:underline">
            <Home className="size-4" aria-hidden /> Revenir à l'accueil
          </Link>
        )}
      </div>

      <Partie titre="Ou continuer par">
        <ul className="divide-y divide-trait border-y border-trait">
          {LIENS.map((p) => (
            <li key={p.to}>
              <Link to={p.to} className="group flex min-h-14 items-center justify-between gap-4 py-2 transition hover:text-vert-700">
                <span>
                  <span className="block font-medium text-encre group-hover:text-vert-700">{p.libelle}</span>
                  <span className="text-sm">{p.detail}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Partie>
    </PageSite>
  )
}
