import { CloudRain, Globe, LayoutDashboard, Map, Package, Settings, ShieldAlert, Sprout, Split, Wheat, type LucideIcon } from 'lucide-react'
import type { CleAcces } from '../../auth/roles'
import type { ClePrechargement } from '../../hooks/donnees'

export interface ElementMenu {
  to: string
  libelle: string
  court?: string
  icone: LucideIcon
  fin?: boolean
  module?: string
  acces?: CleAcces
  prechargement?: ClePrechargement
}

// Menu principal. `acces` renvoie aux règles de auth/roles.ts ; `module` = module du projet.
export const NAVIGATION: ElementMenu[] = [
  { to: '/', libelle: 'Le Sénégal en 3D', court: 'Sénégal', icone: Globe, fin: true },
  { to: '/tableau-de-bord', libelle: 'Tableau de bord', court: 'Tableau', icone: LayoutDashboard },
  { to: '/carte', libelle: 'Carte agroclimatique', court: 'Carte', icone: Map, module: 'A' },
  { to: '/suivi', libelle: 'Suivi décadaire', court: 'Suivi', icone: CloudRain, module: 'A' },
  { to: '/cultures', libelle: 'Cultures et variétés', court: 'Cultures', icone: Sprout, module: 'B' },
  { to: '/besoins', libelle: 'Besoins en intrants', court: 'Besoins', icone: Package, module: 'C', prechargement: 'besoins' },
  { to: '/vulnerabilite', libelle: 'Vulnérabilité', icone: ShieldAlert, module: 'D', prechargement: 'vulnerabilite' },
  { to: '/agrodistrib', libelle: 'AgroDistrib', icone: Split, module: 'D', acces: 'agrodistrib' },
  { to: '/semences', libelle: 'Offre de semences', court: 'Semences', icone: Wheat, module: 'B', acces: 'semences' },
  { to: '/admin', libelle: 'Administration', icone: Settings, acces: 'admin' },
]
