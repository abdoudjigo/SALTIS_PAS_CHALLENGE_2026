// Mot de bienvenue : il se joue à l'arrivée après une connexion ou une inscription, jamais à un simple
// rechargement de page (l'état vit en mémoire). La version longue ne se joue qu'une fois par compte.
import type { Utilisateur } from '../types/auth'
import type { Departement } from '../types/marts'
import type { Genre } from './Mascotte'

const CLE = 'assaman.bienvenue'

/** `plongee` : la plongée Afrique → Sénégal reste à jouer, une seule fois, à l'entrée dans l'application. */
export const arrivee = { enCours: false, destination: '/', plongee: false }

export function annoncerArrivee(destination: string) {
  arrivee.enCours = true
  arrivee.destination = destination
  arrivee.plongee = destination === '/'
}

function comptesAccueillis(): number[] {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? '[]') as number[]
  } catch {
    return []
  }
}

export const dejaAccueilli = (user: Utilisateur) => comptesAccueillis().includes(user.id)

export function noterAccueil(user: Utilisateur) {
  try {
    localStorage.setItem(CLE, JSON.stringify([...new Set([...comptesAccueillis(), user.id])]))
  } catch {
    /* navigation privée : la version longue pourra se rejouer */
  }
}

/** On alterne l'agricultrice et l'agriculteur d'un compte à l'autre. */
export const genreMascotte = (user: Utilisateur): Genre => (user.id % 2 === 1 ? 'agricultrice' : 'agriculteur')

/** Texte de la bulle, selon le profil. « Dalal ak jàmm » : bienvenue, en wolof. */
export function messageBienvenue(user: Utilisateur, departement: Departement | undefined, court: boolean): string {
  const prenom = user.nom.trim().split(/\s+/)[0]
  const lieu = departement?.departement

  if (court) {
    if (user.role === 'PRODUCTEUR') return lieu ? `Bon retour, ${prenom}. Le ciel de ${lieu} vous attend.` : `Bon retour, ${prenom}. Vos champs vous attendent.`
    return `Bon retour, ${prenom}. Reprenons là où vous en étiez.`
  }

  switch (user.role) {
    case 'PRODUCTEUR':
      return `Dalal ak jàmm, ${prenom} ! Bienvenue sur Assaman & Suuf. Allons voir ce que le ciel prépare pour vos champs${lieu ? ` de ${lieu}` : ''}.`
    case 'CONSEILLER':
      return `Dalal ak jàmm, ${prenom} ! Bienvenue sur Assaman & Suuf. Voyons ce que la saison réserve aux producteurs ${lieu ? `de ${lieu}` : 'que vous accompagnez'}.`
    case 'ORGANISATION':
      return user.organisation?.type === 'SEMENCIER'
        ? `Bienvenue, ${prenom}. Voyons ensemble dans quels départements vos variétés sont les mieux adaptées.`
        : `Bienvenue, ${prenom}. Voyons ensemble où vos intrants seront les plus utiles cette campagne.`
    case 'ADMIN':
      return `Bienvenue, ${prenom}. Les territoires, les comptes et les référentiels sont entre vos mains.`
  }
}
