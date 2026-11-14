import clsx from 'clsx'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../auth/AuthContext'

const LIENS = [
  { to: '/a-propos', libelle: 'À propos' },
  { to: '/formations', libelle: 'Formations' },
  { to: '/contact', libelle: 'Contact' },
]

/** En-tête des pages publiques : marque, pages de base et accès à l'application. */
export function EnTetePublic({ className }: { className?: string }) {
  const { estConnecte } = useAuth()

  return (
    <header className={clsx('flex items-center justify-between gap-4', className)}>
      <Link to="/" className="flex shrink-0 items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-9" />
        <span className="font-titre text-lg tracking-tight">Assaman & Suuf</span>
      </Link>
      <nav aria-label="Pages" className="flex items-center gap-1 text-sm font-medium">
        {LIENS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              clsx('hidden min-h-11 items-center rounded-full px-3.5 transition hover:text-white md:inline-flex', isActive ? 'text-soleil-500' : 'text-white/75')
            }
          >
            {l.libelle}
          </NavLink>
        ))}
        <Link
          to={estConnecte ? '/' : '/connexion'}
          className="ml-2 inline-flex min-h-11 items-center rounded-full border border-white/25 px-4 text-white transition hover:border-white/60"
        >
          {estConnecte ? "Ouvrir l'application" : 'Se connecter'}
        </Link>
      </nav>
    </header>
  )
}
