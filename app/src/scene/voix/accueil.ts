// Message vocal d'accueil : à l'entrée dans l'espace agriculteur ou ONG, la voix lit le résumé réel du premier
// écran (le texte des mascottes : wolof pour l'agriculteur, français pour l'ONG), encadré par les phrases de
// voiceMessages.ts. Sans résumé (champ pas encore localisé), elle lit le message de secours de voiceMessages.ts.
//
// - Le clic sur la porte d'entrée (landing/entrer.ts) compte comme interaction : la voix part à l'arrivée sur la scène.
//   Si le navigateur bloque quand même la lecture (page rechargée, onglet rouvert), le bandeau propose « Écouter ».
// - Une seule voix à la fois : démarrer l'accueil coupe les mascottes, et une mascotte (ou un changement d'écran)
//   coupe l'accueil (surArret de lecture.ts).
// - Sources essayées dans l'ordre, chacune derrière la même interface `Lecteur` (ajouter une API TTS = écrire un
//   lecteur de plus) : fichier audio enregistré (message de secours seulement : le résumé change avec les données)
//   → synthèse wolof du serveur → voix française du navigateur → texte seul.
// - « Couper le son » est mémorisé par profil (localStorage) ; l'accueil n'est joué automatiquement qu'une fois par
//   onglet (sessionStorage), sauf si l'on repasse par la porte d'entrée.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { suivre } from '../../lib/mesure'
import { arreter as arreterLectures, decouper, lectureDisponible, meilleureVoix, pourLOreille, surArret, syntheseWolof, urlAudio, wolofEnCache } from './lecture'
import { ENCADREMENT, LANGUE_PAR_DEFAUT, LIRE_CHAQUE_ONGLET, LIBELLES, MESSAGES, REGLAGES, SOUS_TITRE, type LangueAccueil, type ProfilAccueil } from './voiceMessages'

export type EtatAccueil = 'inactif' | 'preparation' | 'lecture' | 'pause' | 'bloque' | 'fini' | 'coupe' | 'sansVoix'

export interface Accueil {
  etat: EtatAccueil
  profil: ProfilAccueil | null
  /** langue réellement dite */
  langue: LangueAccueil
  /** sous-titres de la langue dite */
  phrases: string[]
  /** sous-titres français affichés sous le wolof (même découpage) */
  traduction: string[] | null
  /** phrase en cours */
  index: number
  note: string | null
}

const VIDE: Accueil = { etat: 'inactif', profil: null, langue: 'fr', phrases: [], traduction: null, index: 0, note: null }
let courant = VIDE
const abonnes = new Set<() => void>()
const maj = (modif: Partial<Accueil>) => {
  courant = { ...courant, ...modif }
  abonnes.forEach((f) => f())
}

// ---- Préférences ----

const CLE_LANGUE = 'assaman.langue'
const cleMuet = (p: ProfilAccueil) => `assaman.accueil.muet.${p}`
const cleEntendu = (p: ProfilAccueil) => `assaman.accueil.entendu.${p}`

function stocker(zone: 'local' | 'session', cle: string, valeur: string | null) {
  try {
    const s = zone === 'local' ? localStorage : sessionStorage
    if (valeur === null) s.removeItem(cle)
    else s.setItem(cle, valeur)
  } catch {
    /* stockage indisponible (navigation privée) : la préférence vaut pour la visite */
  }
}
function lireStock(zone: 'local' | 'session', cle: string): string | null {
  try {
    return (zone === 'local' ? localStorage : sessionStorage).getItem(cle)
  } catch {
    return null
  }
}

/** Langue choisie par l'utilisateur (« fr » ou « wo »), sinon celle du profil. */
export function langueDe(profil: ProfilAccueil): LangueAccueil {
  // Le profil ONG / État doit toujours être lu en français : l'option wolof concerne uniquement l'agriculteur.
  if (profil === 'organisation') return 'fr'
  const choix = lireStock('local', CLE_LANGUE)
  return choix === 'fr' || choix === 'wo' ? choix : LANGUE_PAR_DEFAUT[profil]
}
export const estMuet = (p: ProfilAccueil) => lireStock('local', cleMuet(p)) === '1'
/** Appelé au clic sur la porte d'entrée : l'accueil sera joué à l'arrivée, même s'il l'a déjà été dans l'onglet. */
export const armerAccueil = (p: ProfilAccueil) => stocker('session', cleEntendu(p), null)
const doitJouerSeul = (p: ProfilAccueil) => !estMuet(p) && lireStock('session', cleEntendu(p)) !== '1'

// ---- Lecteurs : une source de voix chacun ----

