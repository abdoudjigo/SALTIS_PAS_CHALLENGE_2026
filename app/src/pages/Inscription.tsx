import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useReferentiels } from '../hooks/donnees'
import type { DonneesInscription } from '../types/auth'
import { annoncerArrivee } from '../vitrine/bienvenue'
import { BOUTON_FORMULAIRE, CadreFormulaire, MessageErreur } from '../vitrine/CadreFormulaire'
import { CarteDepartements } from '../vitrine/CarteDepartements'
import { ChampMotDePasse } from '../vitrine/ChampMotDePasse'
import { usePrechargementAccueil } from '../vitrine/prechargement'
import { useEnvoiFormulaire } from '../vitrine/sortieFormulaire'

const LONGUEUR_MIN_MOT_DE_PASSE = 8

// Inscription libre réservée aux producteurs. Les comptes d'organisation (ONG, État)
// et de conseiller sont créés par un administrateur.
export default function Inscription() {
  const { register, estConnecte } = useAuth()
  const navigate = useNavigate()
  const { data: ref } = useReferentiels()
  const [f, setF] = useState<DonneesInscription>({ nom: '', email: '', password: '', code_departement: '' })
  const { phase, erreur, setErreur, envoyer } = useEnvoiFormulaire()
  const maj = (k: keyof DonneesInscription) => (valeur: string) => setF((avant) => ({ ...avant, [k]: valeur }))
  const departements = useMemo(() => [...(ref?.departements ?? [])].sort((a, b) => a.departement.localeCompare(b.departement, 'fr')), [ref])
  const choisi = departements.find((d) => d.code_departement === f.code_departement)
  usePrechargementAccueil()

  if (estConnecte && phase === 'saisie') return <Navigate to="/" replace />

  function soumettre(e: FormEvent) {
    e.preventDefault()
    if (!f.nom.trim() || !f.email.trim()) return setErreur('Indiquez votre nom et votre email.')
    if (!f.code_departement) return setErreur('Choisissez le département de vos champs, sur la carte ou dans la liste.')
    if (f.password.length < LONGUEUR_MIN_MOT_DE_PASSE) return setErreur(`Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`)
    void envoyer(
      () => register(f),
      () => {
        annoncerArrivee('/')
        navigate('/bienvenue', { replace: true })
      },
      'Inscription impossible.',
    )
  }

  const occupe = phase !== 'saisie'

  return (
    <CadreFormulaire
      titre="Créer un compte producteur"
      chapeau="Les ONG, les services de l'État et les conseillers reçoivent leur accès d'un administrateur."
      dissolution={phase === 'sortie'}
    >
      <form onSubmit={soumettre} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="nom" className="etiquette-nuit">Nom complet</label>
          <input id="nom" required autoComplete="name" className="champ-nuit" value={f.nom} onChange={(e) => maj('nom')(e.target.value)} />
        </div>
        <div>
          <label htmlFor="email" className="etiquette-nuit">Email</label>
          <input id="email" type="email" inputMode="email" required autoComplete="email" className="champ-nuit" value={f.email}
            onChange={(e) => maj('email')(e.target.value)} placeholder="nom@exemple.sn" />
        </div>

        <div>
          <label htmlFor="dep" className="etiquette-nuit">Département de vos champs</label>
          <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-3">
            <CarteDepartements departements={departements} selection={f.code_departement} onSelect={maj('code_departement')} />
            <p className="mt-1 min-h-6 text-center text-sm" aria-live="polite">
              {choisi
                ? <><span className="font-medium text-soleil-500">{choisi.departement}</span> <span className="text-white/55">· région de {choisi.region}</span></>
                : <span className="text-white/50">Touchez votre département sur la carte</span>}
            </p>
          </div>
          <select id="dep" required className="champ-nuit mt-2" value={f.code_departement} onChange={(e) => maj('code_departement')(e.target.value)}>
            <option value="" className="text-encre">Ou choisir dans la liste…</option>
            {departements.map((d) => <option key={d.code_departement} value={d.code_departement} className="text-encre">{d.departement} ({d.region})</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="mdp" className="etiquette-nuit">Mot de passe</label>
          <ChampMotDePasse id="mdp" valeur={f.password} onChange={maj('password')} autoComplete="new-password"
            minLength={LONGUEUR_MIN_MOT_DE_PASSE} decritPar="aide-mdp" />
          <p id="aide-mdp" className="mt-1.5 text-xs text-white/50">{LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum.</p>
        </div>

        {erreur && <MessageErreur>{erreur}</MessageErreur>}
        <button type="submit" disabled={occupe} className={BOUTON_FORMULAIRE}>
          {occupe ? 'Création du compte…' : 'Créer mon compte'}
        </button>
      </form>
      <p className="mt-5 text-sm text-white/65">
        Déjà inscrit ? <Link to="/connexion" className="font-medium text-soleil-500 underline-offset-4 hover:underline">Se connecter</Link>
      </p>
    </CadreFormulaire>
  )
}
