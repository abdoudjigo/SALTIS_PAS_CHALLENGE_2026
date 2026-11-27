// Micro du chatbot en wolof : le navigateur ne reconnaît pas le wolof (Web Speech : français seulement), donc on
// enregistre la question et le serveur la transcrit (POST /voix/question, api/voix/asr_local.py).
// L'enregistrement (webm, mp4 selon le navigateur) est converti ici en WAV 16 kHz mono : le serveur n'a besoin
// d'aucun décodeur audio, et le fichier envoyé est petit (~32 Ko par seconde).

const FREQUENCE = 16000
export const DUREE_MAX_MS = 15000 // une question tient en quelques secondes ; au-delà, on arrête et on envoie

export const microDisponible = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  && typeof window !== 'undefined' && 'MediaRecorder' in window

export interface Enregistrement {
  /** arrête et rend la question en WAV (null si rien n'a été enregistré) */
  arreter: () => Promise<Blob | null>
  /** abandonne sans rien rendre (résolue quand le micro est rendu) */
  annuler: () => Promise<void>
}

/** Ouvre le micro et commence à enregistrer. Rejette si l'accès au micro est refusé. */
export async function enregistrer(): Promise<Enregistrement> {
  const flux = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const enreg = new MediaRecorder(flux)
  const morceaux: Blob[] = []
  enreg.ondataavailable = (e) => e.data.size && morceaux.push(e.data)
  const fini = new Promise<void>((ok) => (enreg.onstop = () => ok()))
  enreg.start()
  const couper = () => flux.getTracks().forEach((p) => p.stop())
  return {
    arreter: async () => {
      if (enreg.state !== 'inactive') enreg.stop()
      await fini
      couper()
      if (!morceaux.length) return null
      return versWav(new Blob(morceaux, { type: enreg.mimeType }))
    },
    annuler: async () => {
      enreg.ondataavailable = null
      if (enreg.state !== 'inactive') enreg.stop()
      couper()
      await fini
    },
  }
}

/** Enregistrement du navigateur → WAV PCM 16 bits, 16 kHz, mono. */
async function versWav(audio: Blob): Promise<Blob> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  let decode: AudioBuffer
  try {
    decode = await ctx.decodeAudioData(await audio.arrayBuffer())
  } finally {
    void ctx.close()
  }
  const n = Math.max(1, Math.ceil(decode.duration * FREQUENCE))
  const hors = new OfflineAudioContext(1, n, FREQUENCE) // mélange en mono et rééchantillonne
  const source = hors.createBufferSource()
  source.buffer = decode
  source.connect(hors.destination)
  source.start()
  const signal = (await hors.startRendering()).getChannelData(0)

  const tampon = new ArrayBuffer(44 + signal.length * 2)
  const v = new DataView(tampon)
  const ecrire = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  ecrire(0, 'RIFF'); v.setUint32(4, 36 + signal.length * 2, true); ecrire(8, 'WAVE')
  ecrire(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, FREQUENCE, true); v.setUint32(28, FREQUENCE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  ecrire(36, 'data'); v.setUint32(40, signal.length * 2, true)
  for (let i = 0; i < signal.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, signal[i])) * 0x7fff, true)
  return new Blob([tampon], { type: 'audio/wav' })
}
