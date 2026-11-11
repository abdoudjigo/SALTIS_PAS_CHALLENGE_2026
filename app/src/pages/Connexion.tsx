import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { MOT_DE_PASSE_DEMO, UTILISATEURS_DEMO } from '../api/mock/comptes'
import { useAuth } from '../auth/AuthContext'
import { ROLES } from '../auth/roles'
import { config } from '../config'
import { AuthLayout } from './AuthLayout'

export default function Connexion() {
  const { login, estConnecte } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [voir, setVoir] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  if (estConnecte) return <Navigate to="/" replace />

  async function soumettre(e: FormEvent | null, identifiants = { email, password }) {
    e?.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      await login(identifiants.email, identifiants.password)
      navigate((location.state as { depuis?: string } | null)?.depuis ?? '/', { replace: true })
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Connexion impossible.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <AuthLayout>
      <img src="/favicon.svg" alt="" className="mb-6 size-12 lg:hidden" />
      <h2 className="text-2xl font-semibold tracking-tight">Connexion</h2>
      <p className="mt-1 text-sm text-encre-douce">Accédez à votre espace de décision agricole.</p>

      <form onSubmit={soumettre} className="mt-7 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="etiquette">Email</label>
          <input id="email" type="email" autoComplete="email" required className="champ" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="nom@exemple.sn" />
        </div>
        <div>
          <label htmlFor="password" className="etiquette">Mot de passe</label>
          <div className="relative">
            <input id="password" type={voir ? 'text' : 'password'} autoComplete="current-password" required className="champ pr-11"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setVoir(!voir)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-encre-douce hover:bg-stone-100"
              aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
              {voir ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {erreur && <p role="alert" className="rounded-xl bg-alerte-100 px-3 py-2 text-sm text-alerte-700">{erreur}</p>}
        <button type="submit" disabled={envoi || !email || !password}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-vert-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-vert-900 disabled:opacity-50">
          {envoi ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Se connecter
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-encre-douce">
        Producteur sans compte ? <Link to="/inscription" className="font-medium text-vert-700 hover:underline">Créer un compte</Link>
      </p>

      {config.useMock && (
        <div className="mt-8 rounded-2xl border border-dashed border-trait p-4">
          <p className="text-xs font-medium tracking-wide text-encre-douce uppercase">Comptes de démonstration</p>
          <div className="mt-3 grid gap-2">
            {UTILISATEURS_DEMO.map((u) => (
              <button key={u.email} disabled={envoi} onClick={() => soumettre(null, { email: u.email, password: MOT_DE_PASSE_DEMO })}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm ring-1 ring-trait transition hover:ring-vert-500">
                <span className="font-medium">{u.organisation?.nom ?? ROLES[u.role].libelle}</span>
                <span className="text-xs text-encre-douce">{u.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-encre-douce">Mot de passe : <code>{MOT_DE_PASSE_DEMO}</code></p>
        </div>
      )}
    </AuthLayout>
  )
}
