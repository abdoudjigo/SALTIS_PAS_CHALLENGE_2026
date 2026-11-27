// Assistant de la scène : on pose une question (écrite, ou dite en français au micro du navigateur), en français ou
// en wolof ; la réponse vient des données de la plateforme et des bulletins de l'ANACIM (api/voix/), jamais inventée.
// Elle est lue à voix haute : français par la voix du navigateur, wolof par la voix de synthèse du serveur (lecture.ts).
import clsx from 'clsx'
import { Loader2, MapPinned, MessageCircle, Mic, Send, Square, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError } from '../../api'
import { suivre } from '../../lib/mesure'
import type { ReponseAssistant } from '../../types/assistant'
import { arreter, decouper, lectureDisponible, lire, lireWolof, pourLOreille, useQuiParle } from './lecture'
import { langueDe } from './accueil'
import { Fille, Garcon } from './Mascottes'
import type { ProfilAccueil } from './voiceMessages'

type Langue = 'fr' | 'wo'
interface Message {
  id: number
  de: 'moi' | 'assistant'
  texte: string
  reponse?: ReponseAssistant
  erreur?: boolean
}

const CLE_VOIX = 'assaman.assistant.voix' // « 0 » : ne pas lire les réponses à voix haute
const CLE_LANGUE = 'assaman.assistant.langue'

// Exemples proposés à l'ouverture. Wolof À FAIRE RELIRE par un locuteur de l'équipe (comme wolof.ts).
const EXEMPLES: Record<Langue, (lieu: string | null) => string[]> = {
  fr: (lieu) => [
    `Quand semer l'arachide${lieu ? ` à ${lieu}` : ''} ?`,
    `Comment sera la saison${lieu ? ` à ${lieu}` : ''} ?`,
    'Que dit le dernier bulletin de l’ANACIM ?',
    `Combien d'engrais pour 1 hectare de mil${lieu ? ` à ${lieu}` : ''} ?`,
  ],
  wo: (lieu) => [
    `Kañ laa wara ji gerte${lieu ? ` ci ${lieu}` : ''} ?`,
    `Nawet bi, naka lay mel${lieu ? ` ci ${lieu}` : ''} ?`,
    'Lan la bulletin ANACIM bi mujj wax ?',
    `Ñaata ndawal laa soxla ngir benn ektaar dugub${lieu ? ` ci ${lieu}` : ''} ?`,
  ],
}
const LIBELLES = {
  fr: { titre: 'Poser une question', placeholder: 'Votre question…', bonjour: 'Bonjour ! Posez votre question sur la saison, les semis, les cultures, les engrais ou les derniers bulletins de l’ANACIM.', envoyer: 'Envoyer', micro: 'Dicter la question', ecouter: 'Écouter la réponse', francais: 'En français' },
  wo: { titre: 'Laaj ma', placeholder: 'Sa laaj…', bonjour: 'Salaam aleekum ! Laajal ma ci nawet bi, ji gi, tool yi, ndawal yi walla xibaar yu mujj yi ANACIM génne.', envoyer: 'Yónnee', micro: 'Wax sa laaj', ecouter: 'Déglu tontu bi', francais: 'Ci farañse' },
} as const

const lireStock = (cle: string) => {
  try {
    return localStorage.getItem(cle)
  } catch {
    return null
  }
}
const stocker = (cle: string, valeur: string) => {
  try {
    localStorage.setItem(cle, valeur)
  } catch {
    /* navigation privée : la préférence vaut pour la visite */
  }
}

// Reconnaissance vocale du navigateur (Chrome, Edge, Safari) : français seulement, le wolof n'y est pas proposé
type Reconnaissance = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void }
const Reconnaisseur = typeof window !== 'undefined'
  ? ((window as unknown as { SpeechRecognition?: new () => Reconnaissance; webkitSpeechRecognition?: new () => Reconnaissance }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => Reconnaissance }).webkitSpeechRecognition)
  : undefined

export interface ContexteAssistant {
  /** département affiché (choisi sur la carte, ou celui de l'agriculteur) : sert si la question n'en cite pas */
  codeDepartement: string | null
  nomDepartement: string | null
  annee: number | null
  /** écrans du profil : « Voir sur la carte » n'apparaît que pour eux */
  ecrans: string[]
}

/** Bulle flottante en bas à droite de la scène (agriculteur et ONG) : ouvre la discussion juste au-dessus d'elle.
 * `bas` : distance au bas de l'écran en pixels (sur téléphone, le tiroir de la fonctionnalité occupe le bas). */
