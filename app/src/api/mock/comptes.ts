// Les deux profils de démonstration : on entre par la porte « Agriculteur » ou « ONG et services de l'État »
// (landing). Aucun nom de personne : ce sont des profils, pas des comptes réels.
import type { Utilisateur } from '../../types/auth'

export const MOT_DE_PASSE_DEMO = 'demo2026'

export const UTILISATEURS_DEMO: Utilisateur[] = [
  { id: 1, email: 'producteur@demo.sn', nom: 'Agriculteur', role: 'PRODUCTEUR', organisation: null, code_departement: 'SEN.5.2_1' },
  { id: 3, email: 'ong@demo.sn', nom: "ONG et services de l'État", role: 'ORGANISATION', organisation: { id: 10, nom: "ONG et services de l'État", type: 'ONG' }, code_departement: null },
]
