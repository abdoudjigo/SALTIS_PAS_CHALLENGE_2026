// Référentiel d'EXEMPLE. Codes GADM et noms conformes au contrat de données ; le rattachement
// aux zones et les coordonnées (chef-lieu approximatif) sont indicatifs, en attendant l'API
// (dim_geographie) et les contours GADM 4.1.
import type { Departement, Intrant, Variete } from '../../types/marts'

export const ZONES = [
  'VALLÉE DU FLEUVE SÉNÉGAL',
  'NIAYES',
  'ZONE SYLVOPASTORALE',
  'BASSIN ARACHIDIER',
  'SÉNÉGAL ORIENTAL',
  'CASAMANCE',
]

const [VALLEE, NIAYES, SYLVO, BASSIN, ORIENTAL, CASAMANCE] = ZONES

// [code_region, region, [[nom, zone, lat, lon], ...]] dans l'ordre GADM
const REGIONS: [string, string, [string, string, number, number][]][] = [
  ['SEN.1_1', 'Dakar', [
    ['Dakar', NIAYES, 14.69, -17.45], ['Guédiawaye', NIAYES, 14.77, -17.4],
    ['Pikine', NIAYES, 14.75, -17.36], ['Rufisque', NIAYES, 14.72, -17.22]]],
  ['SEN.2_1', 'Diourbel', [
    ['Bambey', BASSIN, 14.7, -16.45], ['Diourbel', BASSIN, 14.65, -16.23], ['Mbacké', BASSIN, 14.79, -15.91]]],
  ['SEN.3_1', 'Fatick', [
    ['Fatick', BASSIN, 14.34, -16.41], ['Foundiougne', BASSIN, 13.95, -16.5], ['Gossas', BASSIN, 14.49, -16.07]]],
  ['SEN.4_1', 'Kaffrine', [
    ['Birkelane', BASSIN, 14.13, -15.75], ['Kaffrine', BASSIN, 14.11, -15.55],
    ['Koungheul', BASSIN, 13.98, -14.8], ['Malem Hodar', BASSIN, 14.09, -15.3]]],
  ['SEN.5_1', 'Kaolack', [
    ['Guinguinéo', BASSIN, 14.27, -15.95], ['Kaolack', BASSIN, 14.15, -16.07], ['Nioro du Rip', BASSIN, 13.75, -15.8]]],
  ['SEN.6_1', 'Kédougou', [
    ['Kédougou', ORIENTAL, 12.56, -12.18], ['Salémata', ORIENTAL, 12.63, -12.82], ['Saraya', ORIENTAL, 12.84, -11.75]]],
  ['SEN.7_1', 'Kolda', [
    ['Kolda', CASAMANCE, 12.89, -14.94], ['Médina Yoro Foulah', CASAMANCE, 13.29, -14.72],
    ['Vélingara', CASAMANCE, 13.15, -14.11]]],
  ['SEN.8_1', 'Louga', [
    ['Kébémer', NIAYES, 15.37, -16.44], ['Linguère', SYLVO, 15.39, -15.12], ['Louga', NIAYES, 15.62, -16.22]]],
  ['SEN.9_1', 'Matam', [
    ['Kanel', VALLEE, 15.49, -13.18], ['Matam', VALLEE, 15.66, -13.26], ['Ranérou', SYLVO, 15.3, -13.96]]],
  ['SEN.10_1', 'Saint-Louis', [
    ['Dagana', VALLEE, 16.52, -15.5], ['Podor', VALLEE, 16.65, -14.96], ['Saint-Louis', VALLEE, 16.03, -16.49]]],
  ['SEN.11_1', 'Sédhiou', [
    ['Bounkiling', CASAMANCE, 13.04, -15.7], ['Goudomp', CASAMANCE, 12.58, -15.88], ['Sédhiou', CASAMANCE, 12.71, -15.56]]],
  ['SEN.12_1', 'Tambacounda', [
    ['Bakel', VALLEE, 14.9, -12.46], ['Goudiry', ORIENTAL, 14.18, -12.72],
    ['Koumpentoum', ORIENTAL, 13.98, -14.55], ['Tambacounda', ORIENTAL, 13.77, -13.67]]],
  ['SEN.13_1', 'Thiès', [
    ['Mbour', BASSIN, 14.42, -16.97], ['Thiès', BASSIN, 14.79, -16.93], ['Tivaouane', BASSIN, 14.95, -16.82]]],
  ['SEN.14_1', 'Ziguinchor', [
    ['Bignona', CASAMANCE, 12.81, -16.23], ['Oussouye', CASAMANCE, 12.48, -16.55], ['Ziguinchor', CASAMANCE, 12.56, -16.27]]],
]

