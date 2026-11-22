// Messages vocaux d'accueil des deux espaces (agriculteur, ONG et services de l'État).
// Ce fichier ne contient QUE des textes et des réglages : on peut le modifier sans toucher au code
// (le moteur est dans accueil.ts, le bandeau de sous-titres dans BandeauAccueil.tsx).
//
// À l'entrée — et chaque fois que l'agriculteur localise son champ — la voix lit le RÉSUMÉ RÉEL du premier écran (agriculteur : « Ma parcelle », en wolof ;
// ONG : « Où agir en priorité », en français), composé par l'écran avec ses vrais chiffres — le même texte que
// les mascottes FR et WLF. Ce fichier ne fournit que l'ENCADREMENT de ce résumé (une phrase avant, une après).
// Les MESSAGES plus bas ne servent qu'en secours : à l'entrée quand aucun champ n'est encore connu (ils
// invitent alors à se localiser ; le résumé suivra), ou quand le résumé ne vient pas.
//
// Règles d'écriture (le texte est dit à voix haute) :
// - 20 à 40 secondes : environ 50 à 90 mots à débit 0,9 ;
// - pas de sigle ni de chiffre (« N P K » et non « NPK ») ;
// - la dernière phrase dit la première action à faire ;
// - une phrase par entrée du tableau : c'est l'unité des sous-titres. Gardez le MÊME nombre de phrases en
//   français et en wolof : pendant la voix wolof, le sous-titre français de la même phrase s'affiche dessous.
//
// Fichiers audio enregistrés (recommandé pour le wolof, la synthèse wolof étant lente ou indisponible) :
// déposez le fichier dans app/public/ au chemin indiqué par `audio` (ex. app/public/voix/accueil/agriculteur.wo.mp3).
// S'il est présent, il est joué en priorité ; sinon le moteur passe à la source suivante, sans erreur visible.
// Ordre des sources : fichier audio → synthèse wolof du serveur (pour « wo ») → voix française du navigateur.

export type ProfilAccueil = 'agriculteur' | 'organisation'
export type LangueAccueil = 'fr' | 'wo'

export interface MessageAccueil {
  /** Les phrases dites, dans l'ordre (une phrase = un sous-titre). */
  phrases: string[]
  /** Fichier audio enregistré, servi depuis app/public/ (facultatif). */
  audio?: string
}

/** Langue de l'accueil quand l'utilisateur n'en a pas choisi (clé localStorage `assaman.langue` : « fr » ou « wo »). */
export const LANGUE_PAR_DEFAUT: Record<ProfilAccueil, LangueAccueil> = {
  agriculteur: 'wo',
  organisation: 'fr',
}

/** Lire seul le résumé de chaque onglet ouvert (et non seulement du premier). Faux : premier écran seulement. */
export const LIRE_CHAQUE_ONGLET: Record<ProfilAccueil, boolean> = {
  agriculteur: true,
  organisation: false,
}

type Encadrement = Partial<Record<LangueAccueil, { debut?: string[]; fin?: string[] }>>

/** Avant et après le résumé réel, par écran (identifiants : pages/Scene.tsx). La phrase de fin dit quoi faire ensuite.
 *  Un écran absent est lu sans encadrement. */
export const ENCADREMENT: Record<ProfilAccueil, Record<string, Encadrement>> = {
  agriculteur: {
    // À FAIRE RELIRE par un locuteur wolof de l'équipe
    parcelle: {
      wo: {
        debut: ['Lii mooy li ñu xam ci sa tool.'],
        fin: ['Ngir xam lan nga war a ji ak ñaata jiwu ak engrais, bësal « Que semer ? », te bësal « Combien m’en faut-il ? ».'],
      },
      fr: {
        debut: ['Voici ce que l’on sait de votre champ.'],
        fin: ['Pour savoir quoi semer, et combien de semences et d’engrais, appuyez sur « Que semer ? », puis sur « Combien m’en faut-il ? ».'],
      },
    },
  },
  organisation: {
    campagne: {
      fr: {
        debut: ['Bienvenue. Voici la situation de la campagne dans le pays.'],
        fin: ['Pour le détail, cliquez sur un département, ou passez à l’étape suivante.'],
      },
    },
  },
}

