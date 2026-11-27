// Lecture à voix haute (bouton « Écouter » de chaque fonctionnalité), avec la synthèse vocale du navigateur.
//
// Trois pièges connus de l'API Web Speech, traités ici :
// - Chrome coupe une lecture longue au bout d'environ 15 s (voix en ligne) : on lit phrase par phrase, en file ;
// - la liste des voix arrive après coup (événement `voiceschanged`) : on choisit la voix au moment de lire ;
// - les voix changent d'un appareil à l'autre : on classe les voix françaises disponibles (voix neuronales
//   « Natural » d'Edge, « Google français » de Chrome, voix « Premium » ou « Améliorée » d'Apple) et on écarte
//   les voix robotiques (eSpeak).
import { useSyncExternalStore } from 'react'
import { api } from '../../api'
import { config } from '../../config'
import { ApiError } from '../../api/client'
import { suivre } from '../../lib/mesure'

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
  const phrases = texte.split(/(?<=[.!?;])\s+(?!»)/).map((p) => p.trim()).filter(Boolean)
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

// ---- Voix française : Piper sur le serveur (modèle neuronal, même voix sur tous les navigateurs) ----
// Phrase par phrase : la phrase suivante est demandée pendant que la première est dite ; une phrase déjà dite est
// gardée par le navigateur (Cache-Control immutable). Serveur muet ou trop lent : voix du navigateur, sans coupure.

const DELAI_PREMIERE_PHRASE_MS = 6000
const PAUSE_SERVEUR_MS = 5 * 60_000 // après un échec, on ne réessaie le serveur qu'après ce délai
let serveurMuetJusqua = 0
let jeton = 0

export const urlVoixFr = (phrase: string) => `${config.apiUrl}/api/v1/voix/francais?texte=${encodeURIComponent(phrase)}`

/** Demande d'avance une phrase au serveur (elle sera dite sans attente). */
export function prechargerFr(phrase: string) {
  if (Date.now() < serveurMuetJusqua || !phrase) return
  void fetch(urlVoixFr(phrase), { mode: 'no-cors' }).catch(() => undefined)
}

function lireNavigateur(morceaux: string[], t: number) {
  if (!lectureDisponible || t !== jeton) return notifier(null)
  const synth = window.speechSynthesis
  const voix = meilleureVoix()
  morceaux.forEach((texte, i) => {
    const u = new SpeechSynthesisUtterance(texte)
    u.lang = voix?.lang ?? 'fr-FR'
    if (voix) u.voice = voix
    u.rate = 1
    if (i === morceaux.length - 1) u.onend = u.onerror = () => t === jeton && notifier(null)
    synth.speak(u)
  })
}

/** Lit les phrases données (déjà écrites pour l'oreille), après avoir arrêté toute lecture en cours. */
export function lire(phrases: string[]) {
  arreter() // une seule voix : coupe aussi le wolof en cours, d'où qu'il vienne
  const morceaux = phrases.flatMap(decouper)
  if (!morceaux.length) return notifier(null)
  const t = ++jeton
  suivre('voix_lue', { langue: 'fr', resultat: 'ok' })
  notifier('fr')
  if (Date.now() < serveurMuetJusqua) return lireNavigateur(morceaux, t)

  // Un seul élément audio, créé dans le clic : les navigateurs mobiles le laissent ensuite enchaîner les phrases
  const el = new Audio()
  audio = el
  let i = 0
  let demarre = false
  const repli = () => {
    if (t !== jeton) return
    serveurMuetJusqua = Date.now() + PAUSE_SERVEUR_MS
    el.onended = el.onerror = el.onplaying = null
    el.pause()
    if (audio === el) audio = null
    lireNavigateur(morceaux.slice(i), t)
  }
  const minuteur = window.setTimeout(() => !demarre && repli(), DELAI_PREMIERE_PHRASE_MS)
  const dire = () => {
    el.src = urlVoixFr(morceaux[i])
    if (morceaux[i + 1]) prechargerFr(morceaux[i + 1])
    void el.play().catch(() => t === jeton && repli())
  }
  el.onplaying = () => {
    demarre = true
    clearTimeout(minuteur)
  }
  el.onended = () => {
    if (t !== jeton) return
    i += 1
    if (i < morceaux.length) dire()
    else {
      audio = null
      notifier(null)
    }
  }
  el.onerror = () => repli()
  dire()
}