export const DEPARTEMENTS: Departement[] = REGIONS.flatMap(([code_region, region, deps]) =>
  deps.map(([departement, zone_agroecologique, latitude, longitude], i) => ({
    code_departement: code_region.replace('_1', `.${i + 1}_1`),
    departement,
    code_region,
    region,
    zone_agroecologique,
    latitude,
    longitude,
  })),
)

export const CULTURES = [
  'ARACHIDE', 'MIL (SOUNA)', 'SORGHO', 'NIÉBÉ', 'MAÏS', 'RIZ (IRRIGUÉ)',
  'MANIOC', 'SÉSAME', 'PASTÈQUE', 'COTON', 'TOMATE', 'OIGNON',
]

export const CULTURES_IRRIGUEES = ['RIZ (IRRIGUÉ)', 'OIGNON', 'TOMATE']

export const VARIETES: Variete[] = [
  { variete: 'Mil sanio (type tardif)', culture: 'MIL (SOUNA)', cycle_jours: 135, tolerance_secheresse: 'moyenne',
    disponibilite_semences: 'locale', zones_recommandees: 'Casamance, Sénégal oriental' },
  { variete: 'Sahel 177', culture: 'RIZ (IRRIGUÉ)', cycle_jours: 122, tolerance_secheresse: 'faible',
    disponibilite_semences: 'homologuée (2009)', zones_recommandees: 'Vallée du fleuve Sénégal' },
  // Documentée mais absente de l'adéquation (cycle inconnu)
  { variete: 'Mil souna (type hâtif)', culture: 'MIL (SOUNA)', cycle_jours: null, tolerance_secheresse: null,
    disponibilite_semences: null, zones_recommandees: null },
]

export const INTRANTS: Intrant[] = [
  { code_intrant: 'NPK_15_15_15', nom_intrant: 'NPK 15-15-15', colonne_besoin: 'besoin_npk_15_15_15_t', colonne_libelle: 'libelle_npk_15_15_15', dans_totaux: true },
  { code_intrant: 'NPK_15_10_10', nom_intrant: 'NPK 15-10-10', colonne_besoin: 'besoin_npk_15_10_10_t', colonne_libelle: 'libelle_npk_15_10_10', dans_totaux: true },
  { code_intrant: 'NPK_6_20_10', nom_intrant: 'NPK 6-20-10', colonne_besoin: 'besoin_npk_6_20_10_t', colonne_libelle: 'libelle_npk_6_20_10', dans_totaux: true },
  { code_intrant: 'UREE', nom_intrant: 'Urée 46-0-0', colonne_besoin: 'besoin_uree_t', colonne_libelle: 'libelle_uree', dans_totaux: true },
  { code_intrant: 'DAP_18_46_0', nom_intrant: 'DAP 18-46-0', colonne_besoin: 'besoin_dap_t', colonne_libelle: 'libelle_dap', dans_totaux: true },
  // Fumier : non chiffré, jamais dans les totaux, le budget ni la répartition
  { code_intrant: 'FUMIER', nom_intrant: 'Fumier', colonne_besoin: 'besoin_fumier_t', colonne_libelle: 'libelle_fumier', dans_totaux: false },
  { code_intrant: 'SEMENCES', nom_intrant: 'Semences', colonne_besoin: 'besoin_semences_retenu_t', colonne_libelle: 'libelle_semences', dans_totaux: true },
]
