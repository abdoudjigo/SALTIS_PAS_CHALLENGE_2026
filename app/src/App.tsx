import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthContext'
import { RouteProtegee } from './auth/RouteProtegee'
import { AppShell } from './components/layout/AppShell'
import { SqueletteEcran } from './components/ui/base'
import { TerritoireProvider } from './hooks/territoire'
import Bienvenue from './pages/Bienvenue'
import Connexion from './pages/Connexion'
import Inscription from './pages/Inscription'
import Landing from './pages/Landing'
import { Vitrine } from './vitrine/Vitrine'

// Chaque écran est un fichier JS séparé, chargé seulement quand on l'ouvre
const Accueil = lazy(() => import('./pages/Accueil'))
const Territoires = lazy(() => import('./pages/Territoires'))
const CarteAgroclimat = lazy(() => import('./pages/CarteAgroclimat'))
const SuiviDecadaire = lazy(() => import('./pages/SuiviDecadaire'))
const ChoixCultures = lazy(() => import('./pages/ChoixCultures'))
const Besoins = lazy(() => import('./pages/Besoins'))
const Vulnerabilite = lazy(() => import('./pages/Vulnerabilite'))
const AgroDistrib = lazy(() => import('./pages/AgroDistrib'))
const OffreSemences = lazy(() => import('./pages/OffreSemences'))
const Administration = lazy(() => import('./pages/Administration'))
const Introuvable = lazy(() => import('./pages/Introuvable'))
const APropos = lazy(() => import('./pages/publiques/APropos'))
const Contact = lazy(() => import('./pages/publiques/Contact'))
const Formations = lazy(() => import('./pages/publiques/Formations'))
const Confidentialite = lazy(() => import('./pages/publiques/Confidentialite'))
const MentionsCredits = lazy(() => import('./pages/publiques/MentionsCredits'))

export function App() {
  const { estConnecte } = useAuth()

  return (
    <Suspense fallback={<div className="p-6"><SqueletteEcran /></div>}>
      <Routes>
        {/* « / » : la landing pour un visiteur, l'accueil de l'application pour un utilisateur connecté */}
        <Route element={<Vitrine />}>
          {!estConnecte && <Route index element={<Landing />} />}
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/inscription" element={<Inscription />} />
          <Route path="/bienvenue" element={<Bienvenue />} />
        </Route>
        <Route path="/a-propos" element={<APropos />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/formations" element={<Formations />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
        <Route path="/mentions-credits" element={<MentionsCredits />} />
        <Route element={<RouteProtegee />}>
          <Route index element={<TerritoireProvider><Territoires /></TerritoireProvider>} />
          <Route element={<TerritoireProvider><AppShell /></TerritoireProvider>}>
            <Route path="tableau-de-bord" element={<Accueil />} />
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
