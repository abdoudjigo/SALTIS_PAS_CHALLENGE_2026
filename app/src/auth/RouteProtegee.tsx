import { ShieldOff } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { EtatVide } from '../components/ui/EtatVide'
import { useAuth } from './AuthContext'
import { peutAcceder, type CleAcces } from './roles'
import { sessionStore } from './session'

export function RouteProtegee({ acces }: { acces?: CleAcces }) {
  const { estConnecte, user } = useAuth()
  const location = useLocation()

  if (!estConnecte) {
    // Déconnexion volontaire : retour à la landing. Sinon, connexion puis retour à la page demandée.
    if (sessionStore.finSession() === 'deconnexion') return <Navigate to="/" replace />
    return <Navigate to="/connexion" replace state={{ depuis: location.pathname }} />
  }
  if (acces && !peutAcceder(user, acces))
    return (
      <EtatVide
        icone={ShieldOff}
        titre="Accès réservé"
        texte="Cette partie est réservée à d'autres profils. Contactez un administrateur si vous pensez qu'il s'agit d'une erreur."
      />
    )
  return <Outlet />
}
