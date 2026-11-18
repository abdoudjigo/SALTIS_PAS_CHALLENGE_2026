// Prévisions et carte des opportunités SYNTHÉTIQUES, pour le seul mode démonstration (config.donneesDemo).
// Déterministes (même graine, même réponse), avec les formats exacts de types/previsions.ts et de CarteOpportunite.
// Ordres de grandeur du Sénégal (gradient nord-sud de `climat`), valeurs NON réelles : chaque réponse le dit.
import type { CarteOpportunite, CategorieEau, Departement } from '../../types/marts'
import type {
  Classe3, EvaluationModele, Moment, Prevision, PrevisionRendement, PrevisionSaison, RisqueSemis,
} from '../../types/previsions'
import { CULTURES_RENDEMENT, MOMENTS } from '../../types/previsions'
import { ApiError } from '../client'
import { arrondi, borne, CAMPAGNES, carteAgroclimat, choixCultures, climat, CYCLES, entete, gauss, libelleDecade, rng } from './generateurs'
import { CULTURES, CULTURES_IRRIGUEES, DEPARTEMENTS, VARIETES } from './referentiel'

export const AVERTISSEMENT_DEMO = 'Données de démonstration synthétiques : elles illustrent la plateforme et ne servent pas à décider.'

const A_VENIR = CAMPAGNES[CAMPAGNES.length - 1] + 1 // 2026 : prévision océan
const DERNIERE = 2035
const TRACE = (modele: string) => ({ version_modele: `${modele}-demo`, date_calcul: `${A_VENIR}-05-31` })
const reponse = <T,>(donnees: T[], avertissements: string[] = []): Prevision<T> => ({ donnees, avertissements: [AVERTISSEMENT_DEMO, ...avertissements], source: 'démonstration' })
const introuvable = (code: string, message: string) => new ApiError(message, { status: 404, details: { erreur: { code, message } } })
const dep = (code: string) => {
  const d = DEPARTEMENTS.find((x) => x.code_departement === code)
  if (!d) throw introuvable('departement_inconnu', `Département ${code} inconnu.`)
  return d
}
const SANS_RENDEMENT = ['Guédiawaye', 'Pikine']

// --- Modèle 1 : la saison --------------------------------------------------------------------------
/** Probabilités entières qui font 100. */
function cent(poids: number[]): number[] {
  const total = poids.reduce((a, b) => a + b, 0)
  const brut = poids.map((p) => (p / total) * 100)
  const entiers = brut.map(Math.floor)
  const reste = 100 - entiers.reduce((a, b) => a + b, 0)
  brut.map((v, i) => [v - entiers[i], i]).sort((a, b) => b[0] - a[0]).slice(0, reste).forEach(([, i]) => entiers[i]++)
  return entiers
}
const CLASSES: Classe3[] = ['sèche', 'normale', 'humide']
const FACTEUR: Record<Classe3, number> = { 'sèche': 0.8, normale: 1, humide: 1.15 }

/** Les trois probabilités d'une année : les mêmes dans tout le pays (elles viennent de l'océan). */
function probasAnnee(annee: number): number[] {
  if (annee === A_VENIR) return [25, 45, 30]
  const r = rng(`m1-probas${annee}`)
  if (annee > A_VENIR) return cent([33 + gauss(r) * 1.5, 34 + gauss(r) * 1.5, 33 + gauss(r) * 1.5])
  // Année passée : un signal un peu meilleur que le hasard (même tirage que la pluie observée)
  const spi = carteAgroclimat(annee).reduce((s, l) => s + (l.spi_saison ?? 0), 0) / DEPARTEMENTS.length
  const s = 0.45 * spi + 0.8 * gauss(r)
  return cent([Math.exp(-1.1 * s), Math.exp(0.35), Math.exp(1.1 * s)])
}
const classeDe = (p: number[]) => CLASSES[p.indexOf(Math.max(...p))]
const classeObservee = (spi: number | null): Classe3 | null => (spi === null ? null : spi < -0.43 ? 'sèche' : spi > 0.43 ? 'humide' : 'normale')
const typeSaison = (annee: number): PrevisionSaison['type_prevision'] =>
  annee <= 2015 ? 'RETROSPECTIVE_VALIDATION' : annee < A_VENIR ? 'RETROSPECTIVE_TEST' : annee === A_VENIR ? 'PREVISION_OCEAN' : 'PREVISION_TENDANCE'

