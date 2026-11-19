// Données d'EXEMPLE générées de façon déterministe, avec les colonnes des marts (docs/contrat-donnees.md).
// Ordres de grandeur plausibles (gradient de pluie nord-sud), valeurs NON réelles.
import type {
  ClasseSaison, Departement, LigneBesoin, LigneCarte, LigneChoixCulture, LigneSuivi, LigneTerritoireAgrodistrib,
  LigneVulnerabilite, NiveauAdequation, RisqueSaison, StatutDose, Territoire,
} from '../../types/marts'
import { CULTURES, CULTURES_IRRIGUEES, DEPARTEMENTS, VARIETES, ZONES } from './referentiel'

export const CAMPAGNES = Array.from({ length: 45 }, (_, i) => 1981 + i) // 1981-2025
const SANS_RENDEMENT = ['Guédiawaye', 'Pikine']
const SANS_VULNERABILITE = ['Dakar', ...SANS_RENDEMENT]

// --- Aléatoire reproductible -------------------------------------------------
export type Aleatoire = () => number

function graine(texte: string) {
  let h = 1779033703 ^ texte.length
  for (let i = 0; i < texte.length; i++) {
    h = Math.imul(h ^ texte.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}
export function rng(texte: string): Aleatoire {
  let a = graine(texte)
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const gauss = (r: Aleatoire) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())
export const arrondi = (x: number, n = 1) => Math.round(x * 10 ** n) / 10 ** n
export const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
export const entete = (d: Territoire): Territoire => ({
  code_departement: d.code_departement, departement: d.departement, code_region: d.code_region,
  region: d.region, zone_agroecologique: d.zone_agroecologique,
})

// --- Climat de base par département ------------------------------------------
interface Climat { normale: number; cv: number; debut: number; duree: number; nord: number }

const PALIERS: [number, number][] = [[12.4, 1450], [13, 1050], [13.8, 780], [14.2, 620], [14.7, 470], [15.3, 360], [15.7, 300], [16.7, 230]]
function normaleSaison(lat: number) {
  for (let i = 1; i < PALIERS.length; i++) {
    const [l0, v0] = PALIERS[i - 1]
    const [l1, v1] = PALIERS[i]
    if (lat <= l1) return v0 + ((borne(lat, l0, l1) - l0) / (l1 - l0)) * (v1 - v0)
  }
  return PALIERS[PALIERS.length - 1][1]
}
const climatCache = new Map<string, Climat>()
export function climat(dep: Departement): Climat {
  let c = climatCache.get(dep.code_departement)
  if (!c) {
    const nord = borne((dep.latitude - 12.4) / 4.3, 0, 1) // 0 au sud, 1 au nord
    c = {
      normale: Math.round(normaleSaison(dep.latitude)),
      cv: 0.14 + 0.24 * nord,
      debut: Math.round(165 + 32 * nord),
      duree: Math.round(140 - 75 * nord),
      nord,
    }
    climatCache.set(dep.code_departement, c)
  }
  return c
}

function classeSaison(spi: number): ClasseSaison {
  if (spi < -1.5) return 'très sèche'
  if (spi < -0.5) return 'sèche'
  if (spi <= 0.5) return 'normale'
  if (spi <= 1.5) return 'humide'
  return 'très humide'
}
function risque(sec: boolean, exces: boolean): RisqueSaison {
  if (sec && exces) return 'sécheresse et excès de pluie'
  if (sec) return 'sécheresse'
  if (exces) return 'excès de pluie'
  return 'normal'
}

// --- Vulnérabilité (mart_vulnerabilite_departement) ---------------------------
function rangCentile(valeurs: (number | null)[], inverse = false): (number | null)[] {
  const notes = valeurs.flatMap((v, i) => (v === null ? [] : [{ v, i }]))
  notes.sort((a, b) => (inverse ? b.v - a.v : a.v - b.v))
  const res: (number | null)[] = Array(valeurs.length).fill(null)
  const n = notes.length
  notes.forEach((x, k) => {
    res[x.i] = n > 1 ? arrondi((k / (n - 1)) * 100, 1) : 50
  })
  return res
}

let vulnerabiliteCache: LigneVulnerabilite[] | undefined
export function vulnerabilite(): LigneVulnerabilite[] {
  if (vulnerabiliteCache) return vulnerabiliteCache
  const base = DEPARTEMENTS.map((d) => {
    const c = climat(d)
    const r = rng('vul' + d.code_departement)
    const sansRdt = SANS_RENDEMENT.includes(d.departement)
    const faible = d.departement === 'Dakar'
    return {
      ...entete(d),
      freq_alerte_secheresse_pct: arrondi(8 + 22 * c.nord + 6 * r(), 1),
      variabilite_pluie_cv_pct: arrondi(c.cv * 100 + 4 * gauss(r), 1),
      pluie_saison_annee_seche_mm: Math.round(c.normale * (0.62 + 0.1 * r())),
      variabilite_rendement_pct: sansRdt ? null : arrondi(18 + 20 * c.nord + 8 * r(), 1),
      tendance_rendement_pct_an: sansRdt ? null : arrondi(-1 + 3 * r(), 2),
      nb_cultures_rendement: sansRdt ? 0 : faible ? 2 : 4 + Math.floor(r() * 6),
      nb_campagnes_rendement: sansRdt ? 0 : faible ? 11 : 100 + Math.floor(r() * 120),
      freq_alerte_exces_pct: arrondi(4 + 14 * (1 - c.nord) * r(), 1),
      proba_saison_seche_pct: arrondi(15 + 10 * r(), 1),
      proba_sequence_seche_15j_pct: arrondi(10 + 50 * c.nord + 8 * r(), 1),
      part_cultures_pct: sansRdt ? null : arrondi(10 + 60 * r() * (1 - Math.abs(c.nord - 0.45)), 1),
      confiance_rendement: (sansRdt || faible ? 'faible' : 'normale') as 'faible' | 'normale',
    }
  })
  const r1 = rangCentile(base.map((b) => b.freq_alerte_secheresse_pct))
  const r2 = rangCentile(base.map((b) => b.variabilite_pluie_cv_pct))
  const r3 = rangCentile(base.map((b) => b.pluie_saison_annee_seche_mm), true)
  const avecSens = base.map((b) => b.confiance_rendement === 'normale')
  const r4 = rangCentile(base.map((b, i) => (avecSens[i] ? b.variabilite_rendement_pct : null)))
  const r5 = rangCentile(base.map((b, i) => (avecSens[i] ? b.tendance_rendement_pct_an : null)), true)

  const lignes: LigneVulnerabilite[] = base.map((b, i) => {
    const alea = arrondi(((r1[i] ?? 0) + (r2[i] ?? 0) + (r3[i] ?? 0)) / 3, 1)
    const sens = avecSens[i] ? arrondi(0.7 * (r4[i] ?? 0) + 0.3 * (r5[i] ?? 0), 1) : null
    const score = SANS_VULNERABILITE.includes(b.departement) || sens === null ? null : arrondi(0.6 * alea + 0.4 * sens, 1)
    return {
      ...b,
      rang_freq_alerte_secheresse: r1[i], rang_variabilite_pluie: r2[i], rang_pluie_annee_seche: r3[i],
      rang_variabilite_rendement: r4[i], rang_tendance_rendement: r5[i],
      score_alea_secheresse: alea,
      score_sensibilite_rendement: sens,
      score_vulnerabilite: score,
      rang_vulnerabilite: null,
      classe_vulnerabilite: null,
      nb_dimensions_disponibles: sens === null ? 1 : 2,
      methode_version: 'v1', periode_climat: '1991-2020', periode_rendement: '1991-2015', nb_saisons_1991_2020: 30,
    }
  })
  const notes = lignes.filter((l) => l.score_vulnerabilite !== null).sort((a, b) => b.score_vulnerabilite! - a.score_vulnerabilite!)
  const classes = ['très élevée (relatif)', 'élevée (relatif)', 'moyenne (relatif)', 'faible (relatif)', 'très faible (relatif)']
  const tailles = [9, 9, 8, 8, 8]
  let k = 0
  tailles.forEach((t, c) => {
    for (let j = 0; j < t && k < notes.length; j++, k++) {
      notes[k].rang_vulnerabilite = k + 1
      notes[k].classe_vulnerabilite = classes[c]
    }
  })
  vulnerabiliteCache = lignes
  return lignes
}
const vulParCode = () => new Map(vulnerabilite().map((v) => [v.code_departement, v]))

// --- Carte agroclimatique (mart_carte_agroclimat) ----------------------------
const carteCache = new Map<number, LigneCarte[]>()
export function carteAgroclimat(campagne: number): LigneCarte[] {
  const enCache = carteCache.get(campagne)
  if (enCache) return enCache
  const vul = vulParCode()
  const lignes = DEPARTEMENTS.map((d): LigneCarte => {
    const c = climat(d)
    const r = rng(`carte${d.code_departement}${campagne}`)
    const ry = rng(`annee${campagne}`) // signal commun à l'année (années sèches nationales)
    const signalAnnee = gauss(ry) * 0.7 + (campagne <= 1990 ? -0.6 : campagne >= 2010 ? 0.2 : 0)
    const spi = arrondi(signalAnnee + 0.7 * gauss(r), 2)
    const pluie = Math.max(40, Math.round(c.normale * (1 + spi * c.cv)))
    const sec = spi < -1
    // une saison sèche peut aussi connaître des pluies intenses ponctuelles (≈ 4 % des saisons dans la source)
    const exces = spi > 1.3 || (spi > 0.8 && r() < 0.15) || (sec && r() < 0.25)
    const debut = Math.round(c.debut - spi * 6 + gauss(r) * 5)
    const duree = Math.max(25, Math.round(c.duree + spi * 9 + gauss(r) * 6))
    const v = vul.get(d.code_departement)
    return {
      ...entete(d),
      campagne_agricole: campagne,
      pluie_saison_mm: pluie,
      pluie_saison_normale_mm: c.normale,
      anomalie_pluie_saison_pct: arrondi(((pluie - c.normale) / c.normale) * 100, 1),
      spi_saison: spi,
      classe_saison: classeSaison(spi),
      debut_saison_jour: debut,
      fin_saison_jour: debut + duree,
      retard_debut_saison_j: Math.max(0, debut - c.debut),
      duree_saison_j: duree,
      nb_jours_pluie: Math.round(pluie / (9 + 4 * r())),
      plus_longue_sequence_seche_j: Math.round(8 + 14 * c.nord - spi * 3 + 4 * r()),
      nb_sequences_seches_7j: Math.max(0, Math.round(2 + 3 * c.nord - spi + gauss(r))),
      nb_decades_seches: Math.max(0, Math.round(2 + 5 * c.nord - spi * 1.5 + gauss(r))),
      temp_max_moy_saison_c: arrondi(31 + 6 * c.nord + gauss(r) * 0.6, 1),
      nb_jours_tmax_sup_40: Math.max(0, Math.round(25 * c.nord ** 2 + gauss(r) * 4)),
      ndvi_max_saison_zc: campagne < 2000 ? null : arrondi(0.25 + 0.5 * (1 - c.nord) + spi * 0.04, 3),
      anomalie_ndvi_pct: campagne < 2000 ? null : arrondi(spi * 8 + gauss(r) * 3, 1),
      alerte_secheresse: sec,
      alerte_exces_pluie: exces,
      risque_saison: risque(sec, exces),
      score_vulnerabilite: v?.score_vulnerabilite ?? null,
      classe_vulnerabilite: v?.classe_vulnerabilite ?? null,
      source_calendrier: d.departement === 'Guédiawaye' ? 'NASA POWER' : 'CHIRPS journalier',
    }
  })
  carteCache.set(campagne, lignes)
  return lignes
}

export function historiqueDepartement(code: string): LigneCarte[] {
  return CAMPAGNES.flatMap((a) => carteAgroclimat(a).filter((l) => l.code_departement === code))
}

// --- Suivi décadaire (mart_suivi_decadaire) -----------------------------------
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']
const JOURS_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
export function libelleDecade(n: number) {
  const m = Math.floor((n - 1) / 3)
  return `${['1-10', '11-20', `21-${JOURS_MOIS[m]}`][(n - 1) % 3]} ${MOIS[m]}`
}

function partsSaison(c: Climat) {
  // cloche centrée fin août, plus étroite au nord
  const centre = 24 + 0.5 * (1 - c.nord)
  const largeur = 2.2 + 2.2 * (1 - c.nord)
  const brut = Array.from({ length: 36 }, (_, i) => {
    const n = i + 1
    return Math.exp(-(((n - centre) / largeur) ** 2) / 2) + (n >= 13 && n <= 33 ? 0.004 : 0)
  })
  const total = brut.reduce((a, b) => a + b, 0)
  return brut.map((v) => v / total)
}

export function suiviDecadaire(code: string, annee: number): LigneSuivi[] {
  const d = DEPARTEMENTS.find((x) => x.code_departement === code)
  if (!d || d.departement === 'Guédiawaye') return []
  const c = climat(d)
  const saison = carteAgroclimat(annee).find((l) => l.code_departement === code)
  const facteur = (saison?.pluie_saison_mm ?? c.normale) / c.normale
  const r = rng(`suivi${code}${annee}`)
  let cumul = 0
  let cumulNormale = 0
  return partsSaison(c).map((p, i) => {
    const n = i + 1
    const enSaison = n >= 16 && n <= 30
    const normaleDec = c.normale * p
    const bruit = Math.exp(gauss(r) * 0.55 - 0.15)
    const seche = enSaison && r() < 0.08 + 0.1 * c.nord
    const pluie = arrondi(seche ? normaleDec * 0.15 * r() : normaleDec * facteur * bruit, 1)
    if (enSaison) {
      cumul += pluie
      cumulNormale += normaleDec
    }
    return {
      ...entete(d),
      annee, campagne_agricole: n <= 15 ? annee - 1 : annee,
      numero_decade_annee: n,
      libelle_decade: libelleDecade(n),
      est_decade_saison: enSaison,
      pluie_mm: pluie,
      pluie_normale_mm: arrondi(normaleDec, 1),
      ecart_pluie_mm: arrondi(pluie - normaleDec, 1),
      anomalie_pluie_pct: normaleDec < 1 ? null : arrondi(((pluie - normaleDec) / normaleDec) * 100, 1),
      cumul_depuis_juin_mm: enSaison ? arrondi(cumul, 1) : null,
      cumul_normale_depuis_juin_mm: enSaison ? arrondi(cumulNormale, 1) : null,
      ecart_cumul_normale_mm: enSaison ? arrondi(cumul - cumulNormale, 1) : null,
      part_saison_pct: enSaison ? arrondi(p * 100, 1) : null,
      pluie_1_annee_sur_5_mm: arrondi(normaleDec * 0.45, 1),
      pluie_mediane_mm: arrondi(normaleDec * 0.92, 1),
      pluie_4_annees_sur_5_mm: arrondi(normaleDec * 1.5, 1),
      proba_decade_seche_pct: arrondi(borne(100 * Math.exp(-normaleDec / 18), 0, 100), 1),
      nb_jours_pluie: Math.round(pluie / 9),
      plus_longue_sequence_seche_j: enSaison ? Math.round(borne(10 - pluie / 12, 0, 10)) : 10,
      decade_seche: pluie < 10,
    }
  })
}

// --- Choix des cultures (mart_choix_cultures) ---------------------------------
export const CYCLES: Record<string, [number, number, number]> = {
  'ARACHIDE': [90, 105, 120], 'MIL (SOUNA)': [75, 90, 120], 'SORGHO': [90, 110, 130], 'NIÉBÉ': [60, 75, 90],
  'MAÏS': [80, 100, 120], 'RIZ (IRRIGUÉ)': [100, 120, 140], 'MANIOC': [270, 300, 360], 'SÉSAME': [80, 95, 110],
  'PASTÈQUE': [70, 80, 90], 'COTON': [110, 130, 150], 'TOMATE': [90, 110, 130], 'OIGNON': [100, 120, 140],
}
const probaCycle = (duree: number, cycle: number) => arrondi(borne(100 / (1 + Math.exp(-(duree - cycle) / 9)), 0, 100), 1)

function niveauCulture(score: number): NiveauAdequation {
  if (score > 80) return 'adaptée'
  if (score > 50) return 'à risque'
  return 'déconseillée'
}

function classerOptions(options: LigneChoixCulture[]) {
  const tri = options.filter((o) => o.proba_cycle_couvert_pct !== null)
    .sort((a, b) => b.proba_cycle_couvert_pct! - a.proba_cycle_couvert_pct!)
  options.forEach((o) => {
    o.rang_option = o.proba_cycle_couvert_pct === null ? null : tri.indexOf(o) + 1
  })
}

export function choixCultures(code: string): LigneChoixCulture[] {
  const d = DEPARTEMENTS.find((x) => x.code_departement === code)
  if (!d) return []
  const c = climat(d)
  const lignes: LigneChoixCulture[] = []
  CULTURES.forEach((culture) => {
    const irriguee = CULTURES_IRRIGUEES.includes(culture)
    const manioc = culture === 'MANIOC'
    const pEau = manioc || irriguee ? null : arrondi(borne(c.normale / 7 - (CYCLES[culture][1] - 90) * 0.4, 5, 99), 1)
    const options = (['courte', 'moyenne', 'longue'] as const).map((option, k): LigneChoixCulture => {
      const p = manioc ? null : probaCycle(c.duree + 25, CYCLES[culture][k])
      const score = p === null || pEau === null ? null : Math.round(0.6 * p + 0.4 * pEau)
      return {
        ...entete(d), culture, type_option: 'CYCLE', option, cycle_jours: CYCLES[culture][k],
        proba_cycle_couvert_pct: p,
        rang_option: null,
        score_adequation: score,
        proba_besoin_eau_couvert_pct: option === 'moyenne' ? pEau : null,
        niveau_adequation: manioc ? 'non évaluée (culture pluriannuelle)' : irriguee ? 'irrigation requise' : niveauCulture(score ?? 0),
        note_score: score !== null && option !== 'moyenne' ? 'score calculé avec la part eau du cycle moyen' : null,
        tolerance_secheresse: null, disponibilite_semences: null, zones_recommandees: null,
      }
    })
    classerOptions(options)
    lignes.push(...options)

    // Variétés évaluées : celles dont le cycle est connu (le mil souna n'a pas de cycle documenté)
    const varietes = VARIETES.filter((v) => v.culture === culture && v.cycle_jours !== null).map((v): LigneChoixCulture => {
      const irrigue = v.variete === 'Sahel 177'
      const p = irrigue ? null : probaCycle(c.duree + 25, v.cycle_jours!)
      return {
        ...entete(d), culture, type_option: 'VARIETE', option: v.variete, cycle_jours: v.cycle_jours,
        proba_cycle_couvert_pct: p, rang_option: null, score_adequation: null, proba_besoin_eau_couvert_pct: null,
        niveau_adequation: p === null ? 'irrigation requise' : p >= 80 ? 'adaptée' : p > 50 ? 'à risque' : 'déconseillée',
        note_score: null,
        tolerance_secheresse: v.tolerance_secheresse, disponibilite_semences: v.disponibilite_semences,
        zones_recommandees: v.zones_recommandees,
      }
    })
    classerOptions(varietes)
    lignes.push(...varietes)
  })
  return lignes
}

/** Toutes les lignes VARIETE de mart_choix_cultures (45 départements × variétés évaluées) */
export function adequationVarietes(): LigneChoixCulture[] {
  return DEPARTEMENTS.flatMap((d) => choixCultures(d.code_departement).filter((l) => l.type_option === 'VARIETE'))
}

// --- Besoins (mart_besoins) ---------------------------------------------------
// Superficies de référence typiques par zone (ha par département)
const SUPERFICIES: Record<string, Record<string, number>> = {
  'BASSIN ARACHIDIER': { 'ARACHIDE': 45000, 'MIL (SOUNA)': 38000, 'SORGHO': 6000, 'NIÉBÉ': 9000, 'MAÏS': 2500, 'SÉSAME': 1500, 'PASTÈQUE': 3000, 'MANIOC': 1200 },
  'CASAMANCE': { 'ARACHIDE': 25000, 'MIL (SOUNA)': 12000, 'SORGHO': 7000, 'MAÏS': 9000, 'RIZ (IRRIGUÉ)': 14000, 'NIÉBÉ': 1500, 'SÉSAME': 1800, 'MANIOC': 900 },
  'SÉNÉGAL ORIENTAL': { 'ARACHIDE': 18000, 'MIL (SOUNA)': 9000, 'SORGHO': 9000, 'MAÏS': 7000, 'COTON': 4000, 'NIÉBÉ': 1200, 'RIZ (IRRIGUÉ)': 2500, 'SÉSAME': 900 },
  'VALLÉE DU FLEUVE SÉNÉGAL': { 'RIZ (IRRIGUÉ)': 18000, 'SORGHO': 5000, 'MAÏS': 2500, 'OIGNON': 2500, 'TOMATE': 1200, 'MIL (SOUNA)': 3000, 'NIÉBÉ': 3500 },
  'NIAYES': { 'NIÉBÉ': 8000, 'ARACHIDE': 7000, 'MIL (SOUNA)': 6000, 'MANIOC': 3000, 'OIGNON': 2500, 'TOMATE': 900, 'PASTÈQUE': 2000 },
  'ZONE SYLVOPASTORALE': { 'MIL (SOUNA)': 22000, 'NIÉBÉ': 15000, 'ARACHIDE': 6000, 'PASTÈQUE': 2500, 'SORGHO': 1000 },
}
interface Dose { npk: number; uree: number; dap: number; fumier: number; statut: StatutDose; source: string }

// Doses d'exemple (kg/ha) et statuts, alignées sur ce que décrit docs/etat-modelisation.md
function doseEngrais(zone: string, culture: string): Dose | null {
  if (culture === 'MIL (SOUNA)')
    return { npk: 125, uree: 93.75, dap: 0, fumier: 0, statut: zone === 'CASAMANCE' ? 'A_CONFIRMER' : 'NON_VERIFIEE',
      source: zone === 'CASAMANCE' ? 'Tounkara et al. 2022' : 'Tounkara et al. 2022 (extrapolé)' }
  if (zone === 'VALLÉE DU FLEUVE SÉNÉGAL' && culture === 'RIZ (IRRIGUÉ)')
    return { npk: 200, uree: 250, dap: 0, fumier: 0, statut: 'A_CONFIRMER', source: 'Faye et al. 2020' }
  if (zone === 'VALLÉE DU FLEUVE SÉNÉGAL' && (culture === 'MAÏS' || culture === 'SORGHO'))
    return { npk: 400, uree: 130.43, dap: 0, fumier: 0, statut: 'NON_VERIFIEE', source: 'formule N120 P60 K60 (web)' }
  return null
}
const IRRIGATION_MM: Record<string, number> = { 'RIZ (IRRIGUÉ)': 900, 'OIGNON': 450, 'TOMATE': 500 }

const LIGNE_VIDE = {
  superficie_reference_ha: null, annees_reference: null, type_superficie: null, reference_anterieure_2015: null,
  besoin_azote_n_t: null, besoin_phosphate_p2o5_t: null, besoin_potasse_k2o_t: null, besoin_npk_15_15_15_t: null,
  besoin_npk_15_10_10_t: null, besoin_npk_6_20_10_t: null,
  besoin_uree_t: null, besoin_dap_t: null, besoin_fumier_t: null, libelle_besoin_engrais: null,
  besoin_semences_t: null, besoin_semences_applicable: null, besoin_semences_retenu_t: null, libelle_semences: null,
  besoin_irrigation_mm: null, volume_irrigation_m3_ha: null, irrigation_requise: null, irrigation_totale_m3: null,
  statut_validation_engrais: null, statut_validation_semis: null, source_reference_engrais: null,
  source_reference_semis: null, coherence_dose_n: null, coherence_dose_semis: null,
} as const

let besoinsCache: LigneBesoin[] | undefined
export function besoins(): LigneBesoin[] {
  if (besoinsCache) return besoinsCache
  const lignes: LigneBesoin[] = []
  DEPARTEMENTS.forEach((d) => {
    if (SANS_RENDEMENT.includes(d.departement)) {
      lignes.push({ ...entete(d), ...LIGNE_VIDE, culture: null, message_departement: 'pas de superficie agricole de référence' })
      return
    }
    const r = rng('besoins' + d.code_departement)
    Object.entries(SUPERFICIES[d.zone_agroecologique]).forEach(([culture, base]) => {
      const urbain = d.departement === 'Dakar' ? 0.02 : 1
      const sup = Math.round(base * urbain * (0.4 + 1.2 * r()))
      const ancienne = r() < 0.04
      const dose = doseEngrais(d.zone_agroecologique, culture)
      const calc = (kg: number) => (dose ? arrondi((sup * kg) / 1000, 1) : null)
      const riz = culture === 'RIZ (IRRIGUÉ)'
      const semencesApplicable = !(riz && d.zone_agroecologique === 'CASAMANCE')
      const semences = riz ? arrondi((sup * 40) / 1000, 1) : null
      const irrigMm = IRRIGATION_MM[culture] ?? null
      const volume = irrigMm ? Math.round((irrigMm * 10) / 0.6) : null
      lignes.push({
        ...entete(d), culture, message_departement: null,
        superficie_reference_ha: sup,
        annees_reference: ancienne ? '2003-2004' : '2019-2021',
        type_superficie: ancienne ? 'récoltée' : 'semée',
        reference_anterieure_2015: ancienne,
        besoin_azote_n_t: calc(dose ? dose.npk * 0.15 + dose.uree * 0.46 : 0),
        besoin_phosphate_p2o5_t: calc(dose ? dose.npk * 0.15 : 0),
        besoin_potasse_k2o_t: calc(dose ? dose.npk * 0.15 : 0),
        besoin_npk_15_15_15_t: calc(dose?.npk ?? 0),
        // Formules du catalogue PIA absentes des doses de démonstration : « dose à saisir », jamais 0
        besoin_npk_15_10_10_t: null, besoin_npk_6_20_10_t: null,
        libelle_npk_15_15_15: !dose ? 'dose à saisir' : dose.npk ? 'calculé' : 'pas dans la formule',
        libelle_npk_15_10_10: 'dose à saisir', libelle_npk_6_20_10: 'dose à saisir',
        libelle_uree: !dose ? 'dose à saisir' : dose.uree ? 'calculé' : 'pas dans la formule',
        libelle_dap: !dose ? 'dose à saisir' : dose.dap ? 'calculé' : 'pas dans la formule',
        libelle_fumier: 'non chiffré : fumure organique conseillée si possible',
        besoin_uree_t: calc(dose?.uree ?? 0),
        besoin_dap_t: calc(dose?.dap ?? 0),
        besoin_fumier_t: null,
        libelle_besoin_engrais: !dose ? 'dose à saisir' : sup === 0 ? 'superficie de référence nulle' : 'calculé',
        besoin_semences_t: semences,
        besoin_semences_applicable: semencesApplicable,
        besoin_semences_retenu_t: semencesApplicable ? semences : null,
        libelle_semences: !semencesApplicable ? 'non applicable (riz pluvial)' : semences === null ? 'dose à saisir' : sup === 0 ? 'superficie de référence nulle' : 'calculé',
        besoin_irrigation_mm: irrigMm,
        volume_irrigation_m3_ha: volume,
        irrigation_requise: irrigMm !== null,
        irrigation_totale_m3: volume !== null ? sup * volume : null,
        statut_validation_engrais: dose?.statut ?? 'A_COMPLETER',
        statut_validation_semis: riz ? (d.zone_agroecologique === 'VALLÉE DU FLEUVE SÉNÉGAL' ? 'A_CONFIRMER' : 'NON_VERIFIEE') : 'A_COMPLETER',
        source_reference_engrais: dose?.source ?? null,
        source_reference_semis: riz ? 'Faye et al. 2020' : null,
        coherence_dose_n: dose ? (r() < 0.8 ? 'COHERENT' : 'A_VERIFIER') : null,
        coherence_dose_semis: riz ? 'A_VERIFIER' : null,
      })
    })
  })
  besoinsCache = lignes
  return lignes
}

// --- Territoires AgroDistrib (mart_territoires_agrodistrib) -------------------
const FACTEURS = ['déficit hydrique', 'séquences sèches', 'chaleur', 'démarrage tardif', 'données insuffisantes']
const ORDRE_ADEQUATION: NiveauAdequation[] = ['adaptée', 'à risque', 'déconseillée', 'irrigation requise', 'non évaluée (culture pluriannuelle)']

let territoiresCache: LigneTerritoireAgrodistrib[] | undefined
export function territoiresAgrodistrib(): LigneTerritoireAgrodistrib[] {
  if (territoiresCache) return territoiresCache
  const vul = vulParCode()
  territoiresCache = besoins()
    .filter((b) => b.culture && (b.superficie_reference_ha ?? 0) > 0)
    .map((b): LigneTerritoireAgrodistrib => {
      const rz = rng(`zone${b.zone_agroecologique}${b.culture}`) // valeurs de zone
      const rd = rng(`sol${b.code_departement}`) // valeurs du département
      const choix = choixCultures(b.code_departement).filter((c) => c.culture === b.culture && c.type_option === 'CYCLE')
      const meilleur = choix.map((c) => c.niveau_adequation)
        .sort((x, y) => ORDRE_ADEQUATION.indexOf(x!) - ORDRE_ADEQUATION.indexOf(y!))[0] ?? null
      const probas = choix.flatMap((c) => (c.proba_cycle_couvert_pct === null ? [] : [c.proba_cycle_couvert_pct]))
      const moyen = Math.round(500 + 900 * rz())
      const atteignable = Math.round(moyen * (1.2 + 0.6 * rz()))
      const v = vul.get(b.code_departement)!
      return {
        ...entete(b), culture: b.culture!,
        superficie_reference_ha: b.superficie_reference_ha!,
        besoin_azote_n_t: b.besoin_azote_n_t, besoin_phosphate_p2o5_t: b.besoin_phosphate_p2o5_t,
        besoin_potasse_k2o_t: b.besoin_potasse_k2o_t, besoin_npk_15_15_15_t: b.besoin_npk_15_15_15_t,
        besoin_npk_15_10_10_t: b.besoin_npk_15_10_10_t, besoin_npk_6_20_10_t: b.besoin_npk_6_20_10_t,
        libelle_npk_15_15_15: b.libelle_npk_15_15_15, libelle_npk_15_10_10: b.libelle_npk_15_10_10, libelle_npk_6_20_10: b.libelle_npk_6_20_10,
        libelle_uree: b.libelle_uree, libelle_dap: b.libelle_dap, libelle_fumier: b.libelle_fumier,
        source_reference_engrais: b.source_reference_engrais, source_reference_semis: b.source_reference_semis,
        besoin_uree_t: b.besoin_uree_t, besoin_dap_t: b.besoin_dap_t, besoin_fumier_t: b.besoin_fumier_t,
        besoin_semences_applicable: Boolean(b.besoin_semences_applicable), besoin_semences_retenu_t: b.besoin_semences_retenu_t,
        statut_validation_engrais: b.statut_validation_engrais ?? 'A_COMPLETER',
        statut_validation_semis: b.statut_validation_semis ?? 'A_COMPLETER',
        niveau_source_potentiel: 'ZONE',
        rendement_moyen_kg_ha: moyen, rendement_atteignable_kg_ha: atteignable,
        ecart_rendement_kg_ha: atteignable - moyen, potentiel_evalue: true, potentiel_gain_kg_ha: atteignable - moyen,
        meilleur_niveau_adequation: meilleur,
        proba_cycle_couvert_moyen_pct: probas.length ? arrondi(probas.reduce((a, x) => a + x, 0) / probas.length, 1) : null,
        facteur_limitant_principal: FACTEURS[Math.floor(rz() * FACTEURS.length)],
        proba_saison_seche_pct: v.proba_saison_seche_pct,
        classe_texture: ['sableuse', 'sablo-limoneuse', 'limono-argileuse', 'argileuse'][Math.floor(rd() * 4)],
        ph_eau: arrondi(5.4 + 1.8 * rd(), 1),
        reserve_utile_mm: Math.round(40 + 90 * rd()),
        carbone_organique_g_kg: arrondi(2 + 8 * rd(), 1),
        amendement_ph_recommande: rz() < 0.3,
        fractionnement_azote_recommande: rz() < 0.6,
        score_vulnerabilite: v.score_vulnerabilite, classe_vulnerabilite: v.classe_vulnerabilite,
        score_alea_secheresse: v.score_alea_secheresse, confiance_rendement: v.confiance_rendement,
        methode_version_vulnerabilite: 'v1',
        part_cultures_pct: v.part_cultures_pct,
      }
    })
  return territoiresCache
}

export { ZONES }