export function AssistantFlottant({ profil, contexte, onVoir, bas = 24 }: {
  profil: ProfilAccueil
  contexte: ContexteAssistant
  onVoir: (vue: ReponseAssistant['vue']) => void
  bas?: number
}) {
  const [ouvert, setOuvert] = useState(false)
  const voir = (vue: ReponseAssistant['vue']) => {
    onVoir(vue)
    // sur téléphone, la discussion couvre la carte : on la ferme pour montrer l'écran ouvert
    if (window.innerWidth < 768) setOuvert(false)
  }
  return (
    <div className="pointer-events-none fixed right-3 z-50 flex flex-col items-end gap-3 md:right-6" style={{ bottom: `max(${bas}px, env(safe-area-inset-bottom))` }}>
      <Assistant profil={profil} ouvert={ouvert} onFermer={() => setOuvert(false)} contexte={contexte} onVoir={voir}
        className="h-[min(34rem,calc(100dvh-9rem))] w-[min(24rem,calc(100vw-1.5rem))]" />
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} aria-controls="assistant"
        aria-label={ouvert ? 'Fermer l’assistant' : 'Poser une question à l’assistant'} title={ouvert ? 'Fermer l’assistant' : 'Poser une question à l’assistant'}
        className={clsx('pointer-events-auto grid size-14 place-items-center rounded-full shadow-2xl ring-2 ring-white/20 transition hover:scale-105 focus-visible:ring-4 focus-visible:ring-white/70 focus-visible:outline-none',
          ouvert ? 'bg-encre-nuit text-white' : 'bg-soleil-500 text-encre-nuit')}>
        {ouvert ? <X className="size-6" aria-hidden /> : <MessageCircle className="size-6" aria-hidden />}
      </button>
    </div>
  )
}