const BLOQUE = new Error('lecture bloquée par le navigateur')

interface Rappels {
  index: (i: number) => void
  fin: () => void
  bloque: () => void
}

export interface Lecteur {
  /** Démarre la lecture ; rejette BLOQUE (autoplay refusé) ou une autre erreur (source indisponible : on passe à la suivante). */
  demarrer: () => Promise<void>
  pause: () => void
  reprendre: () => void
  arreter: () => void
}

/** Un fichier audio (mp3 enregistré, ou wav de la synthèse wolof). Sous-titres calés sur la longueur des phrases. */
function lecteurAudio(src: string, phrases: string[], r: Rappels): Lecteur {
  const audio = new Audio(src)
  const total = phrases.reduce((s, p) => s + p.length, 0) || 1
  let cumul = 0
  const bornes = phrases.map((p) => (cumul += p.length) / total)
  let demarre = false
  audio.ontimeupdate = () => {
    if (!audio.duration || !Number.isFinite(audio.duration)) return
    const f = audio.currentTime / audio.duration
    const i = bornes.findIndex((b) => f < b)
    r.index(i < 0 ? phrases.length - 1 : i)
  }
  audio.onended = () => r.fin()
  audio.onerror = () => demarre && r.fin()
  return {
    demarrer: () =>
      audio.play().then(
        () => void (demarre = true),
        (e: unknown) => Promise.reject(e instanceof DOMException && e.name === 'NotAllowedError' ? BLOQUE : e),
      ),
    pause: () => audio.pause(),
    reprendre: () => void audio.play().catch(() => r.bloque()),
    arreter: () => {
      audio.onended = audio.onerror = audio.ontimeupdate = null
      audio.pause()
      audio.removeAttribute('src')
    },
  }
}

/** La voix française du navigateur, phrase par phrase (la pause reprend au début de la phrase en cours :
 *  speechSynthesis.pause() est peu fiable, surtout dans Chrome avec les voix en ligne). */
function lecteurNavigateur(phrases: string[], r: Rappels): Lecteur {
  const synth = window.speechSynthesis
  let i = 0
  let jeton = 0
  const dire = () => {
    const t = ++jeton
    const voix = meilleureVoix()
    const u = new SpeechSynthesisUtterance(phrases[i])
    u.lang = voix?.lang ?? REGLAGES.langueVoix
    if (voix) u.voice = voix
    u.rate = REGLAGES.debit
    u.onstart = () => t === jeton && r.index(i)
    const suivante = () => {
      if (t !== jeton) return
      i += 1
      if (i < phrases.length) dire()
      else r.fin()
    }
    u.onend = suivante
    u.onerror = (e) => {
      if (t !== jeton || e.error === 'interrupted' || e.error === 'canceled') return
      if (e.error === 'not-allowed') r.bloque()
      else suivante()
    }
    r.index(i)
    synth.speak(u)
  }
  const couper = () => {
    jeton += 1
    synth.cancel()
  }
  return {
    demarrer: async () => {
      synth.cancel()
      dire()
    },
    pause: couper,
    reprendre: () => {
      synth.cancel()
      dire()
    },
    arreter: couper,
  }
}

// ---- Déroulé ----

let seance = 0
let lecteur: Lecteur | null = null
let arretInterne = false

function stopper() {
  seance += 1
  lecteur?.arreter()
  lecteur = null
}

// Une mascotte démarre ou l'écran change : l'accueil se tait et son bandeau se ferme
surArret(() => {
  if (arretInterne) return
  stopper()
  if (courant.etat !== 'inactif') maj(VIDE)
})

const sousTitres = (phrases: string[]) => phrases.map((p) => SOUS_TITRE.reduce((t, [motif, par]) => t.replace(motif, par), p))

/** Le navigateur n'a vu aucune interaction dans cette page : l'autoplay sera refusé, inutile d'essayer. */
function sansInteraction(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  return activation !== undefined && !activation.hasBeenActive
}

const attendre = (ms: number) => new Promise<null>((fin) => setTimeout(() => fin(null), ms))

// ---- Ce qui est dit : le résumé de l'écran, ou le message de secours ----

/** Le résumé de l'écran ouvert, tel que l'écran le compose (lignes des mascottes FR et WLF). */
export interface ResumeEcran {
  /** identifiant de l'écran (« parcelle », « semer »…) */
  ecran: string
  fr?: string[]
  wo?: string[]
  /** le lieu résumé (département de l'agriculteur, « pays » pour l'ONG) ; null : champ pas encore localisé, le
   *  résumé ne dirait que « où est votre champ ? » et c'est le message de secours qui est lu */
  lieu: string | null
}
const resumes = new Map<ProfilAccueil, ResumeEcran | null>()