/** Adresse jouable d'une voix en base64 : mp3 (Space, Adia TTS) ou wav (service « voix » du serveur), reconnus à leurs
 *  premiers octets (un mp3 annoncé comme wav ne se lit pas). */
export function urlAudio(base64: string): string {
  const type = base64.startsWith('UklGR') ? 'audio/wav' // « RIFF »
    : base64.startsWith('SUQz') || base64.startsWith('//') ? 'audio/mpeg' // « ID3 », ou trame mp3 brute
    : base64.startsWith('T2dnUw') ? 'audio/ogg' // « OggS »
    : 'audio/wav'
  return `data:${type};base64,${base64}`
}

/** Joue la voix wolof (base64, synthétisée par le Space ou le service « voix »). */
export function lireAudio(base64: string) {
  arreter()
  audio = new Audio(urlAudio(base64))
  audio.onended = () => notifier(null)
  audio.onerror = () => notifier(null)
  void audio.play().catch(() => notifier(null))
  notifier('wo')
}

// Voix wolof déjà synthétisées, par texte : rejouer ne refait pas l'appel (mascotte et pied de fenêtre partagent ce cache)
const cacheWolof = new Map<string, string>()

/** L'audio wolof d'un texte (wav en base64) : depuis le cache, sinon par le service « voix ». Rejette s'il ne répond pas. */
export async function syntheseWolof(texte: string): Promise<string> {
  const connu = cacheWolof.get(texte)
  if (connu) return connu
  const { audio_wo_base64 } = await api.voixParler(texte)
  cacheWolof.set(texte, audio_wo_base64)
  return audio_wo_base64
}
export const wolofEnCache = (texte: string) => cacheWolof.has(texte)

/** Lit un texte en wolof : depuis le cache, sinon par le Space (`preparer` est appelé avant l'attente). Rejette si le Space ne répond pas. */
export async function lireWolof(texte: string, preparer?: () => void) {
  if (!wolofEnCache(texte)) preparer?.()
  try {
    const audioWo = await syntheseWolof(texte)
    suivre('voix_lue', { langue: 'wo', resultat: 'ok' })
    lireAudio(audioWo)
  } catch (e) {
    suivre('voix_lue', { langue: 'wo', resultat: e instanceof ApiError && e.status === 503 ? 'occupee' : 'erreur' })
    throw e
  }
}

// Les autres voix de la plateforme (message d'accueil, voir accueil.ts) s'arrêtent aussi quand une lecture démarre
const autresArrets = new Set<() => void>()
export function surArret(f: () => void) {
  autresArrets.add(f)
  return () => void autresArrets.delete(f)
}

