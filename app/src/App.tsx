import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthContext'
import { RouteProtegee } from './auth/RouteProtegee'
import { BandeauCookies } from './consentement/BandeauCookies'
import Landing from './pages/Landing'

// Chaque écran est un fichier JS séparé, chargé seulement quand on l'ouvre
const Scene = lazy(() => import('./pages/Scene'))
const APropos = lazy(() => import('./pages/site/APropos'))
const Methode = lazy(() => import('./pages/site/Methode'))
const Donnees = lazy(() => import('./pages/site/Donnees'))
const Contact = lazy(() => import('./pages/site/Contact'))
const MentionsLegales = lazy(() => import('./pages/site/MentionsLegales'))
const Confidentialite = lazy(() => import('./pages/site/Confidentialite'))
const ConditionsGenerales = lazy(() => import('./pages/site/ConditionsGenerales'))
const Introuvable = lazy(() => import('./pages/site/Introuvable'))

export function App() {
  const { estConnecte } = useAuth()

  return (
    <>
      <Suspense fallback={<div className="min-h-dvh bg-sol" />}>
        <Routes>
          {/* « / » : la landing pour un visiteur, la scène (carte) pour qui est entré par une porte */}
          {!estConnecte && <Route index element={<Landing />} />}
          <Route element={<RouteProtegee />}>
            <Route index element={<Scene />} />
          </Route>
          {/* Une nouvelle page s'ajoute aussi à src/lib/pages.ts (titre, description, pré-rendu, plan du site) et à @page (deploy/Caddyfile, sinon le serveur répond 404) */}
        <Route path="/a-propos" element={<APropos />} />
          <Route path="/methode" element={<Methode />} />
          <Route path="/donnees" element={<Donnees />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/confidentialite" element={<Confidentialite />} />
          <Route path="/conditions-generales" element={<ConditionsGenerales />} />
          <Route path="*" element={<Introuvable />} />
        </Routes>
      </Suspense>
      <BandeauCookies />
    </>
  )
}