function exigerAnnee(annee: number, annees: number[], modele: string) {
  if (!annees.includes(annee)) throw introuvable('annee_inconnue', `Année ${annee} absente du ${modele}.`)
}
const ANNEES_M1 = [...CAMPAGNES, ...Array.from({ length: DERNIERE - A_VENIR + 1 }, (_, i) => A_VENIR + i)]

const saisonCache = new Map<number, PrevisionSaison[]>()
function saisons(annee: number): PrevisionSaison[] {
  exigerAnnee(annee, ANNEES_M1, 'modèle 1')
  const enCache = saisonCache.get(annee)
  if (enCache) return enCache
  const p = probasAnnee(annee)
  const classe = classeDe(p)
  const passee = annee < A_VENIR
  const observees = passee ? new Map(carteAgroclimat(annee).map((l) => [l.code_departement, l])) : null
  const lignes = DEPARTEMENTS.map((d): PrevisionSaison => {
    const c = climat(d)
    const r = rng(`m1${d.code_departement}${annee}`)
    // Pluie attendue : facteur de chaque classe pondéré par sa probabilité (une tendance à 34/33/33 reste proche de la normale)
    const facteur = (p[0] * FACTEUR['sèche'] + p[1] * FACTEUR.normale + p[2] * FACTEUR.humide) / 100
    const prevue = Math.round(c.normale * facteur * (1 + 0.03 * gauss(r)))
    const demi = 1.28 * c.cv * c.normale
    const o = observees?.get(d.code_departement)
    return {
      ...entete(d), ...TRACE('m1'), annee, type_prevision: typeSaison(annee),
      proba_seche_pct: p[0], proba_normale_pct: p[1], proba_humide_pct: p[2], classe_prevue: classe,
      pluie_prevue_mm: prevue, pluie_basse_mm: Math.max(20, Math.round(prevue - demi)), pluie_haute_mm: Math.round(prevue + demi),
      pluie_normale_mm: c.normale,
      pluie_observee_mm: o?.pluie_saison_mm ?? null,
      classe_observee: o ? classeObservee(o.spi_saison) : null,
    }
  })
  saisonCache.set(annee, lignes)
  return lignes
}

// --- Modèle 3 : le rendement -----------------------------------------------------------------------
/** Rendement habituel (kg/ha) du nord au sud : [nord, sud]. */
const RENDEMENT: Record<string, [number, number]> = {
  ARACHIDE: [700, 1100], 'MIL (SOUNA)': [500, 900], SORGHO: [600, 1000], 'NIÉBÉ': [350, 650], 'MAÏS': [1000, 2500],
}
const ANNEES_M3 = ANNEES_M1.filter((a) => a >= 2001 && (a <= 2015 || a >= 2022))
const typeRendement = (annee: number): PrevisionRendement['type_prevision'] =>
  annee <= 2010 ? 'RETROSPECTIVE_VALIDATION' : annee <= 2015 ? 'RETROSPECTIVE_TEST' : 'PROJECTION_NON_EVALUEE'

