import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { AuthProvider } from './auth/AuthContext'
import { ApiError } from './api/client'
import { App } from './App'
import { demarrerMesureAudience } from './consentement/audience'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Mise à jour automatique : à chaque déploiement, le service worker installe la nouvelle version, prend la main et
// recharge la page (plus besoin de Ctrl+Maj+R). Un onglet resté ouvert vérifie toutes les 30 min et au retour.
registerSW({
  immediate: true,
  onRegisteredSW(_url, enregistrement) {
    if (!enregistrement) return
    const verifier = () => {
      if (navigator.onLine) void enregistrement.update().catch(() => undefined)
    }
    window.setInterval(verifier, 30 * 60 * 1000)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && verifier())
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Pas de nouvel essai sur les erreurs définitives (droits, ressource absente)
      retry: (n, e) => !(e instanceof ApiError && [401, 403, 404].includes(e.status)) && n < 2,
      refetchOnWindowFocus: false,
      // Les marts et les prévisions changent au plus une fois par jour : une réponse reste fraîche 10 min par défaut
      // (1 h dans les hooks), et reste en mémoire 1 h après usage, pour revenir sur un écran sans nouvelle requête
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 60,
    },
  },
})

demarrerMesureAudience()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
