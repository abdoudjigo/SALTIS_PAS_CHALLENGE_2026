// « Ce qu'il faut retenir » : trois phrases à partir des chiffres affichés, par gabarits fixes (aucun modèle de langage).
// Une phrase dont une donnée manque est omise ; un total partiel le dit.
import { nombre } from '../lib/format'
import type { ClassementObs, Indicateur, IndicateursObs } from './types'

const UNITE: Record<Indicateur, string> = { production: 't', surface: 'ha', rendement: 'kg/ha' }
const NOM: Record<Indicateur, string> = { production: 'la production', surface: 'la superficie', rendement: 'le rendement' }

function partiel(i: { est_complet: boolean | null; nb_departements_observes: number | null; nb_departements_attendus: number | null }) {
  if (i.est_complet !== false || i.nb_departements_observes === null || i.nb_departements_attendus === null) return ''
  return ` (total partiel : ${i.nb_departements_observes} départements sur ${i.nb_departements_attendus})`
}

const pourcent = (v: number) => nombre(Math.abs(v), { decimales: 0, unite: '%' })

export function phrasesARetenir({ indicateurs, classement, indicateurClassement, culture, zone }: {
  indicateurs: IndicateursObs | null | undefined
  classement: ClassementObs[] | null | undefined
  indicateurClassement: Indicateur
  /** nom court en minuscules (« mil ») */
  culture: string
  /** nom de la zone affichée (« Sénégal », « Kaffrine ») */
  zone: string
}): string[] {
  const phrases: string[] = []
  const de = (i: Indicateur) => indicateurs?.indicateurs.find((x) => x.indicateur === i)
  const an = indicateurs?.annee

  const prod = de('production')
  if (an && prod && prod.valeur !== null && prod.variation_n1_pct !== null) {
    const sens = prod.variation_n1_pct >= 0 ? 'en hausse' : 'en baisse'
    const prudence = prod.comparable_n1 === false ? ', comparaison indicative car la couverture ou la définition change' : ''
    phrases.push(`En ${an}, la production de ${culture} (${zone}) est de ${nombre(prod.valeur, { unite: 't' })}${partiel(prod)}, ${sens} de ${pourcent(prod.variation_n1_pct)} sur un an${prudence}.`)
  }

  const rdt = de('rendement')
  if (an && rdt && rdt.valeur !== null && rdt.ecart_moyenne_10_ans_pct !== null && rdt.nb_annees_moyenne) {
    const sens = rdt.ecart_moyenne_10_ans_pct >= 0 ? 'au-dessus' : 'au-dessous'
    phrases.push(`Le rendement, ${nombre(rdt.valeur, { unite: 'kg/ha' })}, est ${pourcent(rdt.ecart_moyenne_10_ans_pct)} ${sens} de la moyenne des ${rdt.nb_annees_moyenne} années précédentes disponibles.`)
  }

  const ref = de(indicateurClassement)
  if (an && indicateurs?.niveau !== 'PAYS' && ref && ref.rang !== null && ref.nb_classes !== null) {
    const unite = indicateurs?.niveau === 'REGION' ? 'régions' : 'départements'
    const part = ref.part_nationale_pct !== null ? `, soit ${nombre(ref.part_nationale_pct, { decimales: 1, unite: '%' })} du total national` : ''
    phrases.push(`Pour ${NOM[indicateurClassement]}, ${zone} se classe ${ref.rang === 1 ? '1er' : `${ref.rang}e`} sur ${ref.nb_classes} ${unite} en ${an}${part}.`)
  } else if (an && indicateurs?.niveau === 'PAYS' && classement && classement.length > 0) {
    const tete = classement[0]
    phrases.push(`Pour ${NOM[indicateurClassement]}, ${tete.departement} arrive en tête des départements en ${an}, avec ${nombre(tete.valeur, { unite: UNITE[indicateurClassement] })}.`)
  }

  return phrases.slice(0, 3)
}
