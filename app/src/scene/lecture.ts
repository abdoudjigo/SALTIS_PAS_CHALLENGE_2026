// Lecture à voix haute (bouton « Écouter » de chaque fonctionnalité), avec la synthèse vocale du navigateur.
//
// Trois pièges connus de l'API Web Speech, traités ici :
// - Chrome coupe une lecture longue au bout d'environ 15 s (voix en ligne) : on lit phrase par phrase, en file ;
// - la liste des voix arrive après coup (événement `voiceschanged`) : on choisit la voix au moment de lire ;
// - les voix changent d'un appareil à l'autre : on classe les voix françaises disponibles (voix neuronales
//   « Natural » d'Edge, « Google français » de Chrome, voix « Premium » ou « Améliorée » d'Apple) et on écarte
//   les voix robotiques (eSpeak).
import { useSyncExternalStore } from 'react'
import { api } from '../api'

const LONGUEUR_MAX = 180 // au-delà, une phrase est recoupée aux virgules

/** Qui parle : la mascotte FR (synthèse du navigateur), la mascotte WLF (audio du Space), ou personne. */
export type Parleur = 'fr' | 'wo'
let qui: Parleur | null = null
let audio: HTMLAudioElement | null = null
const abonnes = new Set<() => void>()
const notifier = (v: Parleur | null) => {
  qui = v
  abonnes.forEach((f) => f())
}

export const lectureDisponible = typeof window !== 'undefined' && 'speechSynthesis' in window

function note(v: SpeechSynthesisVoice): number {
  if (!/^fr\b|^fr[-_]/i.test(v.lang)) return -1
  let s = /fr[-_]FR/i.test(v.lang) ? 10 : 0
  if (/natural|neural/i.test(v.name)) s += 60
  if (/google/i.test(v.name)) s += 40
  if (/online/i.test(v.name)) s += 20
  if (/premium|enhanced|améliorée|amelie|amélie|thomas|audrey|aurélie|denise|henri|eloise|vivienne/i.test(v.name)) s += 15
  if (/espeak|mbrola|pico/i.test(v.name)) s -= 50
  return s
}

/** La meilleure voix française de l'appareil, ou null (le navigateur prend alors sa voix française par défaut). */
export function meilleureVoix(): SpeechSynthesisVoice | null {
  if (!lectureDisponible) return null
  const voix = window.speechSynthesis.getVoices().filter((v) => note(v) >= 0)
  return voix.sort((a, b) => note(b) - note(a))[0] ?? null
}
if (lectureDisponible) window.speechSynthesis.addEventListener?.('voiceschanged', () => meilleureVoix())

/** Découpe en phrases courtes, lues l'une après l'autre. */
export function decouper(texte: string): string[] {
  const phrases = texte.split(/(?<=[.!?;])\s+/).map((p) => p.trim()).filter(Boolean)
  return phrases.flatMap((p) => {
    if (p.length <= LONGUEUR_MAX) return [p]
    const morceaux: string[] = []
    let courant = ''
    for (const partie of p.split(/(?<=,)\s+/)) {
      if (courant && courant.length + partie.length > LONGUEUR_MAX) {
        morceaux.push(courant)
        courant = partie
      } else courant = courant ? `${courant} ${partie}` : partie
    }
    return courant ? [...morceaux, courant] : morceaux
  })
}

/** Lit les phrases données, après avoir arrêté toute lecture en cours. */
export function lire(phrases: string[]) {
  if (!lectureDisponible) return
  const synth = window.speechSynthesis
  arreter() // une seule voix : coupe aussi le wolof en cours, d'où qu'il vienne (mascotte ou pied de fenêtre)
  const morceaux = phrases.flatMap(decouper)
  if (!morceaux.length) return notifier(null)
  const voix = meilleureVoix()
  morceaux.forEach((texte, i) => {
    const u = new SpeechSynthesisUtterance(texte)
    u.lang = voix?.lang ?? 'fr-FR'
    if (voix) u.voice = voix
    u.rate = 0.98
    if (i === morceaux.length - 1) {
      u.onend = () => notifier(null)
      u.onerror = () => notifier(null)
    }
    synth.speak(u)
  })
  notifier('fr')
}