/** Une version dite : `affiche` (sous-titres) et `dit` (envoyé à la voix), de même longueur. */
interface Version {
  affiche: string[]
  dit: string[]
  audio?: string
  /** phrases alignées d'une langue à l'autre (message de secours) : le français s'affiche sous le wolof */
  aligne?: boolean
}
type Programme = Partial<Record<LangueAccueil, Version>>

const plein = (l?: string[]) => (l ?? []).map((x) => x.trim()).filter(Boolean)

function programmeDe(profil: ProfilAccueil): Programme {
  const r = resumes.get(profil)
  const prog: Programme = {}
  if (r && r.lieu) {
    for (const l of ['wo', 'fr'] as const) {
      const lignes = plein(r[l])
      const cadre = ENCADREMENT[profil][r.ecran]?.[l]
      if (!lignes.length) continue
      const tout = [...(cadre?.debut ?? []), ...lignes, ...(cadre?.fin ?? [])]
      if (l === 'fr') {
        // Phrases courtes pour la voix du navigateur (Chrome coupe au-delà de 15 s), sigles et unités dits en toutes lettres
        const morceaux = tout.flatMap(decouper)
        prog.fr = { affiche: morceaux, dit: morceaux.map(pourLOreille) }
      } else prog.wo = { affiche: tout, dit: tout }
    }
    if (prog.fr || prog.wo) return prog
  }
  for (const l of ['wo', 'fr'] as const) {
    const m = MESSAGES[profil][l]
    if (m) prog[l] = { affiche: sousTitres(m.phrases), dit: m.phrases, audio: m.audio, aligne: true }
  }
  return prog
}

/** Joue l'accueil du profil. `manuel` : bouton « Écouter » / « Rejouer » (réactive aussi l'accueil coupé). */
export async function jouerAccueil(profil: ProfilAccueil, { manuel = false }: { manuel?: boolean } = {}) {
  arretInterne = true
  arreterLectures() // une seule voix : coupe les mascottes
  arretInterne = false
  stopper()
  const s = seance
  if (manuel) stocker('local', cleMuet(profil), null)
  stocker('session', cleEntendu(profil), '1')

  const prog = programmeDe(profil)
  const voulue = langueDe(profil)
  const langue: LangueAccueil = prog[voulue] ? voulue : 'fr'
  const version = prog[langue]
  if (!version) return maj(VIDE)
  const affichage = (l: LangueAccueil) => {
    const v = prog[l] ?? version
    const fr = prog.fr
    // Le français sous le wolof, phrase à phrase, seulement si les deux sont alignés (message de secours)
    return { phrases: v.affiche, traduction: l === 'wo' && v.aligne && fr?.aligne && fr.affiche.length === v.affiche.length ? fr.affiche : null }
  }
  maj({ ...VIDE, profil, langue, ...affichage(langue), etat: 'preparation' })

  if (!manuel && sansInteraction()) return maj({ etat: 'bloque', note: LIBELLES.bloque })

  const rappels: Rappels = {
    index: (i) => s === seance && courant.index !== i && maj({ index: i }),
    fin: () => {
      if (s !== seance) return
      lecteur = null
      maj({ etat: 'fini' })
    },
    bloque: () => s === seance && maj({ etat: 'bloque', note: LIBELLES.bloque }),
  }
  /** true : la source a démarré, ou la lecture est bloquée (on s'arrête là) ; false : passer à la source suivante. */
  const essayer = async (l: Lecteur, langueDite: LangueAccueil, source: string, note: string | null = null) => {
    try {
      await l.demarrer()
    } catch (e) {
      l.arreter()
      if (e === BLOQUE && s === seance) {
        maj({ etat: 'bloque', note: LIBELLES.bloque })
        return true
      }
      return s !== seance
    }
    if (s !== seance) {
      l.arreter()
      return true
    }
    lecteur = l
    maj({ etat: 'lecture', langue: langueDite, ...affichage(langueDite), note })
    suivre('voix_lue', { langue: langueDite, resultat: 'ok', origine: `accueil_${source}` })
    return true
  }

  // 1. Fichier audio enregistré (absent : l'erreur de chargement fait passer à la suite)
  if (version.audio && (await essayer(lecteurAudio(version.audio, version.affiche, rappels), langue, 'fichier'))) return

  // 2. Wolof : synthèse du serveur (sous-titres affichés pendant l'attente)
  let note: string | null = null
  if (langue === 'wo') {
    const texte = version.dit.join(' ')
    if (!wolofEnCache(texte)) maj({ note: LIBELLES.preparation })
    const base64 = await Promise.race([syntheseWolof(texte).catch(() => null), attendre(REGLAGES.delaiSyntheseWolofMs)])
    if (s !== seance) return
    if (base64 && (await essayer(lecteurAudio(urlAudio(base64), version.affiche, rappels), 'wo', 'synthese'))) return
    if (s !== seance) return
    suivre('voix_lue', { langue: 'wo', resultat: 'erreur', origine: 'accueil_synthese' })
    note = LIBELLES.replisFrancais
  }

  // 3. Voix française du navigateur
  if (prog.fr && lectureDisponible && (await essayer(lecteurNavigateur(prog.fr.dit, rappels), 'fr', 'navigateur', note))) return
  if (s !== seance) return

  // 4. Aucune voix : le texte seul
  maj({ etat: 'sansVoix', ...affichage(langue), note: LIBELLES.sansVoix })
}