/** Messages de secours (pas de résumé disponible). */
export const MESSAGES: Record<ProfilAccueil, Partial<Record<LangueAccueil, MessageAccueil>>> = {
  agriculteur: {
    fr: {
      audio: '/voix/accueil/agriculteur.fr.mp3',
      phrases: [
        'Bonjour, et bienvenue dans votre espace.',
        'Ici, vous voyez le temps prévu dans votre zone : la pluie qui va tomber cette saison, et si l’année sera sèche ou humide.',
        'On vous dit quoi semer, et à quel moment.',
        'On vous dit aussi combien de semences mettre pour un hectare, et combien d’engrais.',
        'C’est simple : appuyez sur un bouton du menu, et la réponse s’affiche.',
        'Pour commencer, appuyez sur « Me localiser », ou choisissez votre département : je vous dirai ce que l’on sait de votre champ.',
      ],
    },
    // À FAIRE RELIRE par un locuteur wolof de l'équipe (comme wolof.ts)
    wo: {
      audio: '/voix/accueil/agriculteur.wo.mp3',
      phrases: [
        'Asalaa maalekum, dalal ak jàmm ci sa bérab.',
        'Fii, dinga gis naka la asamaan di mel ci sa gox : taw bi dina ñëw ci nawet bi, ak ndax at mi dina wow walla dina tooy.',
        'Dinañu la wax lan nga war a ji, ak kañ.',
        'Dinañu la wax itam ñaata jiwu nga war a def ci benn ektaar, ak ñaata engrais.',
        'Yomb na : bësal benn bouton ci menu bi, tontu bi dina feeñ.',
        'Ngir tàmbali, bësal « Me localiser », walla nga tànn sa departemaa : dinaa la wax li ñu xam ci sa tool.',
      ],
    },
  },
  organisation: {
    fr: {
      audio: '/voix/accueil/organisation.fr.mp3',
      phrases: [
        'Bienvenue dans l’espace des O N G et des services de l’État.',
        'Cette vue centralise, pour tout le pays, les conditions climatiques et agricoles de la campagne.',
        'Elle signale les départements vulnérables ou à risque, notamment là où la récolte peut chuter.',
        'Elle vous aide à prioriser les interventions, puis indique, département par département, les cultures conseillées et les quantités de semences et d’engrais nécessaires.',
        'Vous pouvez enfin répartir un stock et exporter le dossier.',
        'Pour commencer, parcourez l’étape « Où agir en priorité », puis cliquez sur un département pour le détailler.',
      ],
    },
  },
}

/** Les sous-titres affichent « ONG » là où la voix dit « O N G ». */
export const SOUS_TITRE: [RegExp, string][] = [[/O N G/g, 'ONG']]

export const REGLAGES = {
  /** Débit de la voix du navigateur (1 = normal) */
  debit: 0.9,
  /** Langue demandée à la voix du navigateur */
  langueVoix: 'fr-FR',
  /** Attente maximale de la synthèse wolof du serveur avant de passer à la voix française (elle continue en
   *  arrière-plan : « Rejouer » sera alors en wolof). Les sous-titres s'affichent pendant l'attente. */
  delaiSyntheseWolofMs: 20000,
  /** Le résumé de l'écran se complète à mesure que les données arrivent : on attend qu'il ne change plus
   *  pendant ce délai avant de le lire (court : la voix doit partir vite)… */
  stabiliteResumeMs: 600,
  /** …mais pas plus longtemps que ceci après l'arrivée sur la scène (on lit alors ce qui est là) */
  attenteMaxResumeMs: 5000,
}

export const LIBELLES = {
  ecouter: 'Écouter',
  ecouterAccueil: 'Écouter le résumé à voix haute',
  pause: 'Pause',
  reprendre: 'Reprendre',
  rejouer: 'Rejouer',
  couper: 'Couper le son',
  fermer: 'Fermer',
  titre: 'Résumé à voix haute',
  attente: 'Le résumé de votre écran se prépare…',
  bloque: 'Votre navigateur a bloqué la lecture automatique. Appuyez sur « Écouter ».',
  preparation: 'La voix wolof se prépare…',
  replisFrancais: 'La voix wolof n’est pas prête : message lu en français.',
  sansVoix: 'Votre appareil ne lit pas à voix haute : voici le message.',
  muet: 'Lecture automatique coupée. Le bouton haut-parleur, en haut, la réactive.',
}
