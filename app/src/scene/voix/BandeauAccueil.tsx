// Bandeau du message d'accueil : sous-titres de la phrase en cours (accessibilité, champ bruyant) et commandes
// Pause / Reprendre, Rejouer, Couper le son. Le moteur est dans accueil.ts, les textes dans voiceMessages.ts.
import clsx from 'clsx'
import { Loader2, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect } from 'react'
import { couperAccueil, fermerAccueil, jouerAccueil, pauseAccueil, reprendreAccueil, useAccueil, useAccueilAuto, type ResumeEcran } from './accueil'
import { LIBELLES, type ProfilAccueil } from './voiceMessages'

const BOUTON = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white'

/** Petit bouton haut-parleur (en-tête de la scène) : réentendre l'accueil à tout moment. */
export function BoutonAccueil({ profil }: { profil: ProfilAccueil }) {
  const { etat } = useAccueil()
  const actif = etat === 'lecture' || etat === 'preparation' || etat === 'pause'
  return (
    <button type="button" onClick={() => (actif ? fermerAccueil() : void jouerAccueil(profil, { manuel: true }))}
      aria-label={actif ? 'Arrêter le résumé à voix haute' : LIBELLES.ecouterAccueil} title={actif ? 'Arrêter le résumé à voix haute' : LIBELLES.ecouterAccueil}
      aria-pressed={actif}
      className={clsx('grid size-11 place-items-center rounded-lg text-white/70 transition hover:text-white', actif && 'ecoute-en-cours text-white')}>
      <Volume2 className="size-4" aria-hidden />
    </button>
  )
}

/** Le bandeau, monté une fois dans la scène : lance l'accueil à l'arrivée, avec le résumé du premier écran. */
export function BandeauAccueil({ profil, resume, className }: { profil: ProfilAccueil; resume: ResumeEcran | null; className?: string }) {
  useAccueilAuto(profil, resume)
  const a = useAccueil()

  // « Son coupé », message terminé : le bandeau se ferme seul (il reste le bouton haut-parleur de l'en-tête)
  useEffect(() => {
    if (a.etat !== 'coupe' && a.etat !== 'fini') return
    const t = window.setTimeout(fermerAccueil, a.etat === 'coupe' ? 5000 : 12000)
    return () => clearTimeout(t)
  }, [a.etat])

  if (a.etat === 'inactif' || a.profil !== profil) return null
  const enCours = a.etat === 'lecture' || a.etat === 'pause'
  // Pendant la préparation de la voix wolof, tout le texte se lit déjà
  const toutLeTexte = a.etat === 'sansVoix' || a.etat === 'fini' || a.etat === 'preparation'
  const phrase = a.phrases[a.index] ?? ''
  const traduction = a.traduction?.[a.index]

  return (
    <section aria-label={LIBELLES.titre} lang={a.langue === 'wo' ? 'wo' : 'fr'}
      className={clsx('verre-scene surgir pointer-events-auto rounded-2xl px-4 py-3 text-white', className)}>
      <div className="flex items-center gap-2 text-2xs font-semibold tracking-wide text-white/60 uppercase">
        {a.etat === 'preparation' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Volume2 className={clsx('size-3.5', a.etat === 'lecture' && 'text-soleil-500')} aria-hidden />}
        <span>{LIBELLES.titre}{a.langue === 'wo' ? ' · wolof' : ''}</span>
        <button type="button" onClick={fermerAccueil} aria-label={LIBELLES.fermer} title={LIBELLES.fermer}
          className="-my-2 -mr-2 ml-auto grid size-11 place-items-center rounded-lg text-white/60 hover:text-white">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {a.etat !== 'coupe' && (
        toutLeTexte ? (
          <div className="mt-1 max-h-48 space-y-1 overflow-y-auto text-sm leading-relaxed">
            {a.phrases.map((p, i) => (
              <p key={i}>{p}{a.traduction?.[i] && <span className="block text-xs text-white/60" lang="fr">{a.traduction[i]}</span>}</p>
            ))}
          </div>
        ) : (
          // Sous-titres : la phrase en cours, annoncée aux lecteurs d'écran
          <div aria-live="polite" className="mt-1 min-h-12">
            <p className="text-md leading-snug font-medium">{phrase}</p>
            {traduction && <p className="mt-1 text-sm leading-snug text-white/65" lang="fr">{traduction}</p>}
          </div>
        )
      )}

      {a.note && <p role="status" className="mt-2 text-xs text-soleil-100/90">{a.note}</p>}

      {a.etat !== 'coupe' && (
        <div className="mt-2 -mb-1 flex flex-wrap items-center gap-1">
          {a.etat === 'bloque' && (
            <button type="button" onClick={() => void jouerAccueil(profil, { manuel: true })} className={clsx(BOUTON, 'bg-soleil-500 text-encre-nuit hover:bg-soleil-500/90 hover:text-encre-nuit')}>
              <span aria-hidden>🔊</span> {LIBELLES.ecouter}
            </button>
          )}
          {a.etat === 'lecture' && <button type="button" onClick={pauseAccueil} className={BOUTON}><Pause className="size-4" aria-hidden />{LIBELLES.pause}</button>}
          {a.etat === 'pause' && <button type="button" onClick={reprendreAccueil} className={BOUTON}><Play className="size-4" aria-hidden />{LIBELLES.reprendre}</button>}
          {(enCours || a.etat === 'fini' || a.etat === 'preparation') && (
            <button type="button" onClick={() => void jouerAccueil(profil, { manuel: true })} className={BOUTON}><RotateCcw className="size-4" aria-hidden />{LIBELLES.rejouer}</button>
          )}
          {a.etat !== 'sansVoix' && (
            <button type="button" onClick={couperAccueil} className={BOUTON}><VolumeX className="size-4" aria-hidden />{LIBELLES.couper}</button>
          )}
        </div>
      )}
    </section>
  )
}
