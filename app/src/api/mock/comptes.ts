// Comptes de démonstration (mode exemple uniquement)
import { config } from '../../config'
import type { Utilisateur } from '../../types/auth'

export const MOT_DE_PASSE_DEMO = 'demo2026'

const TOUS: Utilisateur[] = [
  { id: 1, email: 'producteur@demo.sn', nom: 'Awa Diop', role: 'PRODUCTEUR', organisation: null, code_departement: 'SEN.5.2_1' },
  { id: 2, email: 'conseiller@demo.sn', nom: 'Moussa Ndiaye', role: 'CONSEILLER', organisation: null, code_departement: 'SEN.4.2_1' },
  { id: 3, email: 'ong@demo.sn', nom: 'Fatou Sarr', role: 'ORGANISATION', organisation: { id: 10, nom: 'ONG Exemple', type: 'ONG' }, code_departement: null },
  { id: 4, email: 'etat@demo.sn', nom: 'Ibrahima Fall', role: 'ORGANISATION', organisation: { id: 11, nom: "Service de l'État (exemple)", type: 'ETAT' }, code_departement: null },
  { id: 6, email: 'semencier@demo.sn', nom: 'Aïssatou Ba', role: 'ORGANISATION', organisation: { id: 12, nom: 'Association de semenciers (exemple)', type: 'SEMENCIER' }, code_departement: null },
  { id: 5, email: 'admin@demo.sn', nom: 'Admin Démo', role: 'ADMIN', organisation: null, code_departement: null },
]

export const UTILISATEURS_DEMO = TOUS.filter((u) => config.activerSemenciers || u.organisation?.type !== 'SEMENCIER')