function rendements(d: Departement, annee: number): PrevisionRendement[] {
  exigerAnnee(annee, ANNEES_M3, 'modèle 3')
  if (SANS_RENDEMENT.includes(d.departement)) return []
  const c = climat(d)
  return CULTURES_RENDEMENT.flatMap((culture) => {
    const [nord, sud] = RENDEMENT[culture]
    const r = rng(`m3${d.code_departement}${culture}`)
    const tendance = Math.round((sud + (nord - sud) * c.nord) * (1 + 0.06 * gauss(r)))
    const ra = rng(`m3${d.code_departement}${culture}${annee}`)
    const evaluee = annee <= 2015
    const observe = evaluee ? Math.round(tendance * (1 + 0.2 * gauss(ra))) : null
    return MOMENTS.map(({ id }, k): PrevisionRendement => {
      // Plus la saison avance, plus la fourchette se resserre (sans jamais passer sous ± 22 %)
      const ecart = 0.3 - 0.025 * k
      const median = Math.round(tendance * (1 + 0.04 * gauss(ra)))
      const chute = arrondi(borne(22 + 9 * c.nord + 8 * gauss(ra), 4, 70), 1)
      return {
        ...entete(d), ...TRACE('m3'), culture, annee, moment_prevision: id as Moment, type_prevision: typeRendement(annee),
        tendance_kg_ha: tendance,
        rendement_bas_kg_ha: Math.round(median * (1 - ecart)), rendement_median_kg_ha: median, rendement_haut_kg_ha: Math.round(median * (1 + ecart)),
        proba_chute_pct: chute, proba_chute_reference_pct: arrondi(20 + 8 * c.nord, 1),
        explication: k === 0 ? null : chute > 35 ? 'pluie du début de saison en dessous de la normale' : null,
        // Honnête : le modèle ne bat presque jamais le rendement habituel
        rendement_fiable: evaluee && k === 3 && ra() < 0.15,
        alerte_fiable: k >= 2 && ra() < 0.5,
        rendement_observe_kg_ha: observe,
        chute_observee: observe === null ? null : observe < 0.8 * tendance,
      }
    })
  })
}

// --- Modèle 4 : la date de semis --------------------------------------------------------------------
/** Les 8 cultures pluviales du modèle 4, avec leur cycle moyen. */
const CULTURES_M4 = CULTURES.filter((c) => !CULTURES_IRRIGUEES.includes(c) && c !== 'MANIOC').slice(0, 8)
const ANNEES_M4 = ANNEES_M1.filter((a) => a >= 2016)
const typeSemis = (annee: number | null): RisqueSemis['type_prevision'] =>
  annee === null ? 'ANNEE_TYPE' : annee < A_VENIR ? 'RETROSPECTIVE_TEST' : annee === A_VENIR ? 'PREVISION_OCEAN' : 'PREVISION_TENDANCE'

function semis(d: Departement, annee: number | null, culture?: string | null): RisqueSemis[] {
  if (annee !== null) exigerAnnee(annee, ANNEES_M4, 'modèle 4')
  if (culture && !CULTURES_M4.includes(culture)) throw introuvable('culture_non_modelisee', `« ${culture} » n'est pas couverte par le modèle 4.`)
  const c = climat(d)
  // Démarrage et fin de la saison : observés pour une année passée, attendus sinon (une saison sèche démarre plus tard)
  const observee = annee !== null && annee < A_VENIR ? carteAgroclimat(annee).find((l) => l.code_departement === d.code_departement) : undefined
  const classe = annee === null ? 'normale' : classeDe(probasAnnee(annee))
  const decalage = classe === 'sèche' ? 5 : classe === 'humide' ? -3 : 0
  const debut = observee?.debut_saison_jour ?? c.debut + decalage
  const fin = observee?.fin_saison_jour ?? c.debut + c.duree - decalage
  const installation = debut / 10 - 0.8 + 0.9 * c.nord
  const finDecade = (fin + 30 + 10 * c.nord) / 10
  const probaSeche = annee === null ? null : probasAnnee(annee)[0]
  const disponibles = choixCultures(d.code_departement)
  return CULTURES_M4.filter((x) => !culture || x === culture).flatMap((cult) => {
    if (!disponibles.some((o) => o.culture === cult)) return []
    const cycle = CYCLES[cult][1]
    const r = rng(`m4${d.code_departement}${cult}${annee ?? 'type'}`)
    const pente = 0.6 * (cycle / 100) * (1 + 0.4 * c.nord) * 1.6
    const lignes = Array.from({ length: 8 }, (_, i): RisqueSemis => {
      const decade = 16 + i
      const fauxDepart = 3 + 62 / (1 + Math.exp((decade - installation) * 1.5))
      const finTropTot = 3 + 90 / (1 + Math.exp(-(decade + cycle / 10 - finDecade) * pente))
      const chance = borne(100 / (1 + Math.exp(-(decade - installation + 1) * 1.4)), 5, 98)
      const bruit = 1 + 0.04 * gauss(r)
      return {
        ...entete(d), ...TRACE('m4'), annee, type_prevision: typeSemis(annee), culture: cult, cycle_jours: cycle,
        decade_semis: decade, libelle_decade: libelleDecade(decade),
        chance_pluie_semis_pct: arrondi(chance, 1),
        risque_faux_depart_pct: arrondi(borne(fauxDepart * bruit, 0, 100), 1),
        risque_fin_trop_tot_pct: arrondi(borne(finTropTot * bruit, 0, 100), 1),
        risque_total_pct: arrondi(borne(100 * (1 - (1 - fauxDepart / 100) * (1 - finTropTot / 100)) * bruit, 0, 100), 1),
        decade_conseillee: false,
        proba_saison_seche_m1_pct: probaSeche,
      }
    })
    // Une seule décade conseillée : le risque le plus bas, là où une pluie de semis arrive au moins une année sur deux
    const candidates = lignes.filter((l) => (l.chance_pluie_semis_pct ?? 0) >= 50)
    const meilleure = candidates.sort((a, b) => a.risque_total_pct! - b.risque_total_pct!)[0]
    if (meilleure) meilleure.decade_conseillee = true
    return lignes
  })
}

