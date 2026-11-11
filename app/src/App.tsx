import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { RouteProtegee } from './auth/RouteProtegee'
import { AppShell } from './components/layout/AppShell'
import { SqueletteEcran } from './components/ui/base'
import { TerritoireProvider } from './hooks/territoire'

// Chaque écran est un fichier JS séparé, chargé seulement quand on l'ouvre
const Connexion = lazy(() => import('./pages/Connexion'))
const Inscription = lazy(() => import('./pages/Inscription'))
const Accueil = lazy(() => import('./pages/Accueil'))
const CarteAgroclimat = lazy(() => import('./pages/CarteAgroclimat'))
const SuiviDecadaire = lazy(() => import('./pages/SuiviDecadaire'))
const ChoixCultures = lazy(() => import('./pages/ChoixCultures'))
const Besoins = lazy(() => import('./pages/Besoins'))
const Vulnerabilite = lazy(() => import('./pages/Vulnerabilite'))
const AgroDistrib = lazy(() => import('./pages/AgroDistrib'))
const OffreSemences = lazy(() => import('./pages/OffreSemences'))
const Administration = lazy(() => import('./pages/Administration'))
const Introuvable = lazy(() => import('./pages/Introuvable'))

export function App() {
  return (
    <Suspense fallback={<div className="p-6"><SqueletteEcran /></div>}>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/inscription" element={<Inscription />} />
        <Route element={<RouteProtegee />}>
          <Route element={<TerritoireProvider><AppShell /></TerritoireProvider>}>
            <Route index element={<Accueil />} />
            <Route path="carte" element={<CarteAgroclimat />} />
            <Route path="suivi" element={<SuiviDecadaire />} />
            <Route path="cultures" element={<ChoixCultures />} />
            <Route path="besoins" element={<Besoins />} />
            <Route path="vulnerabilite" element={<Vulnerabilite />} />
            <Route element={<RouteProtegee acces="agrodistrib" />}>
              <Route path="agrodistrib" element={<AgroDistrib />} />
            </Route>
            <Route element={<RouteProtegee acces="semences" />}>
              <Route path="semences" element={<OffreSemences />} />
            </Route>
            <Route element={<RouteProtegee acces="admin" />}>
              <Route path="admin" element={<Administration />} />
            </Route>
            <Route path="*" element={<Introuvable />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