export function arreter() {
  jeton += 1
  autresArrets.forEach((f) => f())
  if (lectureDisponible) window.speechSynthesis.cancel()
  if (audio) {
    audio.onended = audio.onerror = null
    audio.pause()
  }
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

/** Écrit pour l'oreille : unités, sigles, symboles et nombres que la synthèse vocale lit mal (« 65 j » → « 65 jours »,
 *  « 12 t » → « 12 tonnes », « ≥ 20 % » → « au moins 20 pour cent », « 1 409 120 » lu comme un seul nombre). */
export function pourLOreille(texte: string): string {
  const pl = (n: string, un: string, plusieurs: string) => (/^[01](?:,\d+)?$/.test(n) ? un : plusieurs)
  return texte
    .replace(/\*\*/g, '')
    .replace(/[«»"]/g, '')
    // Milliers séparés par des espaces (y compris insécables) : un seul nombre
    .replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1')
    // Signes et symboles
    .replace(/≥\s?/g, 'au moins ').replace(/≤\s?/g, 'au plus ').replace(/±\s?/g, 'plus ou moins ')
    .replace(/\s?×\s?/g, ' fois ').replace(/\s?→\s?/g, ', puis ').replace(/\s?[·•|]\s?/g, ', ')
    .replace(/(^|[\s(])\+(\d)/g, '$1plus $2').replace(/(^|[\s(])[-−–](\d)/g, '$1moins $2')
    .replace(/\b(1[89]\d\d|20\d\d)\s?[-–]\s?(1[89]\d\d|20\d\d)\b/g, '$1 à $2')
    .replace(/(\d)\s?[-–]\s?(\d)/g, '$1 à $2')
    // Sigles
    .replace(/NPK 15-15-15/g, 'N P K quinze quinze quinze')
    .replace(/\bNPK\b/g, 'N P K').replace(/\bDAP\b/g, 'D A P').replace(/\bONG\b/g, 'O N G').replace(/\bPDF\b/g, 'P D F')
    .replace(/\bIA\b/g, 'I A').replace(/\bPIA\b/g, 'P I A').replace(/\bCH\b/g, 'Cadre harmonisé').replace(/\bISRA\b/g, 'Isra')
    .replace(/\bF ?CFA\b/g, 'francs C F A')
    // Abréviations
    .replace(/\bn\. ?d\./g, 'non disponible').replace(/\bpers\./g, 'personnes').replace(/\benv\./g, 'environ')
    .replace(/\bN°\s?/g, 'numéro ').replace(/\b1er\b/g, 'premier').replace(/\b1re\b/g, 'première')
    // Unités après un nombre
    .replace(/(\d)\s?%/g, '$1 pour cent')
    .replace(/(\d+(?:,\d+)?)\s?kg\s?\/\s?ha\b/g, '$1 kilos par hectare')
    .replace(/(\d+(?:,\d+)?)\s?t\s?\/\s?ha\b/g, (_, n) => `${n} ${pl(n, 'tonne', 'tonnes')} par hectare`)
    .replace(/(\d+(?:,\d+)?)\s?L\s?\/\s?s\b/g, (_, n) => `${n} ${pl(n, 'litre', 'litres')} par seconde`)
    .replace(/(\d+(?:,\d+)?)\s?m³/g, (_, n) => `${n} ${pl(n, 'mètre cube', 'mètres cubes')}`)
    .replace(/(\d+(?:,\d+)?)\s?mm\b/g, (_, n) => `${n} ${pl(n, 'millimètre', 'millimètres')}`)
    .replace(/(\d+(?:,\d+)?)\s?km\b/g, (_, n) => `${n} ${pl(n, 'kilomètre', 'kilomètres')}`)
    .replace(/(\d+(?:,\d+)?)\s?kg\b/g, (_, n) => `${n} ${pl(n, 'kilo', 'kilos')}`)
    .replace(/(\d+(?:,\d+)?)\s?ha\b/g, (_, n) => `${n} ${pl(n, 'hectare', 'hectares')}`)
    .replace(/(\d+(?:,\d+)?)\s?t\b/g, (_, n) => `${n} ${pl(n, 'tonne', 'tonnes')}`)
    .replace(/(\d+(?:,\d+)?)\s?j\b/g, (_, n) => `${n} ${pl(n, 'jour', 'jours')}`)
    .replace(/(\d+(?:,\d+)?)\s?h\b/g, (_, n) => `${n} ${pl(n, 'heure', 'heures')}`)
    .replace(/(\d+(?:,\d+)?)\s?min\b/g, '$1 minutes')
    .replace(/(\d+(?:,\d+)?)\s?°C/g, '$1 degrés')
    .replace(/\s?\/\s?100\b/g, ' sur 100').replace(/\s?\/\s?sac\b/g, ' par sac')
    .replace(/\s*\(([^)]+)\)/g, ', $1,') // « Mil (souna) » → « Mil, souna, » : une petite pause, pas de parenthèse lue
    .replace(/,\s*([.!?;:])/g, '$1').replace(/\s{2,}/g, ' ').trim()
}