/** La fenêtre de discussion. Elle reste montée fermée : la conversation est gardée pendant la visite. */
export function Assistant({ profil, ouvert, onFermer, contexte, onVoir, className }: {
  profil: ProfilAccueil
  ouvert: boolean
  onFermer: () => void
  contexte: ContexteAssistant
  onVoir: (vue: ReponseAssistant['vue']) => void
  className?: string
}) {
  const [langue, setLangueEtat] = useState<Langue>(() => (lireStock(CLE_LANGUE) as Langue | null) ?? langueDe(profil))
  const [voix, setVoix] = useState(() => lireStock(CLE_VOIX) !== '0')
  const [messages, setMessages] = useState<Message[]>([])
  const [saisie, setSaisie] = useState('')
  const [attente, setAttente] = useState(false)
  const [ecoute, setEcoute] = useState(false)
  const [lectureWo, setLectureWo] = useState<number | null>(null) // message dont la voix wolof se prépare
  const [enLecture, setEnLecture] = useState<number | null>(null)
  const qui = useQuiParle()
  const fil = useRef<HTMLDivElement>(null)
  const champ = useRef<HTMLInputElement>(null)
  const reconnaissance = useRef<Reconnaissance | null>(null)
  const compteur = useRef(0)
  const t = LIBELLES[langue]

  const setLangue = (l: Langue) => {
    setLangueEtat(l)
    stocker(CLE_LANGUE, l)
  }
  const basculerVoix = () => {
    if (voix) arreter()
    setVoix(!voix)
    stocker(CLE_VOIX, voix ? '0' : '1')
  }

  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: 'smooth' })
  }, [messages, attente])
  useEffect(() => {
    if (ouvert) champ.current?.focus()
    else {
      reconnaissance.current?.stop()
      arreter()
    }
  }, [ouvert])
  const ecouter = useCallback(async (m: Message, l: Langue) => {
    if (!m.reponse) return
    if (enLecture === m.id && qui) return arreter()
    setEnLecture(m.id)
    if (l === 'wo') {
      try {
        await lireWolof(m.reponse.texte_wo, () => setLectureWo(m.id))
        return
      } catch {
        // voix wolof indisponible (API ou service « voix ») : la réponse est dite en français
      } finally {
        setLectureWo(null)
      }
    }
    if (lectureDisponible) lire(decouper(pourLOreille(m.reponse.texte_fr)))
    else setEnLecture(null)
  }, [enLecture, qui])

  const poser = useCallback(async (texte: string) => {
    const question = texte.trim()
    if (question.length < 2 || attente) return
    arreter()
    const idQuestion = ++compteur.current
    setMessages((ms) => [...ms, { id: idQuestion, de: 'moi', texte: question }])
    setSaisie('')
    setAttente(true)
    const id = ++compteur.current
    try {
      const reponse = await api.voixTexte({ texte: question, code_departement: contexte.codeDepartement, annee: contexte.annee })
      const message: Message = { id, de: 'assistant', texte: langue === 'wo' ? reponse.texte_wo : reponse.texte_fr, reponse }
      setMessages((ms) => [...ms, message])
      suivre('assistant_question', { langue, sujet: reponse.fonctionnalite, resultat: 'ok', ia: reponse.redige_par_ia })
      if (voix) void ecouter(message, langue)
    } catch (e) {
      const texteErreur = e instanceof ApiError && e.status === 429
        ? 'Beaucoup de questions en peu de temps : réessayez dans une minute.'
        : e instanceof ApiError && e.status === 404
          ? 'L’assistant n’est pas ouvert sur ce serveur.'
          : 'L’assistant ne répond pas pour le moment (serveur injoignable). Les écrans de la carte restent disponibles.'
      setMessages((ms) => [...ms, { id, de: 'assistant', texte: texteErreur, erreur: true }])
      suivre('assistant_question', { langue, sujet: 'inconnu', resultat: 'erreur', ia: false })
    } finally {
      setAttente(false)
    }
  }, [attente, contexte.codeDepartement, contexte.annee, langue, voix, ecouter])

  const dicter = () => {
    if (!Reconnaisseur) return
    if (ecoute) return reconnaissance.current?.stop()
    arreter()
    const r = new Reconnaisseur()
    r.lang = 'fr-FR'
    r.interimResults = false
    r.onresult = (e) => {
      const dit = e.results[0]?.[0]?.transcript ?? ''
      if (dit) void poser(dit)
    }
    r.onend = () => setEcoute(false)
    r.onerror = () => setEcoute(false)
    reconnaissance.current = r
    setEcoute(true)
    r.start()
  }

  const envoyer = (e: FormEvent) => {
    e.preventDefault()
    void poser(saisie)
  }

  if (!ouvert) return null
  return (
        <section id="assistant" aria-label="Assistant" style={{ background: 'var(--color-encre-nuit)' }} className={clsx('verre-scene pointer-events-auto flex flex-col overflow-hidden rounded-2xl text-white shadow-2xl', className)}>
          <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <span className="size-8 shrink-0 overflow-hidden rounded-full">{langue === 'wo' ? <Fille /> : <Garcon />}</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-titre text-sm font-semibold">{t.titre}</p>
              <p className="hidden text-2xs text-white/60 sm:block">Données de la plateforme et bulletins ANACIM</p>
            </div>
            <div role="radiogroup" aria-label="Langue des réponses" className="flex rounded-full border border-white/20 p-0.5 text-xs font-semibold">
              {(['fr', 'wo'] as const).map((l) => (
                <button key={l} type="button" role="radio" aria-checked={langue === l} onClick={() => setLangue(l)}
                  className={clsx('min-h-8 rounded-full px-2.5 transition', langue === l ? (l === 'fr' ? 'bg-pluie-500 text-white' : 'bg-soleil-500 text-encre-nuit') : 'text-white/70 hover:text-white')}>
                  {l === 'fr' ? 'FR' : 'WLF'}
                </button>
              ))}
            </div>
            <button type="button" onClick={basculerVoix} aria-pressed={voix} title={voix ? 'Ne plus lire les réponses à voix haute' : 'Lire les réponses à voix haute'}
              aria-label={voix ? 'Ne plus lire les réponses à voix haute' : 'Lire les réponses à voix haute'}
              className="grid size-9 place-items-center rounded-lg text-white/70 transition hover:text-white">
              {voix ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
            </button>
            <button type="button" onClick={onFermer} aria-label="Fermer l’assistant" className="grid size-9 place-items-center rounded-lg text-white/70 transition hover:text-white">
              <X className="size-4" aria-hidden />
            </button>
          </header>

          <div ref={fil} className="flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
            <p className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-sm leading-relaxed">{t.bonjour}</p>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                {EXEMPLES[langue](contexte.nomDepartement).map((q) => (
                  <button key={q} type="button" onClick={() => void poser(q)}
                    className="min-h-9 rounded-full border border-white/20 px-3 text-left text-xs text-white/85 transition hover:border-white/50 hover:text-white">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m) => m.de === 'moi' ? (
              <p key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-pluie-500/80 px-3 py-2 text-sm leading-relaxed">{m.texte}</p>
            ) : (
              <MessageAssistant key={m.id} message={m} langue={langue} ecrans={contexte.ecrans} parle={enLecture === m.id && qui !== null}
                prepare={lectureWo === m.id} onEcouter={() => void ecouter(m, langue)} onVoir={onVoir} libelleEcouter={t.ecouter} libelleFrancais={t.francais} />
            ))}
            {attente && <p className="flex items-center gap-2 text-xs text-white/60"><Loader2 className="size-3.5 animate-spin" aria-hidden />Je cherche dans les données…</p>}
          </div>

          <form onSubmit={envoyer} className="flex items-center gap-1.5 border-t border-white/10 p-2">
            <label htmlFor="assistant-question" className="sr-only">{t.placeholder}</label>
            <input id="assistant-question" ref={champ} value={saisie} onChange={(e) => setSaisie(e.target.value)} maxLength={500}
              placeholder={ecoute ? 'Je vous écoute…' : t.placeholder} autoComplete="off" enterKeyHint="send"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-encre-nuit/40 px-3 text-sm text-white placeholder:text-white/45 focus:border-white/50 focus:outline-none" />
            {Reconnaisseur && langue === 'fr' && (
              <button type="button" onClick={dicter} aria-pressed={ecoute} aria-label={t.micro} title={t.micro}
                className={clsx('grid size-11 place-items-center rounded-xl transition', ecoute ? 'ecoute-en-cours bg-alerte-500 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white')}>
                <Mic className="size-4" aria-hidden />
              </button>
            )}
            <button type="submit" disabled={saisie.trim().length < 2 || attente} aria-label={t.envoyer} title={t.envoyer}
              className="grid size-11 place-items-center rounded-xl bg-soleil-500 text-encre-nuit transition hover:brightness-105 disabled:opacity-40">
              <Send className="size-4" aria-hidden />
            </button>
          </form>
        </section>
  )
}

