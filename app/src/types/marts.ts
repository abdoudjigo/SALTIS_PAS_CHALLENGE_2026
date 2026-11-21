// Types des réponses de l'API : colonnes des marts SALTIS.MARTS (docs/technique/contrat-donnees.md),
// en minuscules, sans clé md5. `| null` = valeur inconnue ou non applicable (jamais 0).

export type CodeDepartement = string // code GADM, ex. SEN.10.1_1

export interface Territoire {
  code_departement: CodeDepartement
  departement: string
  code_region: string
  region: string
  zone_agroecologique: string
}

export interface Departement extends Territoire {
  latitude: number
  longitude: number
  /** département de transition entre deux zones : une information, jamais une clé d'agrégation */
  zone_secondaire?: string | null
}

export interface Intrant {
  code_intrant: string
  nom_intrant: string
  /** colonne du mart de besoins correspondant à cet intrant */
  colonne_besoin: ColonneBesoin
  /** colonne qui explique un besoin NULL ou nul (« dose à saisir », « pas dans la formule ») */
  colonne_libelle?: string | null
  /** faux pour le fumier : non chiffré, jamais dans les totaux, le budget ni la répartition */
  dans_totaux?: boolean
}

export interface Referentiels {
  departements: Departement[]
  zones: string[]
  cultures: string[]
  intrants: Intrant[]
  campagnes: number[]
  varietes: Variete[]
}

export interface Variete {
  variete: string
  culture: string
  cycle_jours: number | null
  tolerance_secheresse: string | null
  disponibilite_semences: string | null
  zones_recommandees: string | null
}

// --- Module A ---------------------------------------------------------------------
export type RisqueSaison = 'normal' | 'sécheresse' | 'excès de pluie' | 'sécheresse et excès de pluie'
export type ClasseSaison = 'très sèche' | 'sèche' | 'normale' | 'humide' | 'très humide'

export interface LigneCarte extends Territoire {
  campagne_agricole: number
  pluie_saison_mm: number | null
  pluie_saison_normale_mm: number | null
  anomalie_pluie_saison_pct: number | null
  spi_saison: number | null
  classe_saison: ClasseSaison | null
  debut_saison_jour: number | null
  fin_saison_jour: number | null
  retard_debut_saison_j: number | null
  duree_saison_j: number | null
  nb_jours_pluie: number | null
  plus_longue_sequence_seche_j: number | null
  nb_sequences_seches_7j: number | null
  nb_decades_seches: number | null
  temp_max_moy_saison_c: number | null
  nb_jours_tmax_sup_40: number | null
  ndvi_max_saison_zc: number | null
  anomalie_ndvi_pct: number | null
  alerte_secheresse: boolean
  alerte_exces_pluie: boolean
  risque_saison: RisqueSaison
  score_vulnerabilite: number | null
  classe_vulnerabilite: string | null
  source_calendrier: string
}

export interface LigneSuivi extends Territoire {
  annee: number
  campagne_agricole: number
  numero_decade_annee: number
  libelle_decade: string
  est_decade_saison: boolean
  pluie_mm: number | null
  pluie_normale_mm: number | null
  ecart_pluie_mm: number | null
  anomalie_pluie_pct: number | null
  cumul_depuis_juin_mm: number | null
  cumul_normale_depuis_juin_mm: number | null
  ecart_cumul_normale_mm: number | null
  part_saison_pct: number | null
  pluie_1_annee_sur_5_mm: number | null
  pluie_mediane_mm: number | null
  pluie_4_annees_sur_5_mm: number | null
  proba_decade_seche_pct: number | null
  nb_jours_pluie: number | null
  plus_longue_sequence_seche_j: number | null
  decade_seche: boolean
}

// --- Module B ---------------------------------------------------------------------
export type NiveauAdequation =
  | 'adaptée' | 'à risque' | 'déconseillée' | 'irrigation requise' | 'non évaluée (culture pluriannuelle)'

