// Ce que les modes de l'agriculteur donnent à la fiche commune (FicheReponse) : les lignes, les puces, le texte lu.
import type { ReactNode } from 'react'
import { libelle } from '../lib/format'
import type { PrevisionSaison } from '../types/previsions'
import type { Cadre, IdEtape, useAnnee } from './cadre'
import { ChampAnnee } from './previsions'
import { Champ, ErreurChamp, Options } from './ui'

/** ok, attention, non : un verdict tiré d'un champ de l'API ou d'une règle du projet ; info : un fait, sans règle validée. */
export type EtatLigne = 'ok' | 'attention' | 'non' | 'info'
/** Une ligne de la liste : une idée, un seul chiffre entre `**` (mis en gras), 60 caractères au plus. */
export interface LigneCheck {
  etat: EtatLigne
  texte: string
  /** un renvoi vers une autre question du parcours (ex. « Contre-saison ») */
  lien?: { libelle: string; mode: IdEtape }
}
/** Un choix du mode (année, culture, surface) : une puce qui ouvre le sélecteur existant. */
export interface Puce {
  id: string
  /** ce que la puce affiche : « 2026 · prévision », « Arachide », « 2 ha » */
  libelle: string
  /** ce qu'on choisit, pour les lecteurs d'écran : « Année », « Culture », « Surface » */
  nom: string
  contenu: (fermer: () => void) => ReactNode
}

/** Sans département choisi : la seule ligne de la fiche. */
export const CHOISIR: LigneCheck = { etat: 'info', texte: 'Touchez un département sur la carte' }

const PRIORITE: Record<EtatLigne, number> = { non: 0, attention: 1, ok: 2, info: 3 }
/** Les lignes de la liste, rangées non > attention > ok > info (ordre d'origine gardé à égalité), 3 au plus. */
export const trierLignes = (lignes: LigneCheck[]) => [...lignes].sort((x, y) => PRIORITE[x.etat] - PRIORITE[y.etat]).slice(0, 3)

const sansGras = (t: string) => t.replace(/\*\*/g, '')
const point = (t: string) => (/[.!?…]$/.test(t) ? t : `${t}.`)
/** Ce que lit la voix : le titre, puis les lignes de la liste. Le détail n'est pas lu. */
export const aLire = (titre: string, lignes: LigneCheck[]) => [point(titre), ...lignes.slice(0, 3).map((l) => point(sansGras(l.texte)))]

/** L'année du cadre partagé : la saisie existante (année à prévoir ou année passée). */
export function puceAnnee(cadre: Cadre, a: ReturnType<typeof useAnnee>, saison?: PrevisionSaison | null): Puce {
  return {
    id: 'annee', nom: 'Année', libelle: `${a.annee} · ${a.passee ? 'passée' : 'prévision'}`,
    contenu: () => <ChampAnnee cadre={cadre} a={a} saison={saison} className="" />,
  }
}

/**
 * La culture du cadre partagé, parmi celles que le mode connaît.
 * `toutes` (ONG) : une première option « Toutes » qui remet la culture partagée à null.
 */
export function puceCulture(cadre: Cadre, cultures: string[], culture: string | null, toutes?: string): Puce {
  const options: { id: string | null; libelle: string }[] = [...(toutes ? [{ id: null, libelle: toutes }] : []), ...cultures.map((c) => ({ id: c, libelle: libelle(c) }))]
  return {
    id: 'culture', nom: 'Culture', libelle: culture ? libelle(culture) : toutes ?? 'Culture',
    contenu: (fermer) => <Options nom="Culture" options={options} valeur={culture} choisir={cadre.choisirCulture} fermer={fermer} />,
  }
}

/** Un choix parmi quelques options (intrant, scénario, vue de la carte) : même menu que la culture. */
export function puceChoix<T extends string>(id: string, nom: string, options: { id: T; libelle: string }[], valeur: T, choisir: (id: T) => void): Puce {
  return {
    id, nom, libelle: options.find((o) => o.id === valeur)?.libelle ?? nom,
    contenu: (fermer) => <Options nom={nom} options={options} valeur={valeur} choisir={choisir} fermer={fermer} />,
  }
}

/** La surface du champ (ha), saisie existante. */
/** `erreur` : message de `lireSaisie` ; la surface reste à corriger tant qu'il n'est pas levé (besoins non calculés). */
export function puceSurface(saisie: string, onChange: (texte: string) => void, libelleHa: string, erreur?: string | null): Puce {
  return {
    id: 'surface', nom: 'Surface', libelle: erreur ? 'Surface : à corriger' : `${libelleHa} ha`,
    contenu: (fermer) => (
      <>
        <Champ libelle="Surface (ha)">
          <input className="champ-scene tabular-nums" inputMode="decimal" value={saisie} autoFocus onChange={(e) => onChange(e.target.value)}
            aria-invalid={Boolean(erreur)} aria-describedby={erreur ? 'erreur-surface' : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fermer() } }} />
        </Champ>
        {erreur && <ErreurChamp id="erreur-surface">Surface : {erreur}</ErreurChamp>}
      </>
    ),
  }
}
