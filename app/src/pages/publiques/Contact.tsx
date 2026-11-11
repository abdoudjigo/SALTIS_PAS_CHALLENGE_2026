import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { config } from '../../config'
import { PagePublique, Rubrique } from '../../vitrine/PagePublique'

const SUJETS = [
  'Je suis producteur et j’ai une question',
  'Mon organisation souhaite un accès (ONG, service de l’État)',
  'Je suis conseiller agricole',
  'Partenariat ou financement',
  'Signaler une donnée à corriger',
  'Autre',
]

const CHAMP = 'w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 text-base text-white transition placeholder:text-white/35 focus:border-soleil-500 focus:ring-2 focus:ring-soleil-500/25 focus:outline-none'
const ETIQUETTE = 'mb-1.5 block text-xs font-medium tracking-wide text-brume uppercase'

export default function Contact() {
  const [nom, setNom] = useState('')
  const [sujet, setSujet] = useState(SUJETS[0])
  const [message, setMessage] = useState('')
  const disponible = Boolean(config.emailContact)

  // Pas de serveur d'envoi : le message s'ouvre dans la messagerie du visiteur, qui l'envoie lui-même
  function ecrire(e: FormEvent) {
    e.preventDefault()
    const corps = `${message}\n\n${nom}`
    window.location.href = `mailto:${config.emailContact}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`
  }

  return (
    <PagePublique
      surtitre="Contact"
      titre="Parlons de vos champs, de vos territoires, de vos données."
      chapeau="Producteur, organisation, conseiller ou partenaire : dites-nous qui vous êtes, nous vous répondrons."
    >
      <Rubrique titre="Nous écrire">
        <form onSubmit={ecrire} className="space-y-5">
          <div>
            <label htmlFor="contact-nom" className={ETIQUETTE}>Votre nom</label>
            <input id="contact-nom" required autoComplete="name" className={CHAMP} value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="contact-sujet" className={ETIQUETTE}>Votre demande</label>
            <select id="contact-sujet" className={CHAMP} value={sujet} onChange={(e) => setSujet(e.target.value)}>
              {SUJETS.map((s) => <option key={s} value={s} className="text-encre">{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="contact-message" className={ETIQUETTE}>Votre message</label>
            <textarea id="contact-message" required rows={6} className={CHAMP} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Votre département, votre organisation, votre question…" />
          </div>
          <button type="submit" disabled={!disponible}
            className="inline-flex min-h-12 items-center rounded-full bg-soleil-500 px-6 text-[15px] font-semibold text-nuit-900 transition hover:bg-soleil-100 disabled:cursor-not-allowed disabled:opacity-40">
            Ouvrir dans ma messagerie
          </button>
          <p className="text-sm text-white/55" role={disponible ? undefined : 'status'}>
            {disponible
              ? <>Le message s'ouvre dans votre messagerie, prêt à être envoyé à <a href={`mailto:${config.emailContact}`} className="text-soleil-500 underline-offset-4 hover:underline">{config.emailContact}</a>. Rien n'est enregistré sur ce site.</>
              : "L'adresse de contact de l'équipe sera publiée ici très bientôt."}
          </p>
        </form>
      </Rubrique>

      <Rubrique titre="Obtenir un accès">
        <p>
          <span className="font-medium text-white">Producteurs.</span> Le compte se crée librement, en indiquant le département de vos champs :{' '}
          <Link to="/inscription" className="text-soleil-500 underline-offset-4 hover:underline">créer un compte</Link>.
        </p>
        <p>
          <span className="font-medium text-white">ONG, services de l'État, conseillers agricoles.</span> Les comptes sont ouverts par un
          administrateur de la plateforme. Écrivez-nous en précisant votre organisation et les territoires que vous suivez.
        </p>
      </Rubrique>

      <Rubrique titre="Une donnée vous semble fausse ?">
        <p>
          Dites-nous le département, la culture et l'écran concernés. Les seuils et les recommandations doivent être validés par ceux
          qui connaissent le terrain : vos retours font partie du projet.
        </p>
      </Rubrique>
    </PagePublique>
  )
}
