// Gabarit des pages du site (À propos, Méthode, Données, Contact, Mentions légales, Confidentialité, Conditions générales) :
// le même en-tête que la landing (île vert foncé), une colonne de lecture, le pied de page de la landing.
import clsx from 'clsx'
import { ArrowRight } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { PiedDePage } from '../../landing/PiedDePage'
import { useAuth } from '../../auth/AuthContext'
import { useMeta } from '../../lib/meta'

const PAGES_SITE = [
  { to: '/a-propos', libelle: 'À propos' },
  { to: '/methode', libelle: 'Méthode' },
  { to: '/donnees', libelle: 'Données' },
  { to: '/contact', libelle: 'Contact' },
]

type Props = {
  titre: string
  chapeau: string
  /** Description pour les moteurs de recherche (120 à 160 caractères). Sans elle : le chapeau */
  description?: string
  /** false : page non proposée aux moteurs de recherche */
  indexable?: boolean
  children: ReactNode
}

export function PageSite({ titre, chapeau, description, indexable, children }: Props) {
  useMeta({ titrePage: titre, description: description ?? chapeau, indexable })
  // Déjà entré par une porte : le bouton ramène à la carte (« / » l'affiche), sans passer par l'accueil
  const { estConnecte } = useAuth()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [titre])

  return (
    <div className="min-h-dvh bg-sol text-encre">
      <header className="sticky top-0 z-40 flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="ile ile-serree flex w-full max-w-4xl items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3">
          <Link to="/" className="flex min-h-10 min-w-10 shrink-0 items-center gap-2.5" aria-label="Assaman & Suuf, accueil">
            <img src="/favicon.svg" alt="" className="size-8 rounded-[10px]" />
            <span className="font-titre text-lg font-semibold whitespace-nowrap text-white max-sm:hidden">Assaman & Suuf</span>
          </Link>
          {/* Téléphone : les liens défilent ; le bord droit s'estompe pour montrer qu'il y en a d'autres */}
          <nav aria-label="Pages" className="ml-auto flex items-center overflow-x-auto [scrollbar-width:none] max-sm:pr-8 max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)]">
            {PAGES_SITE.map((p) => (
              <NavLink key={p.to} to={p.to}
                className={({ isActive }) => clsx('inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition',
                  isActive ? 'bg-white/[0.14] text-white' : 'text-white/65 hover:text-white')}>
                {p.libelle}
              </NavLink>
            ))}
          </nav>
          <Link to={estConnecte ? '/' : '/#entrer'} className="bouton-action min-h-10 pr-3 pl-4 text-sm max-[420px]:hidden">
            {estConnecte ? <>Revenir<span className="max-lg:sr-only"> à la carte</span></> : <>Entrer<span className="max-lg:sr-only"> dans la carte</span></>} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-16 pb-32 sm:px-8 sm:pt-20">
        <h1 className="font-titre text-titre-section leading-tight font-semibold tracking-tight text-balance">{titre}</h1>
        <p className="mt-5 text-lg leading-relaxed text-encre-douce">{chapeau}</p>
        <div className="mt-12 space-y-12">{children}</div>
      </main>

      <PiedDePage />
    </div>
  )
}

/** Une partie de page : un titre et son contenu. */
export function Partie({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-titre text-2xl font-semibold tracking-tight">{titre}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-encre-douce [&_strong]:font-semibold [&_strong]:text-encre">{children}</div>
    </section>
  )
}

/** Tableau sobre : en-têtes en petites capitales, lignes séparées par un trait. */
export function Tableau({ colonnes, lignes }: { colonnes: string[]; lignes: ReactNode[][] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-trait">
            {colonnes.map((c) => <th key={c} scope="col" className="py-2.5 pr-4 text-2xs font-medium tracking-etiquette text-encre-douce uppercase">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i} className="border-b border-trait/70 align-top">
              {l.map((cellule, j) => <td key={j} className={clsx('py-3 pr-4', j === 0 ? 'font-medium text-encre' : 'text-encre-douce')}>{cellule}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
