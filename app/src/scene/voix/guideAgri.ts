// Textes du guide vocal de l'agriculteur (deux voix en tête du dock : français et wolof). Rien n'est lu sans appui :
// premier appui = l'introduction (message d'accueil de voiceMessages.ts, traduit à l'avance), puis chaque appui
// explique l'écran ouvert (français) et lit son résumé (français ou wolof, tel que l'écran le compose).
export const EXPLICATION_AGRI: Record<string, string[]> = {
  parcelle: [
    'Ma parcelle.',
    'Cet écran montre ce que l’on sait de votre champ : le sol, les risques de la saison, les cultures possibles et la campagne.',
    'Appuyez sur Me localiser, ou choisissez votre département.',
  ],
  saison: [
    'La saison qui vient.',
    'La carte montre la pluie attendue cette année dans votre département : plus sèche, normale ou plus humide que d’habitude, et combien de millimètres.',
  ],
  semer: [
    'Quelle culture.',
    'Cet écran classe les cultures adaptées à votre département, selon la pluie et la durée de la saison, avec leur cycle et la récolte attendue.',
  ],
  semis: [
    'Quand semer.',
    'Cet écran donne la période de semis la moins risquée, culture par culture.',
    'Semer trop tôt expose à un faux départ, quand la pluie s’arrête après les premières averses.',
  ],
  surface: [
    'Mes besoins.',
    'Indiquez votre culture et votre surface : la plateforme calcule les semences et les engrais nécessaires, et la récolte que vous pouvez en attendre.',
  ],
  contreSaison: [
    'Contre-saison.',
    'Cet écran montre l’eau disponible en saison sèche près de vos terres, et les cultures qu’elle permet.',
    'C’est un repérage indicatif, à vérifier sur place.',
  ],
}
