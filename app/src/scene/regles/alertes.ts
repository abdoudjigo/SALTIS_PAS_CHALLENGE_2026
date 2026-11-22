// Alerte récolte (modèle 3) : une seule règle pour tous les écrans (Alerte récolte, Préparer la campagne).
// Une ALERTE n'est montrée comme telle (rouge qui bat, « en alerte ») que si le modèle fait mieux que la fréquence
// passée pour cette culture à ce moment (`alerte_fiable`). Sinon, un risque élevé n'est que le risque habituel du
// département : il est signalé, jamais présenté comme une prévision de l'année (audit, constat IA-01).
import { SEUIL_ALERTE_PCT, type PrevisionRendement } from '../../types/previsions'

type LigneAlerte = Pick<PrevisionRendement, 'proba_chute_pct' | 'alerte_fiable'>

const auDessusDuSeuil = (l: LigneAlerte) => l.proba_chute_pct !== null && l.proba_chute_pct >= SEUIL_ALERTE_PCT

/** Alerte de l'année : risque au-dessus du seuil ET prévision fiable. */
export const estAlerte = (l: LigneAlerte) => auDessusDuSeuil(l) && l.alerte_fiable === true

/** Risque habituel élevé : au-dessus du seuil, mais sans prévision fiable de l'année. */
export const risqueHabituelEleve = (l: LigneAlerte) => auDessusDuSeuil(l) && l.alerte_fiable !== true
