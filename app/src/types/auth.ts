export type Role = 'PRODUCTEUR' | 'CONSEILLER' | 'ORGANISATION' | 'ADMIN'

/** ONG, service de l'État, ou association de producteurs de semences (option B, à confirmer) */
export type TypeOrganisation = 'ONG' | 'ETAT' | 'SEMENCIER'

export interface Organisation {
  id: number
  nom: string
  type: TypeOrganisation
}

export interface Utilisateur {
  id: number
  email: string
  nom: string
  role: Role
  organisation: Organisation | null
  code_departement: string | null
}

export interface Session {
  access_token: string
  token_type: 'bearer'
  user: Utilisateur
}

export interface DonneesInscription {
  nom: string
  email: string
  password: string
  code_departement: string
}
