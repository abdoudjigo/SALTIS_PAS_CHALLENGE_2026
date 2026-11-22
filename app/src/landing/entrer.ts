// Les deux portes d'entrée : agriculteur, ou ONG et services de l'État. Pas de compte ni de mot de passe à saisir :
// un clic ouvre le profil correspondant (voir api/mock/comptes.ts).
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { MOT_DE_PASSE_DEMO } from '../api/mock/comptes'
import { useAuth } from '../auth/AuthContext'
import { suivre } from '../lib/mesure'

export type Profil = 'agriculteur' | 'organisation'

const COMPTES: Record<Profil, string> = { agriculteur: 'producteur@demo.sn', organisation: 'ong@demo.sn' }

export function useEntrer() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [enCours, setEnCours] = useState<Profil | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const entrer = useCallback(
    async (profil: Profil) => {
      setEnCours(profil)
      setErreur(null)
      try {
        await login(COMPTES[profil], MOT_DE_PASSE_DEMO)
        suivre('porte_entree', { profil })
        navigate('/', { replace: true })
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Entrée impossible. Réessayez dans un instant.')
        setEnCours(null)
      }
    },
    [login, navigate],
  )
  return { entrer, enCours, erreur }
}
