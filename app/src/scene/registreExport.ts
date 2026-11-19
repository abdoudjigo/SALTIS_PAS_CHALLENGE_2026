// Registre de l'export (phase D2) : l'instance Mapbox unique et la dernière sortie de chaque étape de l'ONG.
// Hors rendu : rempli par les rappels de la carte et des étapes, lu seulement à l'export, vidé à la déconnexion.
import type { Map as CarteMapbox } from 'mapbox-gl'
import type { EtapeExport, ModeOng } from './cadre'
import { effacerDossiers } from './dossier'

export const registre: { carte: CarteMapbox | null; etapes: Partial<Record<ModeOng, EtapeExport>>; surPerte: Set<() => void> } = { carte: null, etapes: {}, surPerte: new Set() }

/** La carte change (chargée, ou null au démontage) : une attente en cours est prévenue de la perte. */
export function definirCarte(carte: CarteMapbox | null) {
  registre.carte = carte
  if (!carte) registre.surPerte.forEach((f) => f())
}

/** Déconnexion : plus aucune trace du dossier ni des étapes de la session précédente. */
export function viderExport() {
  registre.etapes = {}
  effacerDossiers()
}
