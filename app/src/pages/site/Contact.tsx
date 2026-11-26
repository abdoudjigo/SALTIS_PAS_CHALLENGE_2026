import { config } from '../../config'
import { PAGES } from '../../lib/pages'
import { EMAIL_EQUIPE, EQUIPE } from '../../landing/equipe'
import { Linkedin } from '../../landing/PiedDePage'
import { PageSite, Partie } from './PageSite'

export default function Contact() {
  return (
    <PageSite titre={PAGES.contact.titre} description={PAGES.contact.description} chapeau="Une question sur la plateforme, une donnée à partager, une collaboration à proposer : écrivez-nous.">
      <Partie titre="Écrire à l'équipe">
        <p className="font-medium">AKAI TECH</p>
        <p><a href={`mailto:${EMAIL_EQUIPE}`} className="font-medium text-vert-700 underline underline-offset-4">{EMAIL_EQUIPE}</a></p>
      </Partie>
      <Partie titre="L'équipe sur LinkedIn">
        <ul className="space-y-2">
          {EQUIPE.map(([nom, url]) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-medium text-vert-700 underline underline-offset-4">
                <Linkedin className="size-4 shrink-0" />{nom}<span className="sr-only"> (LinkedIn, nouvel onglet)</span>
              </a>
            </li>
          ))}
        </ul>
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
      <Partie titre="Vous êtes une ONG ou un service de l'État">
        <p>Depuis votre espace, le bouton « Donner votre avis », en haut de l'écran, nous envoie vos remarques directement : ce qui manque, ce qui est faux, ce qui vous aiderait.</p>
      </Partie>
      <Partie titre="Partenaires de données">
        <p>Vous détenez des doses d'engrais validées, des récoltes récentes par département ou des relevés de stations ? Ils amélioreraient directement les prévisions : contactez-nous.</p>
      </Partie>
    </PageSite>
  )
}
