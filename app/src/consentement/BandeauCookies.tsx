// Bandeau de consentement : affiché tant qu'aucun choix n'est fait, et rouvert depuis le pied de page.
// « Refuser » et « Accepter » ont le même poids ; le site fonctionne à l'identique dans les deux cas.
import { Link } from 'react-router'
import { consentement, useConsentement } from './consentement'

const BOUTON = 'inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 text-sm font-semibold transition active:scale-[0.98] sm:flex-none'

export function BandeauCookies() {
  const { ouvert, choix } = useConsentement()
  if (!ouvert) return null

  return (
    <section
      aria-label="Cookies et mesure d'audience"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-4 rounded-3xl bg-vert-900 p-5 text-white shadow-2xl ring-1 ring-white/10 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Cookies et mesure d'audience</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/80">
            Le site garde dans votre navigateur ce qu'il lui faut pour fonctionner. Avec votre accord, il mesure aussi sa fréquentation, de façon anonyme et sans cookie, avec un outil hébergé chez nous (Umami).{' '}
            <Link to="/confidentialite" className="font-medium text-white underline underline-offset-4">En savoir plus</Link>
          </p>
          {choix && <p className="mt-1 text-xs text-white/65">Choix actuel : {choix.audience ? 'mesure d\'audience acceptée' : 'mesure d\'audience refusée'}.</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => consentement.choisir(false)} className={`${BOUTON} bg-white text-vert-900 hover:bg-white/85`}>Refuser</button>
          <button type="button" onClick={() => consentement.choisir(true)} className={`${BOUTON} bg-soleil-500 text-vert-900 hover:bg-soleil-100`}>Accepter</button>
        </div>
      </div>
    </section>
  )
}
