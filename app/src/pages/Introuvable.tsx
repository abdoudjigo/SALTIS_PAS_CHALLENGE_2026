import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { EtatVide } from '../components/ui/EtatVide'

export default function Introuvable() {
  return (
    <EtatVide icone={Compass} titre="Page introuvable" texte="Cette adresse ne correspond à aucun écran."
      action={<Link to="/" className="mt-2 rounded-xl bg-vert-700 px-4 py-2 text-sm font-medium text-white hover:bg-vert-900">Retour à l'accueil</Link>} />
  )
}
