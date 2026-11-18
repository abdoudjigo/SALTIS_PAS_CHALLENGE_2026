// Conversions pour parler comme un conseiller agricole : des sacs, des jours d'eau, des années sur 5.
// On arrondit pour lire, jamais pour embellir : une valeur absente reste « non disponible », jamais 0.
import { libelle, nombre } from '../lib/format'
import type { ColonneBesoin, LigneBesoin } from '../types/marts'
import type { RisqueSemis } from '../types/previsions'
import { culture as cult } from './lecture'

export const NON_DISPONIBLE_TXT = 'non disponible'

/** Le cycle se dit au masculin : « cycle court », pas « cycle courte ». */
export const CYCLE_DIT: Record<string, string> = { courte: 'court', moyenne: 'moyen', longue: 'long' }
export const cycleDit = (option: string | null | undefined) => (option ? CYCLE_DIT[option] ?? option : '')

/** Sacs de 50 kg, arrondis au demi-sac supérieur. */
export const SAC_KG = 50
export const sacs = (kg: number) => Math.ceil(kg / (SAC_KG / 2)) / 2
/** « 6 sacs (300 kg) », « 1 sac (32 kg) », « ½ sac (12 kg) ». */
export function enSacs(kg: number) {
  const n = sacs(kg)
  const combien = n === 0.5 ? '½ sac' : `${nombre(n, { decimales: 1 })} sac${n > 1 ? 's' : ''}`
  return `${combien} (${nombre(kg, { unite: 'kg' })})`
}
export const nombreSacs = (n: number) => (n === 0.5 ? '½ sac' : `${nombre(n, { decimales: 1 })} sac${n > 1 ? 's' : ''}`)

/** Jours d'eau gardés par le sol (règle du projet : réserve utile ÷ 4 mm par jour), arrondis à 5 jours. */
export function joursEau(reserveMm: number | null | undefined): number | null {
  if (reserveMm === null || reserveMm === undefined) return null
  return Math.round(reserveMm / 4 / 5) * 5
}
export function texteJoursEau(reserveMm: number | null | undefined) {
  const j = joursEau(reserveMm)
  if (j === null) return 'Ce que le sol garde d’eau n’est pas disponible.'
  return j === 0 ? 'Le sol garde l’eau moins de 5 jours sans pluie.' : `Le sol garde l’eau environ ${j} jours sans pluie.`
}

/** Une probabilité en « années sur 5 », arrondie au cinquième le plus proche. */
export function anneesSur5(pct: number | null | undefined) {
  if (pct === null || pct === undefined) return NON_DISPONIBLE_TXT
  const k = Math.round(pct / 20)
  if (k === 0) return 'moins d’une année sur 5'
  // 5 sur 5 laisserait croire à une certitude
  if (k === 5) return 'presque chaque année'
  return `${k} année${k > 1 ? 's' : ''} sur 5`
}

/** La culture avec son article, en minuscules : « l'arachide », « le mil (souna) ». */
export const laCulture = (code: string) => cult.le(libelle(code))
const majuscule = (t: string) => t.charAt(0).toLocaleUpperCase('fr-FR') + t.slice(1)

const FEMININ = /^(arachide|pastèque|tomate)/i

/** Le mode montre une autre culture que celle choisie ailleurs : on le dit en une ligne. */
export function repliCulture(demandee: string | null, montree: string | null) {
  if (!demandee || !montree || demandee === montree) return null
  return `${majuscule(laCulture(demandee))} n’est pas couvert${FEMININ.test(demandee) ? 'e' : ''} ici : on montre ${laCulture(montree)}.`
}

// --- Modèle 4 : la fenêtre de semis -----------------------------------------------------------------
/** En dessous de ce risque total, une décade voisine de la meilleure fait encore partie du bon moment. */
export const RISQUE_BON_MOMENT = 20
/** Le bon moment : la décade conseillée et ses voisines immédiates tant que le risque reste bas. */
export function fenetre(decades: RisqueSemis[]) {
  const i = decades.findIndex((d) => d.decade_conseillee)
  if (i < 0) return null
  const bonne = (d: RisqueSemis | undefined) => d !== undefined && d.risque_total_pct !== null && d.risque_total_pct < RISQUE_BON_MOMENT
  let [de, a] = [i, i]
  while (bonne(decades[de - 1])) de--
  while (bonne(decades[a + 1])) a++
  return { de, a, meilleure: decades[i] }
}


/** La fenêtre de semis d'une culture et sa date de début (« 21 juin »), à partir des décades du modèle 4. */
export function fenetreCulture(lignes: RisqueSemis[] | undefined, culture: string | null) {
  const decades = (lignes ?? []).filter((l) => l.culture === culture).sort((a, b) => a.decade_semis - b.decade_semis)
  const f = fenetre(decades)
  if (!f) return null
  const sur = f.meilleure.risque_total_pct !== null && f.meilleure.risque_total_pct < RISQUE_BON_MOMENT
  return { ...f, decades, sur, debut: decades[f.de].decade_semis, fin: decades[f.a].decade_semis }
}

// --- Doses -------------------------------------------------------------------------------------------
/** Dose par hectare retrouvée depuis le besoin du département : besoin (t) × 1000 / superficie (ha). */
export function dose(ligne: LigneBesoin, colonne: ColonneBesoin) {
  if (colonne === 'besoin_semences_retenu_t' && ligne.besoin_semences_applicable === false) return null
  const besoin = ligne[colonne]
  return besoin === null || !ligne.superficie_reference_ha ? null : (besoin * 1000) / ligne.superficie_reference_ha
}
/** Sacs d'engrais (NPK, urée, DAP) pour 1 ha, chacun au demi-sac supérieur ; null si aucune dose n'est connue. */
export function sacsEngraisParHa(ligne: LigneBesoin | undefined) {
  if (!ligne) return null
  const kg = (['besoin_npk_15_15_15_t', 'besoin_uree_t', 'besoin_dap_t'] as ColonneBesoin[]).map((c) => dose(ligne, c)).filter((d): d is number => d !== null && Math.round(d) > 0)
  return kg.length ? kg.reduce((t, d) => t + sacs(d), 0) : null
}

// --- Contre-saison : l'eau en heures de pompage ----------------------------------------------------
/** Un forage à 1 L/s donne 3,6 m³ par heure (docs/carte-opportunites.md, section 4). */
export const M3_PAR_HEURE_1_LS = 3.6
/** Heures de pompage à 1 L/s pour un volume (m³), arrondies à 50 : « environ 2 800 heures ». */
export function heuresPompage(m3: number) {
  const h = Math.round(m3 / M3_PAR_HEURE_1_LS / 50) * 50
  return h === 0 ? 'moins de 50 heures' : `environ ${nombre(h)} heures`
}
