import clsx from 'clsx'
import { LogOut, Menu, UserRound, WifiOff, X } from 'lucide-react'
import { Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import type { Utilisateur } from '../../types/auth'
import { ROLES, peutAcceder } from '../../auth/roles'
import { config } from '../../config'
import { usePrechargement } from '../../hooks/donnees'
import { SqueletteEcran } from '../ui/base'
import { MiseAJourPwa } from './MiseAJourPwa'
import { NAVIGATION, type ElementMenu } from './navigation'

function useEnLigne() {
  return useSyncExternalStore(
    (f: () => void) => {
      window.addEventListener('online', f)
      window.addEventListener('offline', f)
      return () => {
        window.removeEventListener('online', f)
        window.removeEventListener('offline', f)
      }
    },
    () => navigator.onLine,
  )
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-9" />
      <div className="leading-tight">
        <div className="font-semibold tracking-tight">Assaman & Suuf</div>
        <div className="text-[11px] text-encre-douce">Ciel & Terre · Sénégal</div>
      </div>
    </Link>
  )
}

function LienMenu({ item, onClick }: { item: ElementMenu; onClick?: () => void }) {
  const precharger = usePrechargement()
  const Icone = item.icone
  return (
    <NavLink
      to={item.to}
      end={item.fin}
      onClick={onClick}
      onMouseEnter={() => item.prechargement && precharger(item.prechargement)}
      className={({ isActive }) =>
        clsx(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
          isActive ? 'bg-vert-700 text-white shadow-sm' : 'text-encre-douce hover:bg-vert-50 hover:text-vert-900',
        )
      }
    >
      <Icone className="size-[18px] shrink-0" aria-hidden />
      <span className="truncate">{item.libelle}</span>
      {item.module && <span className="ml-auto text-[10px] font-semibold opacity-50">{item.module}</span>}
    </NavLink>
  )
}

function CarteUtilisateur({ user, logout }: { user: Utilisateur | null; logout: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-trait bg-white p-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-terre-100 text-terre-700">
        <UserRound className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-medium">{user?.nom}</div>
        <div className="truncate text-xs text-encre-douce">{user?.organisation?.nom ?? (user ? ROLES[user.role].libelle : '')}</div>
      </div>
      <button onClick={logout} title="Se déconnecter" className="rounded-lg p-2 text-encre-douce hover:bg-stone-100 hover:text-alerte-700">
        <LogOut className="size-4" />
        <span className="sr-only">Se déconnecter</span>
      </button>
    </div>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const enLigne = useEnLigne()
  const location = useLocation()
  const [tiroir, setTiroir] = useState(false)
  const items = NAVIGATION.filter((i) => peutAcceder(user, i.acces))
  const barreBas = items.slice(0, 4)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Barre latérale (écrans larges) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-trait bg-sol/95 p-4 backdrop-blur lg:flex">
        <Logo />
        <nav className="flex flex-1 flex-col gap-1" aria-label="Menu principal">
          {items.map((i) => <LienMenu key={i.to} item={i} />)}
        </nav>
        <CarteUtilisateur user={user} logout={logout} />
      </aside>

      {/* En-tête mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-trait bg-sol/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setTiroir(true)} className="rounded-xl p-2 hover:bg-stone-100" aria-label="Ouvrir le menu">
          <Menu className="size-5" />
        </button>
      </header>

      {config.donneesDemo && (
        <div className="border-b border-soleil-500/30 bg-soleil-100 px-4 py-1.5 text-center text-xs text-terre-700">
          Données d'exemple : les valeurs affichées ne sont pas réelles.
        </div>
      )}
      {!enLigne && (
        <div className="flex items-center justify-center gap-2 bg-encre px-4 py-1.5 text-xs text-white">
          <WifiOff className="size-3.5" /> Hors ligne : données mises en cache affichées.
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:pb-10">
        <Suspense fallback={<SqueletteEcran />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Barre du bas (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-trait bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navigation rapide">
        {barreBas.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.fin}
            className={({ isActive }) => clsx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-vert-700' : 'text-encre-douce')}>
            <i.icone className="size-5" aria-hidden />
            {i.court ?? i.libelle}
          </NavLink>
        ))}
        <button onClick={() => setTiroir(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-encre-douce">
          <Menu className="size-5" aria-hidden /> Plus
        </button>
      </nav>

      {/* Tiroir de menu (mobile) */}
      {tiroir && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-encre/30 backdrop-blur-[2px]" onClick={() => setTiroir(false)} />
          <div className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col gap-5 bg-sol p-4 shadow-xl animate-apparition">
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setTiroir(false)} className="rounded-xl p-2 hover:bg-stone-100" aria-label="Fermer le menu">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1">
              {items.map((i) => <LienMenu key={i.to} item={i} onClick={() => setTiroir(false)} />)}
            </nav>
            <CarteUtilisateur user={user} logout={logout} />
          </div>
        </div>
      )}

      <MiseAJourPwa />
    </div>
  )
}
