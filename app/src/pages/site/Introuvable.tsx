import { Link } from 'react-router'
import { PageSite } from './PageSite'

export default function Introuvable() {
  return (
    <PageSite titre="Page introuvable" chapeau="Cette adresse ne mène à aucune page.">
      <p>
        <Link to="/" className="font-medium text-vert-700 underline underline-offset-4">Revenir à l'accueil</Link>
      </p>
    </PageSite>
  )
}
