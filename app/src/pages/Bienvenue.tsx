import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useReferentiels } from '../hooks/donnees'
import { arrivee, dejaAccueilli, genreMascotte, messageBienvenue, noterAccueil } from '../vitrine/bienvenue'
import { Mascotte } from '../vitrine/Mascotte'
import { useModeRendu } from '../vitrine/modeRendu'

const DELAI_VOIX_MS = 900
const MS_PAR_LETTRE = 26
const PAUSE_VERSION_COURTE_MS = 2600

/** Fait apparaître le texte lettre à lettre, comme une voix. Sans animation : le texte entier, tout de suite. */
function useVoix(texte: string, anime: boolean) {
  const [lettres, setLettres] = useState(anime ? 0 : texte.length)
  useEffect(() => {
    if (!anime) return
    let minuteur = 0
    const debut = window.setTimeout(() => {
      minuteur = window.setInterval(() => setLettres((n) => Math.min(n + 1, texte.length)), MS_PAR_LETTRE)
    }, DELAI_VOIX_MS)
    return () => {
      clearTimeout(debut)
      clearInterval(minuteur)
    }
  }, [texte, anime])
  const affichees = anime ? Math.min(lettres, texte.length) : texte.length
  return { visible: texte.slice(0, affichees), termine: affichees === texte.length }
}

export default function Bienvenue() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const mode = useModeRendu()
  const { data: ref } = useReferentiels()
  // Figé à l'arrivée : la version (longue ou courte) ne change pas pendant qu'on lit
  const [court] = useState(() => (user ? dejaAccueilli(user) : false))
  const departement = ref?.departements.find((d) => d.code_departement === user?.code_departement)
  const texte = user ? messageBienvenue(user, departement, court) : ''
  const { visible, termine } = useVoix(texte, mode.animations)

  useEffect(() => {
    if (user && arrivee.enCours) noterAccueil(user)
  }, [user])

  const continuer = () => {
    arrivee.enCours = false
    navigate(arrivee.destination, { replace: true })
  }

  // La version courte ne dure que quelques secondes
  useEffect(() => {
    if (!court || !termine || !arrivee.enCours) return
    const minuteur = window.setTimeout(() => {
      arrivee.enCours = false
      navigate(arrivee.destination, { replace: true })
    }, PAUSE_VERSION_COURTE_MS)
    return () => clearTimeout(minuteur)
  }, [court, termine, navigate])

  if (!user || !arrivee.enCours) return <Navigate to="/" replace />

  return (
    <main className="relative flex min-h-svh flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10 lg:px-[6vw]">
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-9" />
        <span className="font-titre text-lg tracking-tight">Assaman & Suuf</span>
      </div>

      <div className="flex flex-1 flex-col md:flex-row md:items-end md:gap-2">
        <section aria-label="Mot de bienvenue" className="bulle verre vitrine-entree relative mt-6 w-full rounded-3xl p-5 sm:p-7 md:order-2 md:mt-0 md:mb-[34svh] md:max-w-md" style={{ animationDelay: '0.5s' }}>
          <p className="sr-only">{texte}</p>
          <p aria-hidden className="min-h-[5.5em] font-titre text-[1.35rem] leading-snug sm:text-2xl">
            {visible}
            {!termine && <span className="bulle-curseur" />}
          </p>
          <div className="mt-5 flex items-center gap-5">
            <button type="button" onClick={continuer} autoFocus
              className="inline-flex min-h-12 items-center rounded-full bg-soleil-500 px-6 text-[15px] font-semibold text-nuit-900 transition hover:bg-soleil-100 active:scale-[0.98]">
              Commencer
            </button>
            <button type="button" onClick={continuer} className="min-h-11 text-sm text-white/60 underline-offset-4 transition hover:text-white hover:underline">
              Passer
            </button>
          </div>
        </section>

        <Mascotte genre={genreMascotte(user)} anime={mode.animations}
          className="mt-auto h-[44svh] max-h-[460px] shrink-0 self-start md:order-1 md:h-[66svh] md:max-h-[600px] md:self-end" />
      </div>
    </main>
  )
}