// --- Fiabilité ---------------------------------------------------------------------------------------
function fiabilite(modele: string | undefined): EvaluationModele[] {
  const ligne = (m: 'M1' | 'M3' | 'M4', periode: string, mesure: string, valeur: number, plus: Partial<EvaluationModele> = {}): EvaluationModele =>
    ({ modele: m, version_modele: `${m.toLowerCase()}-demo`, periode, moment: null, culture: null, risque: null, variables: null, mesure, valeur, ...plus })
  const m1 = [
    ligne('M1', 'test 2016-2025', 'classe_juste_pct', 46), ligne('M1', 'test 2016-2025', 'classe_juste_climatologie_pct', 38),
    ligne('M1', 'test 2016-2025', 'fourchette_contient_observe_pct', 78), ligne('M1', 'test 2016-2025', 'rpss_vs_climatologie', 0.06),
    ligne('M1', 'tendance 2016-2025', 'rmse_modele_mm', 119), ligne('M1', 'tendance 2016-2025', 'rmse_normale_mm', 122),
  ]
  const m3 = MOMENTS.flatMap(({ id }, k) => ['TOUTES', ...CULTURES_RENDEMENT].flatMap((culture, j) => {
    const plus = { moment: id, culture }
    return [
      ligne('M3', 'test 2011-2015', 'auc_modele', arrondi(0.56 + 0.03 * k + 0.01 * (j % 3), 2), plus),
      ligne('M3', 'test 2011-2015', 'alerte_fiable', k >= 2 && j % 2 === 0 ? 1 : 0, plus),
      ligne('M3', 'test 2011-2015', 'gain_mae_vs_tendance_pct', arrondi(-2.5 + 1.2 * k - 0.4 * j, 1), plus),
      ligne('M3', 'test 2011-2015', 'fourchette_contient_observe_pct', 74 + k, plus),
    ]
  }))
  const m4 = [
    ligne('M4', 'test 2016-2025', 'auc_modele', 0.68, { risque: 'faux départ' }), ligne('M4', 'test 2016-2025', 'auc_reference', 0.61, { risque: 'faux départ' }),
    ligne('M4', 'test 2016-2025', 'auc_modele', 0.86, { risque: 'fin trop tôt' }), ligne('M4', 'test 2016-2025', 'auc_reference', 0.84, { risque: 'fin trop tôt' }),
  ]
  return modele === 'M1' ? m1 : modele === 'M3' ? m3 : modele === 'M4' ? m4 : [...m1, ...m3, ...m4]
}