/** Joue la voix wolof (wav en base64, synthétisée par le Space). */
export function lireAudio(base64: string) {
  arreter()
  audio = new Audio(`data:audio/wav;base64,${base64}`)
  audio.onended = () => notifier(null)
  audio.onerror = () => notifier(null)
  void audio.play().catch(() => notifier(null))
  notifier('wo')
}

// Voix wolof déjà synthétisées, par texte : rejouer ne refait pas l'appel (mascotte et pied de fenêtre partagent ce cache)
const cacheWolof = new Map<string, string>()

/** Lit un texte en wolof : depuis le cache, sinon par le Space (`preparer` est appelé avant l'attente). Rejette si le Space ne répond pas. */
export async function lireWolof(texte: string, preparer?: () => void) {
  const connu = cacheWolof.get(texte)
  if (connu) return lireAudio(connu)
  preparer?.()
  const { audio_wo_base64 } = await api.voixParler(texte)
  cacheWolof.set(texte, audio_wo_base64)
  lireAudio(audio_wo_base64)
}

export function arreter() {
  if (lectureDisponible) window.speechSynthesis.cancel()
  audio?.pause()
  audio = null
  notifier(null)
}

/** La mascotte qui parle en ce moment (ou null). */
export function useQuiParle(): Parleur | null {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => qui,
  )
}

// ---- Écrire pour l'oreille : pas d'abréviation, les unités en toutes lettres ----

const n = (x: number) => String(Math.round(x))
/** Une valeur absente se dit « non disponible », jamais zéro. */
export const dire = {
  nombre: (x: number | null | undefined) => (x === null || x === undefined ? 'non disponible' : n(x)),
  mm: (x: number | null | undefined) => (x === null || x === undefined ? 'non disponible' : `${n(x)} millimètres`),
  pct: (x: number | null | undefined) => (x === null || x === undefined ? 'non disponible' : `${n(x)} pour cent`),
  kg: (x: number | null | undefined) => {
    if (x === null || x === undefined) return 'non disponible'
    // Au-delà de 100 tonnes, la décimale n'apporte rien à l'oreille
    if (x >= 1000) return `${(x / 1000).toLocaleString('fr-FR', { maximumFractionDigits: x >= 100000 ? 0 : 1 })} tonnes`
    return `${n(x)} kilos`
  },
  kgHa: (x: number | null | undefined) => (x === null || x === undefined ? 'non disponible' : `${n(x)} kilos par hectare`),
  ha: (x: number) => `${x.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} hectare${x >= 2 ? 's' : ''}`,
}

// Les cultures avec leur article : « le niébé », « l'arachide », « du mil », « de l'arachide »
const FEMININ = /^(arachide|pastèque|tomate)/i
const nomCulture = (libelle: string) => libelle.toLowerCase().replace(/\s*\(([^)]+)\)/g, ' $1').replace(/riz irrigué/, 'riz')
export const culture = {
  le: (libelle: string) => {
    const n = nomCulture(libelle)
    return /^[aeiouéèh]/i.test(n) ? `l'${n}` : FEMININ.test(n) ? `la ${n}` : `le ${n}`
  },
  du: (libelle: string) => {
    const n = nomCulture(libelle)
    return /^[aeiouéèh]/i.test(n) ? `de l'${n}` : FEMININ.test(n) ? `de la ${n}` : `du ${n}`
  },
}

/** Remplace les sigles et abréviations que la synthèse vocale lit mal. */
export function pourLOreille(texte: string): string {
  return texte
    .replace(/NPK 15-15-15/g, 'N P K quinze quinze quinze')
    .replace(/\bNPK\b/g, 'N P K')
    .replace(/\bDAP\b/g, 'D A P')
    .replace(/\bONG\b/g, 'O N G')
    .replace(/(\d)\s?%/g, '$1 pour cent')
    .replace(/(\d)\s?mm\b/g, '$1 millimètres')
    .replace(/(\d)\s?kg\/ha\b/g, '$1 kilos par hectare')
    .replace(/(\d)\s?kg\b/g, '$1 kilos')
    // « 1 ha », « 0,5 ha » : hectare au singulier (moins de 2)
    .replace(/(^|[^\d,])([01](?:,\d+)?)\s?ha\b/g, '$1$2 hectare')
    .replace(/(\d)\s?ha\b/g, '$1 hectares')
    .replace(/\s?·\s?/g, ', ')
    .replace(/\s*\(([^)]+)\)/g, ' $1') // « Mil (souna) » → « Mil souna »
}