export interface LigneChoixCulture extends Territoire {
  culture: string
  type_option: 'CYCLE' | 'VARIETE'
  option: string
  cycle_jours: number | null
  proba_cycle_couvert_pct: number | null
  rang_option: number | null
  score_adequation: number | null
  proba_besoin_eau_couvert_pct: number | null
  niveau_adequation: NiveauAdequation | null
  note_score: string | null
  tolerance_secheresse: string | null
  disponibilite_semences: string | null
  zones_recommandees: string | null
}

// --- Module E : carte des opportunités (mart_carte_opportunites, docs/technique/carte-opportunites.md) ---------
export type CouleurOpportunite = 'bleu' | 'jaune' | 'vert'
export type CategorieEau =
  | 'eau de surface peu exploitée' | 'nappe accessible' | 'eau de surface déjà exploitée'
  | "pas d'eau mobilisable identifiée" | 'non évaluée'

/** Un département de la carte des opportunités, champ pour champ comme `CarteOpportunite` (api/schemas/opportunites.py). */
export interface CarteOpportunite extends Territoire {
  zone_secondaire: string | null
  latitude: number | null
  longitude: number | null
  /** `bleu` prioritaire, sinon `couleur_fond` ; null si la saison n'est pas évaluée */
  couleur_carte: CouleurOpportunite | null
  /** `jaune` saison courte, `vert` saison longue */
  couleur_fond: 'jaune' | 'vert' | null
  couche_eau: boolean
  classe_saison_pluie: 'courte' | 'longue' | 'non évaluée'
  /** plus long cycle (culture ou variété) qui passe au moins 4 années sur 5 (jours) */
  cycle_max_conseille_j: number | null
  cultures_cycle_long: string | null
  /** « CULTURE : variété (N j) ; … » */
  varietes_conseillees: string | null
  nb_varietes_conseillees: number
  pluie_saison_normale_mm: number | null
  duree_saison_moyenne_j: number | null
  duree_saison_courte_j: number | null
  categorie_eau: CategorieEau
  potentiel_contre_saison_ha: number | null
  rang_opportunite_eau: number | null
  surface_eau_permanente_ha: number | null
  surface_proche_eau_cultivable_ha: number | null
  surface_proche_eau_inexploitee_ha: number | null
  part_proche_eau_exploitee_pct: number | null
  profondeur_classe_dominante: string | null
  productivite_classe_dominante: string | null
  part_nappe_accessible_pct: number | null
  surface_equipee_irrigation_ha: number | null
  conseil_agriculteur: string
  conseil_investisseur: string | null
}

// --- Module C ---------------------------------------------------------------------
export type StatutDose = 'VALIDEE' | 'A_CONFIRMER' | 'NON_VERIFIEE' | 'A_COMPLETER'

export type ColonneBesoin =
  | 'besoin_azote_n_t' | 'besoin_phosphate_p2o5_t' | 'besoin_potasse_k2o_t'
  | 'besoin_npk_15_15_15_t' | 'besoin_npk_15_10_10_t' | 'besoin_npk_6_20_10_t' | 'besoin_uree_t' | 'besoin_dap_t' | 'besoin_fumier_t' | 'besoin_semences_retenu_t'

export type Besoins = Record<ColonneBesoin, number | null>

/** État du besoin d'un produit (libelle_<produit>) : « pas dans la formule » = dose nulle, connue. */
export type LibelleProduit = 'calculé' | 'pas dans la formule' | 'dose à saisir' | 'superficie de référence nulle'
/** Colonnes d'explication des besoins par produit, et la note du DAP (api/schemas/besoins.py, agrodistrib.py). */
export interface LibellesProduits {
  libelle_npk_15_15_15?: LibelleProduit | null
  libelle_npk_15_10_10?: LibelleProduit | null
  libelle_npk_6_20_10?: LibelleProduit | null
  libelle_uree?: LibelleProduit | null
  libelle_dap?: LibelleProduit | null
  note_dap?: string | null
  libelle_fumier?: string | null
}

