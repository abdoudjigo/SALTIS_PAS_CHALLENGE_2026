// Briques propres aux prévisions des modèles d'IA : états d'attente, provenance d'un chiffre, fiabilité, choix d'année.
// Règle : chaque chiffre dit de quel modèle il vient ; les réserves sont repliées, jamais supprimées.
import { CloudOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useFiabilite, type EtatPrevision } from '../hooks/previsions'
import { MODELES, natureAnnee, phrasesFiabilite, rappelsLisibles, type Cible } from './regles/fiabilite'
import type { PrevisionRendement } from '../types/previsions'
import type { Cadre, useAnnee } from './cadre'
import type { PrevisionSaison } from '../types/previsions'
import { Avis, Marque, Methode, SaisieAnnee, Squelette } from './interface/ui'

/** Ce qu'on montre à la place d'une prévision qui n'est pas là. Renvoie null quand la prévision est prête. */
export function Attente({ etat, objet = 'cette sélection', lignes = 4 }: { etat: EtatPrevision; objet?: string; lignes?: number }) {
  if (etat === 'ok') return null
  if (etat === 'chargement') return <Squelette lignes={lignes} />
  // Le bandeau commun (EtatReseau) propose « Réessayer » ; ici, on dit seulement ce qui manque
  if (etat === 'erreur') return <Avis>Les prévisions ne répondent pas pour le moment : ce n’est pas qu’elles manquent.</Avis>
  if (etat === 'absente') return <p className="mt-4 text-sm leading-relaxed text-white/70">Pas de prévision pour {objet}.</p>
  return (
    <div className="mt-4 flex gap-3 border-l-2 border-white/20 pl-3" role="status">
      <CloudOff className="mt-0.5 size-4 shrink-0 text-white/60" aria-hidden />
      <div>
        <p className="text-sm font-medium text-white">Prévisions pas encore chargées</p>
        <p className="mt-1 text-xs leading-relaxed text-white/70">Les résultats des modèles ne sont pas encore disponibles ici. Le reste de la plateforme fonctionne normalement.</p>
      </div>
    </div>
  )
}

/** Un morceau de réponse dans un bouton qui combine : le libellé, la valeur, et dessous le modèle et sa fiabilité. */
export function Morceau({ libelle, valeur, modele, reserve, children }: { libelle: string; valeur: ReactNode; modele: keyof typeof MODELES; reserve?: string; children?: ReactNode }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-sm text-white/70">{libelle}</dt>
        <dd className="text-right text-sm font-medium text-white tabular-nums">{valeur}</dd>
      </div>
      {children && <div className="mt-1 text-xs leading-relaxed text-white/70">{children}</div>}
      <p className="mt-1 text-2xs leading-snug text-white/60">{MODELES[modele].nom} · {reserve ?? MODELES[modele].fiabilite}</p>
    </div>
  )
}

function Fiabilite({ cible }: { cible: Cible }) {
  const { data } = useFiabilite(cible.modele)
  const phrases = data ? phrasesFiabilite(data.donnees, cible) : []
  return (
    <>
      <p className="font-medium text-white/85">{MODELES[cible.modele].nom}</p>
      {phrases.length ? phrases.map((p) => <p key={p}>{p}</p>) : <p>Mesures de fiabilité non disponibles.</p>}
    </>
  )
}

/** Méthode d'un mode de prévision : source, fiabilité mesurée de chaque modèle utilisé, rappels de l'API. */
export function MethodeModele({ cibles, avertissements = [], children }: { cibles: Cible[]; avertissements?: string[]; children?: ReactNode }) {
  return (
    <Methode>
      {children}
      {cibles.map((c) => <Fiabilite key={`${c.modele}${c.tendance ? '-tendance' : ''}`} cible={c} />)}
      {[...new Set(rappelsLisibles(avertissements))].map((a) => <p key={a}>{a}</p>)}
    </Methode>
  )
}

/** Ce que vaut un chiffre du modèle 3 : prévision de l'année, ou valeur habituelle ; et s'il est vérifiable. */
export function MarquesRendement({ ligne, quoi }: { ligne: PrevisionRendement; quoi: 'alerte' | 'rendement' }) {
  const fiable = quoi === 'alerte' ? ligne.alerte_fiable : ligne.rendement_fiable
  return (
    <span className="flex flex-wrap gap-1.5">
      <Marque ton={fiable ? 'ferme' : 'neutre'}>{fiable ? "Prévision de l'année" : quoi === 'alerte' ? 'Risque habituel' : 'Récolte habituelle'}</Marque>
      {ligne.type_prevision === 'PROJECTION_NON_EVALUEE' && <Marque>Projection non vérifiable</Marque>}
    </span>
  )
}

/** La saisie de l'année d'une fonctionnalité, avec sa nature en une ligne. `saison` : ligne du modèle 1, pour la vérification. */
export function ChampAnnee({ cadre, a, saison, className = 'mt-4' }: { cadre: Cadre; a: ReturnType<typeof useAnnee>; saison?: PrevisionSaison | null; className?: string }) {
  return <SaisieAnnee className={className} annee={a.annee} onChange={cadre.choisirAnnee} passees={a.passees} min={a.aVenir} max={a.max} nature={natureAnnee(a.annee, a.aVenir, saison)} />
}
