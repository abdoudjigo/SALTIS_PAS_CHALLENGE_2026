// Textes du guide vocal de l'ONG (bouton en tête du dock). Rien n'est lu sans un appui :
// premier appui = l'introduction, puis chaque appui explique l'étape ouverte et lit son résumé.
import type { ModeOng } from '../cadre'

export const INTRO_ONG = [
  'Bienvenue dans l’espace des organisations et des services de l’État d’Assaman et Suuf.',
  'Vous y voyez, pour les 45 départements du Sénégal, la situation de la campagne agricole.',
  'Sept étapes vous guident, dans la colonne de gauche : où agir en priorité, la pluie attendue, le risque de chute de récolte, les besoins en semences et en engrais avec leur budget, la répartition de votre stock, les zones à fort potentiel, puis le dossier à exporter en PDF.',
  'Touchez un département sur la carte : tout ce qui s’affiche le concerne. Le tableau de bord, en bas de la carte, donne les chiffres clés.',
  'Une valeur absente est écrite non disponible, jamais inventée.',
  'Ensuite, touchez-moi à chaque étape : je vous explique ce qu’elle montre.',
]

export const EXPLICATION_ONG: Record<ModeOng, string[]> = {
  campagne: [
    'Où agir en priorité.',
    'Cet écran croise quatre signaux pour chaque département : la phase du Cadre harmonisé, qui mesure l’insécurité alimentaire, le risque de chute de récolte, la pluie attendue et le niveau de fragilité.',
    'Les départements au rouge sont à regarder d’abord. Vous pouvez changer la vue de la carte : priorité, fragilité ou Cadre harmonisé.',
  ],
  saison: [
    'La saison qui vient.',
    'La carte montre la pluie attendue pour l’année choisie, comparée à la moyenne des 30 dernières années : plus sèche, normale ou plus humide.',
    'Une saison sèche annonce des besoins plus forts.',
  ],
  alerte: [
    'Alerte récolte.',
    'Cet écran montre les départements où la récolte risque de chuter de plus de 20 pour cent par rapport à l’habitude.',
    'Une alerte n’est affichée que si l’estimation est fiable ; sinon, c’est le risque habituel du département.',
  ],
  besoins: [
    'Besoins et budget.',
    'Pour la culture et le produit choisis, cet écran calcule les semences et les engrais nécessaires, en sacs et en tonnes, et leur coût en francs CFA au prix subventionné.',
    'Vous pouvez saisir votre propre prix d’achat. Une dose non confirmée est signalée.',
  ],
  repartir: [
    'Répartir et livrer.',
    'Indiquez votre stock : la plateforme propose une répartition entre départements selon trois scénarios, multicritère, urgence ou production, et la date limite de livraison avant les semis.',
    'La décision finale reste la vôtre.',
  ],
  potentiel: [
    'Fort potentiel.',
    'Cet écran repère les départements où l’eau permet de cultiver en saison sèche, et ceux où la récolte peut le plus progresser.',
    'Ce sont des repérages indicatifs, à vérifier sur le terrain.',
  ],
  exporter: [
    'Exporter le dossier.',
    'Ce bouton crée un rapport en PDF avec vos choix et les résultats de chaque étape, prêt à imprimer ou à partager.',
  ],
}

const CLE_INTRO = 'assaman.ong.intro.entendue'
export function introEntendue(): boolean {
  try {
    return localStorage.getItem(CLE_INTRO) === '1'
  } catch {
    return false
  }
}
export function marquerIntro() {
  try {
    localStorage.setItem(CLE_INTRO, '1')
  } catch {
    /* stockage indisponible : l'introduction sera reproposée à la prochaine visite */
  }
}
