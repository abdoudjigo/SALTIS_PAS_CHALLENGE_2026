import { config } from '../../config'
import { PAGES } from '../../lib/pages'
import { AdresseContact } from './AdresseContact'
import { PageSite, Partie } from './PageSite'

export default function Contact() {
  return (
    <PageSite titre={PAGES.contact.titre} description={PAGES.contact.description} chapeau="Une question sur la plateforme, une donnée à partager, une collaboration à proposer : écrivez-nous.">
      <Partie titre="Écrire à l'équipe">
        {config.aUnContact ? (
          <p>
            <AdresseContact />
          </p>
        ) : (
          <p>L'adresse de contact sera publiée prochainement.</p>
        )}
      </Partie>
      <Partie titre="Nous suivre">
        <ul className="space-y-2">
          {config.reseaux.map((r) => (
            <li key={r.nom}>
              {r.url ? <a href={r.url} className="font-medium text-vert-700 underline underline-offset-4" target="_blank" rel="noreferrer">{r.nom}</a> : <span>{r.nom} : bientôt</span>}
            </li>
          ))}
        </ul>
      </Partie>
      <Partie titre="Partenaires de données">
        <p>Vous détenez des doses d'engrais validées, des rendements récents ou des relevés de stations ? Ils amélioreraient directement les prévisions : contactez-nous.</p>
      </Partie>
    </PageSite>
  )
}
