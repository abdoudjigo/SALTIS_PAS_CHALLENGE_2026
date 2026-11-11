import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Decor } from './Decor'
import type { ContexteDecor } from './decorContexte'

/** Pages publiques : le décor reste monté pendant qu'on passe de la landing à la connexion ou à l'inscription. */
export function Vitrine() {
  const { pathname } = useLocation()
  const [pluie, setPluie] = useState(1)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  const contexte = useMemo<ContexteDecor>(() => ({ reglerPluie: setPluie }), [])

  return (
    <div className="vitrine relative min-h-svh bg-nuit-900 text-white">
      <Decor scene={pathname === '/connexion' || pathname === '/inscription' ? 'formulaire' : 'accueil'} intensitePluie={pluie} />
      <Outlet context={contexte} />
    </div>
  )
}
