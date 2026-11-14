// Les deux voix de la plateforme : le garçon lit en français (synthèse du navigateur), la fille lit en wolof
// (texte traduit à l'avance, voix du Space Hugging Face, voir voix/README.md). Badges « FR » et « WLF ».
import clsx from 'clsx'
import { Loader2, Square } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import { arreter, lectureDisponible, lire, lireAudio, pourLOreille, useQuiParle, type Parleur } from './lecture'

const visage = 'var(--color-terre-700)'

function Garcon() {
  return (
    <svg viewBox="0 0 40 40" className="size-full" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="var(--color-pluie-100)" />
      <path d="M8 40c1-8 6-12 12-12s11 4 12 12z" fill="var(--color-pluie-500)" />
      <circle cx="20" cy="18" r="9" fill={visage} />
      <path d="M11 16c0-6 4-9 9-9s9 3 9 9c-2-3-5-4-9-4s-7 1-9 4z" fill="var(--color-encre-nuit)" />
      <circle cx="16.8" cy="19" r="1.1" fill="var(--color-encre-nuit)" />
      <circle cx="23.2" cy="19" r="1.1" fill="var(--color-encre-nuit)" />
      <path d="M17 22.5c1.8 1.6 4.2 1.6 6 0" stroke="var(--color-terre-100)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function Fille() {
  return (
    <svg viewBox="0 0 40 40" className="size-full" aria-hidden>
      <circle cx="20" cy="20" r="20" fill="var(--color-soleil-100)" />
      <path d="M8 40c1-8 6-12 12-12s11 4 12 12z" fill="var(--color-vert-500)" />
      <circle cx="20" cy="19" r="8.6" fill={visage} />
      {/* foulard (moussor) */}
      <path d="M10.5 17c-.5-7 4-11 9.5-11s10 4 9.5 11c-2.5-3.5-5.6-5-9.5-5s-7 1.5-9.5 5z" fill="var(--color-soleil-500)" />
      <path d="M27 9.5c3 0 5 2.5 4 5.5-1.5-1.8-3-2.6-4.6-2.8z" fill="var(--color-alerte-500)" />
      <circle cx="16.8" cy="19.6" r="1.1" fill="var(--color-encre-nuit)" />
      <circle cx="23.2" cy="19.6" r="1.1" fill="var(--color-encre-nuit)" />
      <path d="M17 23c1.8 1.6 4.2 1.6 6 0" stroke="var(--color-terre-100)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// Voix wolof déjà synthétisées, par texte : rejouer ne refait pas l'appel
const cacheWolof = new Map<string, string>()

export function Mascottes({ fr, wo, className }: { fr?: string[]; wo?: string[]; className?: string }) {
  const qui = useQuiParle()
  const [attente, setAttente] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const parlerWolof = async () => {
    const texte = (wo ?? []).join(' ')
    if (!texte) return
    setMessage(null)
    const connu = cacheWolof.get(texte)
    if (connu) return lireAudio(connu)
    setAttente(true)
    setMessage('La voix wolof se prépare : quelques secondes (la toute première fois, environ une minute). Ensuite, elle est instantanée.')
    try {
      const { audio_wo_base64 } = await api.voixParler(texte)
      cacheWolof.set(texte, audio_wo_base64)
      setMessage(null)
      lireAudio(audio_wo_base64)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'La voix wolof ne répond pas.')
    } finally {
      setAttente(false)
    }
  }

  const bouton = (p: Parleur, Tete: () => React.JSX.Element, badge: string, nom: string, pret: boolean, agir: () => void) => {
    const parle = qui === p
    return (
      <button type="button" disabled={!pret && !parle} onClick={() => (parle ? arreter() : agir())}
        aria-label={parle ? `Arrêter ${nom}` : `${nom} : écouter l'essentiel`} aria-pressed={parle}
        title={pret ? `${nom} : écouter l'essentiel` : p === 'wo' ? 'Le wolof est disponible dans les fonctionnalités de l’agriculteur' : undefined}
        className={clsx('relative grid size-10 shrink-0 place-items-center rounded-full transition disabled:opacity-35', parle ? 'ecoute-en-cours ring-2 ring-white' : 'hover:scale-105')}>
        <span className="size-10 overflow-hidden rounded-full"><Tete /></span>
        {parle && <span className="absolute inset-0 grid place-items-center rounded-full bg-encre-nuit/55"><Square className="size-3.5 fill-white text-white" /></span>}
        {p === 'wo' && attente && <span className="absolute inset-0 grid place-items-center rounded-full bg-encre-nuit/55"><Loader2 className="size-4 animate-spin text-white" /></span>}
        <span className={clsx('absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[0.6rem] leading-4 font-bold tracking-wide', p === 'fr' ? 'bg-pluie-500 text-white' : 'bg-soleil-500 text-encre-nuit')}>{badge}</span>
      </button>
    )
  }

  if (!lectureDisponible && !wo?.length) return null
  return (
    <div className={clsx('relative flex items-center gap-2', className)}>
      {bouton('fr', Garcon, 'FR', 'Voix française', Boolean(fr?.length) && lectureDisponible, () => lire((fr ?? []).map(pourLOreille)))}
      {bouton('wo', Fille, 'WLF', 'Voix wolof', Boolean(wo?.length) && !attente, () => void parlerWolof())}
      {message && (
        <p role="status" className="absolute top-full right-0 z-10 mt-2 w-64 rounded-lg bg-encre-nuit px-3 py-2 text-xs text-white/80 shadow-lg">
          {message}
          <button type="button" onClick={() => setMessage(null)} className="ml-2 text-white underline">OK</button>
        </p>
      )}
    </div>
  )
}
