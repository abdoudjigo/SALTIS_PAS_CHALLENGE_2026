import { Loader2, UserPlus } from 'lucide-react'
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useReferentiels } from '../hooks/donnees'
import type { DonneesInscription } from '../types/auth'
import { AuthLayout } from './AuthLayout'

// Inscription libre réservée aux producteurs. Les comptes d'organisation (ONG, État)
// et de conseiller sont créés par un administrateur.
export default function Inscription() {
  const { register, estConnecte } = useAuth()
  const navigate = useNavigate()
  const { data: ref } = useReferentiels()
  const [f, setF] = useState<DonneesInscription>({ nom: '', email: '', password: '', code_departement: '' })
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const maj = (k: keyof DonneesInscription) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const deps = useMemo(() => [...(ref?.departements ?? [])].sort((a, b) => a.departement.localeCompare(b.departement, 'fr')), [ref])

  if (estConnecte) return <Navigate to="/" replace />

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    if (f.password.length < 8) return setErreur('Le mot de passe doit contenir au moins 8 caractères.')
    setErreur(null)
    setEnvoi(true)
    try {
      await register(f)
      navigate('/', { replace: true })
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Inscription impossible.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold tracking-tight">Créer un compte producteur</h2>
      <p className="mt-1 text-sm text-encre-douce">Les organisations (ONG, services de l'État) reçoivent leur accès d'un administrateur.</p>
      <form onSubmit={soumettre} className="mt-7 space-y-4">
        <div>
          <label htmlFor="nom" className="etiquette">Nom complet</label>
          <input id="nom" required autoComplete="name" className="champ" value={f.nom} onChange={maj('nom')} />
        </div>
        <div>
          <label htmlFor="email" className="etiquette">Email</label>
          <input id="email" type="email" required autoComplete="email" className="champ" value={f.email} onChange={maj('email')} />
        </div>
        <div>
          <label htmlFor="dep" className="etiquette">Département de vos champs</label>
          <select id="dep" className="champ" value={f.code_departement} onChange={maj('code_departement')}>
            <option value="">Choisir…</option>
            {deps.map((d) => <option key={d.code_departement} value={d.code_departement}>{d.departement} ({d.region})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="mdp" className="etiquette">Mot de passe (8 caractères minimum)</label>
          <input id="mdp" type="password" required minLength={8} autoComplete="new-password" className="champ" value={f.password} onChange={maj('password')} />
        </div>
        {erreur && <p role="alert" className="rounded-xl bg-alerte-100 px-3 py-2 text-sm text-alerte-700">{erreur}</p>}
        <button type="submit" disabled={envoi}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-vert-700 px-4 py-3 text-sm font-semibold text-white hover:bg-vert-900 disabled:opacity-50">
          {envoi ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Créer mon compte
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-encre-douce">
        Déjà inscrit ? <Link to="/connexion" className="font-medium text-vert-700 hover:underline">Se connecter</Link>
      </p>
    </AuthLayout>
  )
}
