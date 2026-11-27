// Mesure d'audience : UN seul point d'envoi des événements (audit, constats ANA-02 et ANA-03).
// Plan de marquage : docs/technique/plan-de-marquage.md. Un événement absent du plan n'est pas envoyé.
// - Rien sans l'accord du visiteur (consentement/consentement.ts) ni sur un appareil de l'équipe (ANA-04).
// - Jamais de donnée personnelle : position, nom, texte libre, surface, stock ou prix sont refusés.
// - La mesure ne doit jamais casser un écran : toute erreur est ignorée.
import { consentement } from '../consentement/consentement'

export const EVENEMENTS = [
  'porte_entree', // profil choisi à l'entrée
  'ecran_ouvert', // écran du dock
  'annee_choisie', // type d'année : passée, océan (prévision fin mai), tendance
  'parcelle_localisee', // résultat de « Me localiser » ou choix dans la liste (jamais la position)
  'voix_lue', // lecture en français ou en wolof, et son résultat
  'export_pdf', // dossier ou fiche téléchargé
  'scenario_choisi', // scénario de répartition d'un stock
  'avis_envoye', // formulaire « Donner votre avis »
  'avis_erreur',
  'carte_indisponible', // pas de carte 3D (WebGL absent ou erreur)
  'hors_ligne', // bandeau hors ligne ou serveur muet affiché
  'assistant_question', // question à l'assistant : langue, sujet compris, résultat (jamais le texte)
] as const
export type Evenement = (typeof EVENEMENTS)[number]

type Valeur = string | number | boolean
const INTERDIT = /lat|lon|position|coord|nom|email|tel|texte|message|surface|stock|prix|quantite/i
const MAX_VALEUR = 40

declare global {
  interface Window {
    umami?: { track: (evenement: string, proprietes?: Record<string, Valeur>) => void }
  }
}

export function suivre(evenement: Evenement, proprietes: Record<string, Valeur> = {}) {
  if (!consentement.audienceAcceptee() || appareilEquipe()) return
  const sures = Object.fromEntries(
    Object.entries(proprietes)
      .filter(([cle]) => !INTERDIT.test(cle))
      .map(([cle, v]) => [cle, typeof v === 'string' ? v.slice(0, MAX_VALEUR) : v]),
  )
  try {
    window.umami?.track(evenement, sures)
  } catch {
    /* la mesure ne doit jamais casser l'écran */
  }
}

/** Appareil de l'équipe (lien caché « ?equipe=1 », voir consentement/audience.ts) : rien n'est mesuré. */
export const CLE_EQUIPE = 'assaman.equipe'
export function appareilEquipe(): boolean {
  try {
    return localStorage.getItem(CLE_EQUIPE) === '1'
  } catch {
    return false
  }
}