export function pauseAccueil() {
  if (courant.etat !== 'lecture' || !lecteur) return
  lecteur.pause()
  maj({ etat: 'pause' })
}

export function reprendreAccueil() {
  if (courant.etat !== 'pause' || !lecteur) return
  lecteur.reprendre()
  maj({ etat: 'lecture' })
}

/** Coupe le son et s'en souvient pour ce profil : l'accueil ne se relancera plus seul. */
export function couperAccueil() {
  stopper()
  if (courant.profil) stocker('local', cleMuet(courant.profil), '1')
  maj({ etat: 'coupe', note: LIBELLES.muet })
}

export function fermerAccueil() {
  stopper()
  maj(VIDE)
}

export function useAccueil(): Accueil {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => courant,
  )
}

/**
 * Lance la voix sans clic sur « Écouter » :
 * - à l'arrivée sur la scène (sauf accueil coupé ou déjà entendu dans l'onglet) : le résumé si le lieu est connu,
 *   sinon le message de secours, qui invite à choisir sa zone ;
 * - puis, sauf accueil coupé, chaque fois que l'écran ou le lieu change (« Me localiser », liste, carte, autre
 *   onglet) : le résumé du nouvel écran. Un onglet sans lieu connu n'est pas lu. Ces choix sont des interactions :
 *   le navigateur laisse parler.
 * On attend que le résumé soit complet : il ne change plus pendant `stabiliteResumeMs`, ou `attenteMaxResumeMs`
 * est passé. `resume` : null quand l'écran ouvert n'a pas encore publié son résumé, ou n'est pas à lire.
 */
export function useAccueilAuto(profil: ProfilAccueil, resume: ResumeEcran | null) {
  const cle = resume ? JSON.stringify(resume) : ''
  const ou = resume ? `${resume.ecran}|${resume.lieu ?? ''}` : ''
  const depuis = useRef(0) // arrivée sur la scène, ou dernier changement d'écran ou de lieu
  const entreeFaite = useRef(false)
  const dejaDit = useRef<string | null>(null)
  useEffect(() => {
    depuis.current = Date.now()
    entreeFaite.current = !doitJouerSeul(profil)
    dejaDit.current = null
    return () => {
      if (courant.profil === profil) fermerAccueil()
    }
  }, [profil])
  useEffect(() => {
    depuis.current = Date.now()
  }, [ou])

  useEffect(() => {
    // Gardé pour « Rejouer » et le bouton haut-parleur
    if (resume) resumes.set(profil, resume)
    if (!resume) return
    // Un écran qui charge encore n'a pas de résumé : on attend qu'il en ait un (sans lieu, le secours est lu à l'entrée)
    const contenu = plein(resume.wo).length > 0 || plein(resume.fr).length > 0
    const entree = !entreeFaite.current && (resume.lieu === null || contenu)
    const nouveau = resume.lieu !== null && contenu && ou !== dejaDit.current && !estMuet(profil)
    if (!entree && !nouveau) return
    const reste = Math.max(0, REGLAGES.attenteMaxResumeMs - (Date.now() - depuis.current))
    const minuteur = window.setTimeout(() => {
      entreeFaite.current = true
      dejaDit.current = ou
      void jouerAccueil(profil)
    }, Math.min(REGLAGES.stabiliteResumeMs, reste))
    return () => clearTimeout(minuteur)
    // `cle` résume `resume` : on ne relance l'attente que si le texte change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil, cle])
}

/** Les écrans dont le résumé est lu seul : tous, ou le premier seulement (voiceMessages.ts). */
export const lireEcran = (profil: ProfilAccueil, ecran: string, premier: string) => LIRE_CHAQUE_ONGLET[profil] || ecran === premier
