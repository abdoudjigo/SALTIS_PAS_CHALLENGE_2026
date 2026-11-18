// Fiabilité des modèles, en phrases : tirée de /previsions/fiabilite (ML.EVALUATION_MODELES).
// Chaque modèle est comparé à une prévision simple ; on dit le gain tel qu'il est mesuré, sans l'arrondir vers le haut.
import { libelle, nombre } from '../lib/format'
import type { CodeModele, EvaluationModele, Moment } from '../types/previsions'
import { MOMENTS, type PrevisionSaison } from '../types/previsions'

export const MODELES: Record<CodeModele, { nom: string; fiabilite: string }> = {
  M1: { nom: 'Modèle 1, prévision de la saison', fiabilite: 'fiabilité modeste' },
  M3: { nom: 'Modèle 3, rendement', fiabilite: 'fiabilité faible' },
  M4: { nom: 'Modèle 4, date de semis', fiabilite: 'seuils à valider avec les agronomes' },
}

export interface Cible {
  modele: CodeModele
  moment?: Moment
  culture?: string | null
  /** modèle 3 : ne parler que de l'alerte, ou que du rendement */
  volet?: 'alerte' | 'rendement'
  /** modèle 1 : année prévue par la tendance, pas par l'océan */
  tendance?: boolean
}

const d2 = (v: number | null | undefined) => nombre(v, { decimales: 2, signe: true })
const p0 = (v: number | null | undefined) => nombre(v, { unite: '%' })
export const nomMoment = (m: Moment) => MOMENTS.find((x) => x.id === m)?.libelle ?? m

export function phrasesFiabilite(lignes: EvaluationModele[], { modele, moment, culture, volet, tendance }: Cible): string[] {
  const test = lignes.filter((l) => l.modele === modele && l.periode.startsWith('test'))
  const periode = test[0]?.periode.replace('test ', '') ?? ''
  const v = (mesure: string, filtre: (l: EvaluationModele) => boolean = () => true) => test.find((l) => l.mesure === mesure && filtre(l))?.valeur ?? null

  if (modele === 'M1' && tendance) {
    const t = lignes.filter((l) => l.modele === 'M1' && l.periode.startsWith('tendance'))
    const [erreur, normale] = [t.find((l) => l.mesure === 'rmse_modele_mm')?.valeur ?? null, t.find((l) => l.mesure === 'rmse_normale_mm')?.valeur ?? null]
    return [
      'Prévision de tendance : la moyenne des 15 dernières saisons, sans connaître encore l’océan de l’année. Elle sera remplacée par la prévision océan dès la fin mai de l’année visée.',
      erreur !== null && normale !== null ? `Erreur mesurée sur 2016-2025 : ${nombre(erreur)} mm, contre ${nombre(normale)} mm en prenant la normale 1991-2020.` : null,
    ].filter((x): x is string => x !== null)
  }

  if (modele === 'M1') {
    const [juste, clim, fourchette, rpss] = [v('classe_juste_pct'), v('classe_juste_climatologie_pct'), v('fourchette_contient_observe_pct'), v('rpss_vs_climatologie')]
    return [
      juste !== null && clim !== null ? `Sur ${periode}, la classe la plus probable était la bonne ${p0(juste)} des fois, contre ${p0(clim)} en se fiant aux années passées : le gain est modeste.` : null,
      fourchette !== null ? `La pluie tombée était dans la fourchette ${p0(fourchette)} des fois (attendu : 80 %).` : null,
      rpss !== null ? `Score de gain sur la climatologie (RPSS) : ${d2(rpss)} ; 0 = pas mieux, 1 = parfait.` : null,
    ].filter((x): x is string => x !== null)
  }

  if (modele === 'M3') {
    const ici = (l: EvaluationModele) => l.moment === (moment ?? 'FIN_JUILLET') && l.culture === (culture ?? 'TOUTES')
    const [auc, fiable, gain, fourchette] = [v('auc_modele', ici), v('alerte_fiable', ici), v('gain_mae_vs_tendance_pct', ici), v('fourchette_contient_observe_pct', ici)]
    const quoi = `${culture ? libelle(culture) : 'Toutes cultures'}, ${nomMoment(moment ?? 'FIN_JUILLET')}`
    return [
      auc !== null && volet !== 'rendement' ? `${quoi}, sur ${periode} : l'alerte classe les départements avec un score de ${nombre(auc, { decimales: 2 })} (0,5 = au hasard, 1 = parfait)${fiable === null ? '' : fiable ? ' ; elle fait mieux que la fréquence passée.' : ' ; elle ne fait pas mieux que la fréquence passée.'}` : null,
      gain !== null && volet !== 'alerte' ? `Rendement (${quoi.toLowerCase()}) : erreur ${gain > 0 ? 'réduite' : 'augmentée'} de ${nombre(Math.abs(gain), { decimales: 1, unite: '%' })} par rapport au rendement habituel${fourchette === null ? '' : ` ; le rendement observé était dans la fourchette ${p0(fourchette)} des fois`}.` : null,
    ].filter((x): x is string => x !== null)
  }

  const un = (risque: string) => {
    const [auc, ref] = [v('auc_modele', (l) => l.risque === risque), v('auc_reference', (l) => l.risque === risque)]
    return auc === null || ref === null ? null : `${risque} : ${nombre(auc, { decimales: 2 })} contre ${nombre(ref, { decimales: 2 })} pour la fréquence passée`
  }
  const liste = ['faux départ', 'fin trop tôt'].map(un).filter((x): x is string => x !== null)
  return liste.length
    ? [`Capacité à reconnaître les semis à risque, sur ${periode} (0,5 = au hasard, 1 = parfait). ${libelle(liste.join(' ; '))}.`,
      'Le gain porte sur le faux départ. Pour la fin de saison, un score élevé est facile à obtenir (semer en juin ou en août change tout) : il prouve peu.']
    : []
}