function MessageAssistant({ message: m, langue, ecrans, parle, prepare, onEcouter, onVoir, libelleEcouter, libelleFrancais }: {
  message: Message
  langue: Langue
  ecrans: string[]
  parle: boolean
  prepare: boolean
  onEcouter: () => void
  onVoir: (vue: ReponseAssistant['vue']) => void
  libelleEcouter: string
  libelleFrancais: string
}) {
  const r = m.reponse
  const texte = r ? (langue === 'wo' ? r.texte_wo : r.texte_fr) : m.texte
  const voir = r?.vue.mode && ecrans.includes(r.vue.mode) ? r.vue : null
  return (
    <div className="max-w-[92%] space-y-1.5">
      <div className={clsx('rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed', m.erreur ? 'bg-alerte-500/25 text-white' : 'bg-white/10')}>
        <p>{texte}</p>
        {r && langue === 'wo' && (
          <details className="mt-1.5 text-xs text-white/70">
            <summary className="cursor-pointer select-none">{libelleFrancais}</summary>
            <p className="mt-1">{r.texte_fr}</p>
          </details>
        )}
      </div>
      {r && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1 text-2xs text-white/60">
          <button type="button" onClick={onEcouter} aria-label={parle ? 'Arrêter la lecture' : libelleEcouter} aria-pressed={parle}
            className={clsx('inline-flex min-h-8 items-center gap-1 rounded-full border border-white/15 px-2 text-white/80 transition hover:text-white', parle && 'ecoute-en-cours')}>
            {prepare ? <Loader2 className="size-3 animate-spin" aria-hidden /> : parle ? <Square className="size-3 fill-current" aria-hidden /> : <Volume2 className="size-3" aria-hidden />}
            {prepare ? 'La voix wolof se prépare…' : parle ? 'Arrêter' : libelleEcouter}
          </button>
          {voir && (
            <button type="button" onClick={() => onVoir(voir)} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-white/15 px-2 text-white/80 transition hover:text-white">
              <MapPinned className="size-3" aria-hidden />Voir sur la carte
            </button>
          )}
          {r.nature && <span>{r.nature}</span>}
          {r.redige_par_ia && <span title="Texte rédigé par un modèle de langue à partir des extraits cités">· rédigé par IA</span>}
        </div>
      )}
      {r?.sources.length ? (
        <p className="pl-1 text-2xs text-white/50">Source : {r.sources[0].titre}{r.sources.length > 1 ? ` (et ${r.sources.length - 1} autre${r.sources.length > 2 ? 's' : ''})` : ''}</p>
      ) : null}
    </div>
  )
}
