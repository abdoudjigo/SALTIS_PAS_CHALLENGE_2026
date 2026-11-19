// « Donner votre avis » (espace ONG) : un formulaire court, envoyé à l'équipe AKAI par FormSubmit.
// Aucun champ obligatoire. Modale accessible : Échap ferme, focus piégé, focus rendu au bouton.
import { MessageSquare, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { config } from '../config'
import { PARCOURS_ONG } from './cadre'

const TYPES = ['ONG nationale', 'ONG internationale', "Agence de l'ONU", "Service de l'État", 'Organisation de producteurs', 'Autre']
const USAGE = ['Oui', 'Peut-être', 'Non']
const ETIQUETTE = 'block text-xs font-medium text-white/80'
type Etat = 'saisie' | 'envoi' | 'envoye' | 'echec'

export function AvisOng({ annee, etape }: { annee: number | null; etape: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, setEtat] = useState<Etat>('saisie')
  const bouton = useRef<HTMLButtonElement>(null)
  const boite = useRef<HTMLDivElement>(null)
  const titre = useId()

  const fermer = () => {
    setOuvert(false)
    bouton.current?.focus()
  }

  // Focus dans la fenêtre à l'ouverture ; Échap ferme ; Tab reste dans la fenêtre
  useEffect(() => {
    if (!ouvert) return
    const el = boite.current
    el?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOuvert(false)
        bouton.current?.focus()
        return
      }
      if (e.key !== 'Tab' || !el) return
      const focusables = [...el.querySelectorAll<HTMLElement>('input:not([type=hidden]):not([tabindex="-1"]), select, textarea, button:not([disabled])')]
      if (focusables.length === 0) return
      const premier = focusables[0]
      const dernier = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault()
        premier.focus()
      }
    }
    document.addEventListener('keydown', clavier)
    return () => document.removeEventListener('keydown', clavier)
  }, [ouvert])

  const envoyer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const champs = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setEtat('envoi')
    try {
      const r = await fetch(config.urlAvisOng, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...champs,
          'Année ouverte': annee ?? 'non disponible',
          'Étape ouverte': etape,
          _subject: 'Avis ONG – Assaman & Suuf',
          _template: 'table',
          _captcha: 'false',
        }),
      })
      setEtat(r.ok ? 'envoye' : 'echec')
    } catch {
      setEtat('echec')
    }
  }

  return (
    <>
      <button ref={bouton} type="button" onClick={() => { setEtat('saisie'); setOuvert(true) }} aria-haspopup="dialog" title="Donner votre avis"
        className="avis-appel verre-scene flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-white/90 transition hover:text-white">
        <MessageSquare className="size-4 text-soleil-500" aria-hidden />
        <span className="hidden sm:inline">Donner votre avis</span>
        <span className="sr-only sm:hidden">Donner votre avis</span>
      </button>

      {/* Rendue dans <body> : le conteneur du bouton est décalé (translate), ce qui piégeait la position « fixed » */}
      {ouvert && createPortal(
        <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={fermer}>
          <div ref={boite} role="dialog" aria-modal="true" aria-labelledby={titre} onClick={(e) => e.stopPropagation()}
            className="verre-scene max-h-[calc(100svh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <h2 id={titre} className="font-titre text-xl font-semibold">Donner votre avis</h2>
              <button type="button" onClick={fermer} aria-label="Fermer" className="grid size-11 shrink-0 place-items-center rounded-lg text-white/70 hover:text-white">
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {etat === 'envoye' ? (
              <p role="status" className="mt-4 text-sm text-white/90">Merci, votre avis a bien été envoyé</p>
            ) : (
              <form onSubmit={envoyer} className="mt-4 space-y-3.5">
                {/* Piège à robots : invisible et hors du clavier */}
                <input type="text" name="_honey" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                <label className={ETIQUETTE}>Nom de l'organisation
                  <input name="Nom de l'organisation" type="text" className="champ-scene mt-1 w-full" />
                </label>
                <label className={ETIQUETTE}>Type d'organisation
                  <select name="Type d'organisation" defaultValue="" className="champ-scene mt-1 w-full">
                    <option value="">—</option>
                    {TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label className={ETIQUETTE}>Régions où vous intervenez
                  <input name="Régions où vous intervenez" type="text" className="champ-scene mt-1 w-full" />
                </label>
                <label className={ETIQUETTE}>L'étape la plus utile pour vous
                  <select name="L'étape la plus utile pour vous" defaultValue="" className="champ-scene mt-1 w-full">
                    <option value="">—</option>
                    {PARCOURS_ONG.map((p) => <option key={p.id}>{p.question}</option>)}
                  </select>
                </label>
                <label className={ETIQUETTE}>Qu'avez-vous cherché sans le trouver ?
                  <textarea name="Qu'avez-vous cherché sans le trouver ?" rows={3} className="champ-scene mt-1 w-full" />
                </label>
                <fieldset>
                  <legend className={ETIQUETTE}>L'utiliseriez-vous pour votre prochaine campagne ?</legend>
                  <div className="mt-1 flex flex-wrap gap-x-4">
                    {USAGE.map((u) => (
                      <label key={u} className="flex min-h-11 items-center gap-2 text-sm text-white/90">
                        <input type="radio" name="L'utiliseriez-vous pour votre prochaine campagne ?" value={u} className="size-4 accent-soleil-500" />{u}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className={ETIQUETTE}>Un problème rencontré ?
                  <textarea name="Un problème rencontré ?" rows={3} className="champ-scene mt-1 w-full" />
                </label>

                <button type="submit" disabled={etat === 'envoi'} className="min-h-11 w-full rounded-lg bg-soleil-500 px-4 text-sm font-semibold text-encre-nuit transition disabled:opacity-70">
                  {etat === 'envoi' ? 'Envoi…' : 'Envoyer'}
                </button>
                {etat === 'echec' && <p role="alert" className="text-sm text-soleil-500">L'envoi n'a pas marché. Écrivez-nous à akai.tech.data@gmail.com</p>}
                <p className="text-xs leading-relaxed text-white/60">Vos réponses sont envoyées à l'équipe AKAI via le service FormSubmit et servent uniquement à améliorer la plateforme.</p>
              </form>
            )}
          </div>
        </div>
      , document.body)}
    </>
  )
}