// --- Carte des opportunités ------------------------------------------------------------------------
// Même règle que le mart : vert si la durée de saison atteinte 4 années sur 5 dépasse 110 jours, jaune sinon ;
// bleu par-dessus là où une eau mobilisable est (ici, fictivement) identifiée.
const SEUIL_SAISON_LONGUE_J = 110
type Eau = { categorie: CategorieEau; ha?: number }
const EAU: Record<string, Eau> = {
  Podor: { categorie: 'eau de surface peu exploitée', ha: 2400 }, Matam: { categorie: 'eau de surface peu exploitée', ha: 1500 },
  Bakel: { categorie: 'eau de surface peu exploitée', ha: 650 }, Dagana: { categorie: 'eau de surface déjà exploitée' },
  Kanel: { categorie: 'eau de surface déjà exploitée' }, Sédhiou: { categorie: 'eau de surface peu exploitée', ha: 900 },
  Bignona: { categorie: 'eau de surface peu exploitée', ha: 420 }, Rufisque: { categorie: 'nappe accessible' },
  Kébémer: { categorie: 'nappe accessible' }, Louga: { categorie: 'nappe accessible' }, Pikine: { categorie: 'nappe accessible' },
}
const CONSEIL_EAU: Partial<Record<CategorieEau, string>> = {
  'eau de surface peu exploitée': "De l'eau reste disponible en saison sèche près de chez vous et peu de terres l'utilisent : maraîchage ou riz de contre-saison.",
  'nappe accessible': 'La nappe est proche (7 à 25 m) : un puits ou un petit forage permet un maraîchage de contre-saison.',
}

let opportunitesCache: CarteOpportunite[] | undefined
function opportunites(): CarteOpportunite[] {
  if (opportunitesCache) return opportunitesCache
  const bleus = DEPARTEMENTS.filter((d) => EAU[d.departement] && CONSEIL_EAU[EAU[d.departement].categorie])
    .sort((a, b) => (EAU[b.departement].ha ?? 0) - (EAU[a.departement].ha ?? 0))
  opportunitesCache = DEPARTEMENTS.map((d): CarteOpportunite => {
    const c = climat(d)
    const r = rng(`opp${d.code_departement}`)
    const courte = Math.round(c.duree * 0.85)
    const fond = courte >= SEUIL_SAISON_LONGUE_J ? 'vert' : 'jaune'
    const cycleMax = Math.round((courte + 20) / 5) * 5
    const varietes = VARIETES.filter((v) => v.cycle_jours !== null && v.cycle_jours <= cycleMax && v.variete !== 'Sahel 177')
    const longues = CULTURES.filter((x) => !CULTURES_IRRIGUEES.includes(x) && x !== 'MANIOC' && CYCLES[x][2] <= cycleMax)
    const eau = EAU[d.departement] ?? { categorie: "pas d'eau mobilisable identifiée" }
    const bleu = Boolean(CONSEIL_EAU[eau.categorie])
    const surface = eau.categorie.startsWith('eau de surface')
    const cultivable = surface ? Math.round((eau.ha ?? 300 + 700 * r()) * (1.6 + r())) : null
    const conseilPluie = fond === 'vert'
      ? `Saison des pluies longue : des semences à cycle long, jusqu'à ${cycleMax} jours, passent 4 années sur 5.`
      : `Saison des pluies courte : choisissez des semences à cycle court, ${cycleMax} jours au plus.`
    return {
      ...entete(d), zone_secondaire: d.zone_secondaire ?? null, latitude: d.latitude, longitude: d.longitude,
      couleur_carte: bleu ? 'bleu' : fond, couleur_fond: fond, couche_eau: bleu,
      classe_saison_pluie: fond === 'vert' ? 'longue' : 'courte', cycle_max_conseille_j: cycleMax,
      cultures_cycle_long: longues.length ? longues.join(', ') : null,
      varietes_conseillees: varietes.length ? varietes.map((v) => `${v.culture} : ${v.variete} (${v.cycle_jours} j)`).join(' ; ') : null,
      nb_varietes_conseillees: varietes.length,
      pluie_saison_normale_mm: c.normale, duree_saison_moyenne_j: c.duree, duree_saison_courte_j: courte,
      categorie_eau: eau.categorie,
      potentiel_contre_saison_ha: eau.categorie === 'eau de surface peu exploitée' ? eau.ha ?? null : null,
      rang_opportunite_eau: bleu ? bleus.indexOf(d) + 1 : null,
      surface_eau_permanente_ha: surface ? Math.round((cultivable ?? 0) * (0.3 + 0.2 * r())) : null,
      surface_proche_eau_cultivable_ha: cultivable,
      surface_proche_eau_inexploitee_ha: eau.categorie === 'eau de surface peu exploitée' ? eau.ha ?? null : surface && cultivable ? Math.round(cultivable * 0.25) : null,
      part_proche_eau_exploitee_pct: surface && cultivable ? arrondi(eau.categorie === 'eau de surface peu exploitée' ? 100 * (1 - (eau.ha ?? 0) / cultivable) : 65 + 15 * r(), 1) : null,
      profondeur_classe_dominante: eau.categorie === 'nappe accessible' ? '7-25 m' : null,
      productivite_classe_dominante: eau.categorie === 'nappe accessible' ? '1-5 L/s' : null,
      part_nappe_accessible_pct: eau.categorie === 'nappe accessible' ? arrondi(35 + 25 * r(), 1) : null,
      surface_equipee_irrigation_ha: surface ? Math.round(800 + 6000 * r()) : null,
      conseil_agriculteur: bleu ? CONSEIL_EAU[eau.categorie]! : conseilPluie,
      conseil_investisseur: bleu ? `Aménagement possible : environ ${Math.round(eau.ha ?? 300)} ha à mettre en valeur (données de démonstration).` : null,
    }
  })
  return opportunitesCache
}