export interface LigneBesoin extends Territoire, Besoins, LibellesProduits {
  culture: string | null
  message_departement: string | null
  superficie_reference_ha: number | null
  annees_reference: string | null
  type_superficie: 'semée' | 'récoltée' | null
  reference_anterieure_2015: boolean | null
  libelle_besoin_engrais: string | null
  besoin_semences_t: number | null
  besoin_semences_applicable: boolean | null
  libelle_semences: string | null
  besoin_irrigation_mm: number | null
  volume_irrigation_m3_ha: number | null
  irrigation_requise: boolean | null
  irrigation_totale_m3: number | null
  statut_validation_engrais: StatutDose | null
  statut_validation_semis: StatutDose | null
  source_reference_engrais: string | null
  source_reference_semis: string | null
  coherence_dose_n: 'COHERENT' | 'ECART' | 'A_VERIFIER' | null
  coherence_dose_semis: 'COHERENT' | 'ECART' | 'A_VERIFIER' | null
}

// --- Module D ---------------------------------------------------------------------
export interface LigneVulnerabilite extends Territoire {
  score_vulnerabilite: number | null
  rang_vulnerabilite: number | null
  classe_vulnerabilite: string | null
  score_alea_secheresse: number | null
  score_sensibilite_rendement: number | null
  nb_dimensions_disponibles: number
  confiance_rendement: 'normale' | 'faible'
  freq_alerte_secheresse_pct: number | null
  variabilite_pluie_cv_pct: number | null
  pluie_saison_annee_seche_mm: number | null
  variabilite_rendement_pct: number | null
  tendance_rendement_pct_an: number | null
  nb_cultures_rendement: number
  nb_campagnes_rendement: number
  freq_alerte_exces_pct: number | null
  proba_saison_seche_pct: number | null
  proba_sequence_seche_15j_pct: number | null
  part_cultures_pct: number | null
  methode_version: string
  periode_climat: string
  periode_rendement: string
  nb_saisons_1991_2020: number
  [rang: `rang_${string}`]: number | null
}

export interface LigneTerritoireAgrodistrib extends Territoire, Besoins, LibellesProduits {
  culture: string
  superficie_reference_ha: number
  besoin_semences_applicable: boolean
  statut_validation_engrais: StatutDose
  statut_validation_semis: StatutDose
  /** source de la dose retenue (recherche de la zone, catalogue PIA…) */
  source_reference_engrais?: string | null
  source_reference_semis?: string | null
  niveau_source_potentiel: 'ZONE'
  rendement_moyen_kg_ha: number | null
  rendement_atteignable_kg_ha: number | null
  ecart_rendement_kg_ha: number | null
  potentiel_evalue: boolean
  potentiel_gain_kg_ha: number | null
  meilleur_niveau_adequation: NiveauAdequation | null
  proba_cycle_couvert_moyen_pct: number | null
  facteur_limitant_principal: string | null
  proba_saison_seche_pct: number | null
  classe_texture: string | null
  ph_eau: number | null
  reserve_utile_mm: number | null
  carbone_organique_g_kg: number | null
  amendement_ph_recommande: boolean | null
  fractionnement_azote_recommande: boolean | null
  score_vulnerabilite: number | null
  classe_vulnerabilite: string | null
  score_alea_secheresse: number | null
  confiance_rendement: string
  methode_version_vulnerabilite: string
  part_cultures_pct: number | null
}

// --- SALTIS.APP (PostgreSQL / application) ------------------------------------------
export type NiveauDestination = 'ZONE' | 'REGION' | 'DEPARTEMENT'

export interface Stock {
  code_intrant: string
  quantite_t: number | null
  campagne: number
}

