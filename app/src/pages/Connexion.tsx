import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { sessionStore } from '../auth/session'
import { config } from '../config'
import { annoncerArrivee } from '../vitrine/bienvenue'
import { BOUTON_FORMULAIRE, CadreFormulaire, MessageErreur } from '../vitrine/CadreFormulaire'
import { ChampMotDePasse } from '../vitrine/ChampMotDePasse'
import { ComptesDemo } from '../vitrine/ComptesDemo'
import { usePrechargementAccueil } from '../vitrine/prechargement'
import { useEnvoiFormulaire } from '../vitrine/sortieFormulaire'

export default function Connexion() {
  const { login, estConnecte } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { phase, erreur, envoyer } = useEnvoiFormulaire()
  const sessionExpiree = sessionStore.finSession() === 'expiree'
  usePrechargementAccueil()

  if (estConnecte && phase === 'saisie') return <Navigate to="/" replace />

  const destination = (location.state as { depuis?: string } | null)?.depuis ?? '/'
  const entrer = (identifiants: { email: string; password: string }) =>
    envoyer(
      () => login(identifiants.email, identifiants.password),
      () => {
        annoncerArrivee(destination)
        navigate('/bienvenue', { replace: true })
      },
      'Connexion impossible.',
    )

  function soumettre(e: FormEvent) {
    e.preventDefault()
    void entrer({ email, password })
  }

  const occupe = phase !== 'saisie'

  return (
    <CadreFormulaire titre="Connexion" chapeau="Retrouvez la pluie, les cultures et les besoins de vos territoires." dissolution={phase === 'sortie'}>
      <form onSubmit={soumettre} className="mt-6 space-y-4" noValidate>
        {sessionExpiree && !erreur && <MessageErreur>Session expirée, reconnectez-vous.</MessageErreur>}
        <div>
          <label htmlFor="email" className="etiquette-nuit">Email</label>
          <input id="email" type="email" inputMode="email" autoComplete="email" required className="champ-nuit" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="nom@exemple.sn" />
        </div>
        <div>
          <label htmlFor="password" className="etiquette-nuit">Mot de passe</label>
          <ChampMotDePasse id="password" valeur={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        {erreur && <MessageErreur>{erreur}</MessageErreur>}
        <button type="submit" disabled={occupe || !email || !password} className={BOUTON_FORMULAIRE}>
          {occupe ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-5 text-sm text-white/65">
        Producteur sans compte ? <Link to="/inscription" className="font-medium text-soleil-500 underline-offset-4 hover:underline">Créer un compte</Link>
      </p>

      {config.authDemo && <ComptesDemo occupe={occupe} onEntrer={(e, p) => void entrer({ email: e, password: p })} />}
    </CadreFormulaire>
  )
}
