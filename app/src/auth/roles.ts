// Rôles de l'application (cibles du dossier de candidature, sans les coopératives).
import { config } from '../config'
import type { Role, TypeOrganisation, Utilisateur } from '../types/auth'

export const ROLES: Record<Role, { libelle: string; description: string }> = {
  PRODUCTEUR: { libelle: 'Producteur', description: 'Préparer la campagne, choisir culture et variété, estimer ses besoins' },
  CONSEILLER: { libelle: 'Conseiller agricole', description: 'Relayer les recommandations, suivre les territoires' },
  ORGANISATION: { libelle: 'Organisation', description: "ONG, service de l'État ou association de semenciers" },
  ADMIN: { libelle: 'Administrateur', description: 'Utilisateurs, droits, référentiels' },
}

export const TYPES_ORGANISATION: Record<TypeOrganisation, string> = {
  ONG: 'ONG',
  ETAT: "Service de l'État",
  SEMENCIER: 'Association de producteurs de semences',
}

const estAdmin = (u: Utilisateur) => u.role === 'ADMIN'
const typeOrg = (u: Utilisateur) => (u.role === 'ORGANISATION' ? u.organisation?.type : undefined)

// Qui voit quoi. Une clé absente d'ici est ouverte à tout utilisateur connecté.
export const ACCES = {
  // Répartition des stocks : ONG et services de l'État (les semenciers déclarent une offre, sans scénario)
  agrodistrib: (u: Utilisateur) => estAdmin(u) || typeOrg(u) === 'ONG' || typeOrg(u) === 'ETAT',
  semences: (u: Utilisateur) => config.activerSemenciers && (estAdmin(u) || typeOrg(u) === 'SEMENCIER'),
  admin: estAdmin,
} satisfies Record<string, (u: Utilisateur) => boolean>

export type CleAcces = keyof typeof ACCES

export function peutAcceder(user: Utilisateur | null, cle?: CleAcces): boolean {
  if (!user) return false
  return !cle || ACCES[cle](user)
}