// Les rappels de l'API parlent aux développeurs : on traduit les codes, on écarte les consignes de routage.
const CODES: [RegExp, string][] = [
  [/FIN_MAI/g, 'fin mai'], [/FIN_JUIN/g, 'fin juin'], [/FIN_JUILLET/g, 'fin juillet'], [/FIN_AOUT/g, 'fin août'],
  [/PROJECTION_NON_EVALUEE \(2022-2025\) : invérifiable/g, 'Projections depuis 2022 : invérifiables (pas de récolte observée comparable)'],
  [/PROJECTION_NON_EVALUEE/g, 'projection non vérifiable'],
  [/alerte_fiable ou rendement_fiable est vrai/g, "c'est signalé « prévision de l'année »"],
  [/alerte_fiable est vrai/g, "c'est signalé"],
]
export const rappelsLisibles = (avertissements: string[]) =>
  avertissements.filter((a) => !a.includes('/previsions')).map((a) => {
    const texte = CODES.reduce((t, [code, clair]) => t.replace(code, clair), a)
    return texte.charAt(0).toLocaleUpperCase('fr-FR') + texte.slice(1)
  })

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const FINS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
/** Une décade de l'année (1 à 36) en dates : la décade 20 va du 11 au 20 juillet. */
export function datesDecade(decade: number) {
  const mois = Math.floor((decade - 1) / 3)
  const rang = (decade - 1) % 3
  return { mois, debut: [1, 11, 21][rang], fin: rang === 2 ? FINS[mois] : [10, 20][rang] }
}
const jour = (j: number) => (j === 1 ? '1er' : String(j))
/** « du 11 au 20 juillet », ou « du 21 juin au 10 juillet » d'une décade à une autre. */
export function periodeDecades(de: number, a: number = de, court = false) {
  const [d, f] = [datesDecade(de), datesDecade(a)]
  const noms = court ? MOIS_COURTS : MOIS_LONGS
  return d.mois === f.mois ? `du ${jour(d.debut)} au ${f.fin} ${noms[f.mois]}` : `du ${jour(d.debut)} ${noms[d.mois]} au ${f.fin} ${noms[f.mois]}`
}
export const debutDecade = (decade: number, court = false) => `${jour(datesDecade(decade).debut)} ${(court ? MOIS_COURTS : MOIS_LONGS)[datesDecade(decade).mois]}`

/**
 * La nature d'une année, en une ligne : prévision océan, prévision de tendance, ou année passée (vérification).
 * `saison` : la ligne du modèle 1 du département, pour dire « prévu X mm, tombé Y mm ».
 */
export function natureAnnee(annee: number, aVenir: number, saison?: PrevisionSaison | null) {
  if (annee === aVenir) return `Prévision océan (fin mai ${annee})`
  if (annee > aVenir) return `Prévision de tendance : sera précisée fin mai ${annee}`
  if (!saison || saison.annee !== annee) return 'Année passée : vérification'
  return `Année passée : vérification, prévu ${nombre(saison.pluie_prevue_mm)} mm / tombé ${saison.pluie_observee_mm === null ? 'non disponible' : `${nombre(saison.pluie_observee_mm)} mm`}`
}
