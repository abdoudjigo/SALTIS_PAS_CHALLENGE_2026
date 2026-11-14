import { Navigate, Outlet } from 'react-router'
import { useAuth } from './AuthContext'

/** La scène est réservée à qui est entré par une des deux portes de la landing. Sinon : retour à la landing. */
export function RouteProtegee() {
  const { estConnecte } = useAuth()
  return estConnecte ? <Outlet /> : <Navigate to="/" replace />
}