// --- Routes du faux serveur ---------------------------------------------------------------------------
type Params = Record<string, unknown>
const anneeParam = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))

export const routesSynthetiques: [string, RegExp, (a: { m: RegExpMatchArray; params: Params }) => unknown][] = [
  ['GET', /^\/previsions\/saison\/(\d+)$/, ({ m }) => reponse(saisons(Number(m[1])), Number(m[1]) > A_VENIR ? ['Prévision de tendance : moyenne des 15 dernières saisons.'] : [])],
  ['GET', /^\/previsions\/rendement\/([^/]+)\/(\d+)$/, ({ m }) => reponse(rendements(dep(decodeURIComponent(m[1])), Number(m[2])))],
  ['GET', /^\/previsions\/alerte-recolte\/(\d+)$/, ({ m, params }) => reponse(DEPARTEMENTS.flatMap((d) => rendements(d, Number(m[1])))
    .filter((l) => (!params.moment || l.moment_prevision === params.moment) && (!params.culture || l.culture === params.culture)))],
  ['GET', /^\/previsions\/semis\/departements\/([^/]+)$/, ({ m, params }) => reponse(semis(dep(decodeURIComponent(m[1])), anneeParam(params.annee), params.culture as string | undefined))],
  ['GET', /^\/previsions\/semis\/carte$/, ({ params }) => reponse(DEPARTEMENTS.flatMap((d) => semis(d, anneeParam(params.annee), params.culture as string | undefined).filter((l) => l.decade_conseillee)))],
  ['GET', /^\/previsions\/fiabilite$/, ({ params }) => reponse(fiabilite(params.modele as string | undefined))],
  ['GET', /^\/opportunites$/, () => opportunites()],
  ['GET', /^\/opportunites\/([^/]+)$/, ({ m }) => {
    const ligne = opportunites().find((o) => o.code_departement === decodeURIComponent(m[1]))
    if (!ligne) throw introuvable('departement_inconnu', 'Département inconnu.')
    return ligne
  }],
]