export interface ParametresScenario {
  code_intrant: string
  quantite_t: number
  campagne: number
  niveau_destination: NiveauDestination
  cultures: string[]
  poids_vulnerabilite: number
}

export interface Proposition {
  niveau_destination: NiveauDestination
  code_territoire: string
  territoire: string
  nb_departements: number
  besoin_t: number
  quantite_proposee_t: number
  quantite_validee_t: number | null
  taux_couverture_pct: number
  vulnerabilite_moyenne: number | null
}

export interface Scenario {
  id: number
  organisation_id: number | null
  statut: 'PROPOSE' | 'VALIDE'
  cree_le: string
  valide_le?: string
  campagne: number
  code_intrant: string
  nom_intrant: string
  quantite_t: number
  niveau_destination: NiveauDestination
  methode: string
  version_algorithme: string
  parametres: { cultures: string[]; poids_vulnerabilite: number }
  besoin_total_t: number
  total_propose_t: number
  reste_non_reparti_t: number
  nb_couples_sans_dose: number
  propositions: Proposition[]
}

/** Offre de semences déclarée par une association de producteurs de semences (option B) */
export interface OffreSemence {
  variete: string
  culture: string
  quantite_t: number | null
  campagne: number
  zones_couvertes: string[]
}

// --- Prix des intrants (DIM_PRIX_INTRANT, GET /prix-intrants) ---------------------------------------
/** Un produit, une campagne. Prix null = « à saisir », jamais 0. */
export interface PrixIntrant {
  code_intrant: string
  nom_intrant: string | null
  campagne: number
  /** prix payé par le producteur, subventionné (FCFA / sac de 50 kg) */
  prix_cession_sac_50kg_fcfa: number | null
  subvention_tonne_fcfa: number | null
  /** prix de cession + subvention / 20 (FCFA / sac de 50 kg) */
  cout_reel_sac_50kg_fcfa: number | null
  statut_validation: 'VALIDEE' | 'A_CONFIRMER' | 'A_SAISIR'
  source: string | null
}

// --- Cadre harmonisé (MART_CADRE_HARMONISE_DEPARTEMENT, GET /cadre-harmonise) --------------------------
export type PhaseCH = 1 | 2 | 3 | 4 | 5
export type LibellePhaseCH = 'minimale' | 'sous pression' | 'crise' | 'urgence' | 'famine'

/** Un département, dernier cycle du Cadre harmonisé. Hors score de vulnérabilité ; populations additives, phases jamais. */
export interface LigneCadreHarmonise extends Territoire {
  annee_cycle: number | null
  code_cycle: number | null
  libelle_cycle_source: string | null
  libelle_cycle: string | null
  type_periode_retenue: 'current' | 'projected' | null
  /** « mars 2026, projection juin-août 2026 » : toujours affiché */
  libelle_periode_retenue: string | null
  date_debut_periode_retenue: string | null
  date_fin_periode_retenue: string | null
  periode_terminee: boolean | null
  /** « période terminée, prochain cycle attendu » si la période est passée */
  mention_periode: string | null
  phase_retenue: PhaseCH | null
  libelle_phase_retenue: LibellePhaseCH | null
  population_retenue: number | null
  population_phase3_5_retenue: number | null
  libelle_periode_courante: string | null
  phase_courante: PhaseCH | null
  population_courante: number | null
  population_phase3_5_courante: number | null
  libelle_periode_projetee: string | null
  phase_projetee: PhaseCH | null
  population_projetee: number | null
  population_phase3_5_projetee: number | null
  /** vrai pour Pikine : Pikine et Keur Massar réunis */
  fusion_keur_massar: boolean
  note_fusion: string | null
  source: string
  licence: string
}

/** Palette officielle des phases (GET /referentiels/phases-cadre-harmonise). */
export interface PhaseCadreHarmonise {
  phase: PhaseCH
  libelle: LibellePhaseCH
  couleur: string
}
