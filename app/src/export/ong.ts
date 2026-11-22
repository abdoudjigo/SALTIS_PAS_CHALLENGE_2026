// Branchement du moteur PDF sur le parcours de l'ONG (étape 7, phase D2).
// Dossier national : chaque étape 1 à 6 est ouverte (cadre.exporter.activer), sa carte capturée, sa sortie lue dans le
// registre ; la vue de départ (étape 7) est rouverte à la fin. Fiche département : les six étapes sont ouvertes avec la
// sélection en cours pour lire leurs lignes du département, puis l'étape 7 cadre la carte sur le département.
// Tout est calculé dans le navigateur : aucune donnée ne part vers un service externe.
import { libelle, nombre } from '../lib/format'
import { lireNombre } from '../lib/saisie'
import { PARCOURS_ONG, questionOng, type Cadre, type EtapeExport, type ModeOng } from '../scene/cadre'
import { periodeCH } from '../scene/regles/cadreHarmonise'
import type { DossierOng } from '../scene/ong/dossier'
import { MODELES } from '../scene/regles/fiabilite'
import { fcfa, intrantsChiffres, sacsDeTonnes } from '../scene/ong/ong'
import { METHODE, nomArbitrage, VERSION } from '../scene/regles/repartition'
import type { Intrant, LigneCadreHarmonise, LigneTerritoireAgrodistrib, PhaseCadreHarmonise, PrixIntrant } from '../types/marts'
import { exporterDossierNational } from './dossierNational'
import { exporterFicheDepartement } from './ficheDepartement'
import { ouvrirBarre } from './progression'
import { estFumier, nomLisible, SOURCES_MINIMALES } from './texte'
import type { BesoinFiche, CarteExport, Etape, Legende, Mention, Source, Tableau, Valeur } from './types'

// --- État partagé (l'étape 7 se démonte pendant l'export : elle le relit à son retour) ---------------------
export type FormatExport = 'dossier' | 'fiche'
export interface EtatExport {
  enCours: FormatExport | null
  /** dernier message (succès ou erreur), lu par l'étape 7 */
  message: string | null
  erreur: boolean
  /** code du département sur lequel l'étape 7 cadre la carte (fiche) ; null sinon */
  cadrage: string | null
}
let etat: EtatExport = { enCours: null, message: null, erreur: false, cadrage: null }
const abonnes = new Set<() => void>()
const maj = (m: Partial<EtatExport>) => {
  etat = { ...etat, ...m }
  abonnes.forEach((f) => f())
}
export const lireEtatExport = () => etat
export const abonnerEtatExport = (f: () => void) => {
  abonnes.add(f)
  return () => void abonnes.delete(f)
}

export const ID_BOUTON: Record<FormatExport, string> = { dossier: 'export-dossier', fiche: 'export-fiche' }
const CARTE_ABSENTE_MSG = "Carte non disponible sur cet appareil : le PDF est produit sans les cartes, avec la note « carte non disponible sur cet appareil »."

/** Ce que l'étape 7 connaît au moment du clic (lu une fois : la barre bloque la scène pendant l'export). */
export interface ContexteExport {
  cadre: Cadre
  dossier: DossierOng
  intrant: Intrant | undefined
  scenario: { id: string; libelle: string }
  prix: PrixIntrant[] | null | undefined
  ch: LigneCadreHarmonise[] | null | undefined
  phases: PhaseCadreHarmonise[] | null | undefined
  territoires: LigneTerritoireAgrodistrib[] | null | undefined
}

const ETAPES = PARCOURS_ONG.filter((p) => p.id !== 'exporter').map((p) => p.id)
const sansGras = (t: string) => t.replace(/\*\*/g, '')
const lire = (c: Cadre, id: ModeOng): EtapeExport | undefined => c.exporter.etapes()[id]
const sansFumier = (lignes: string[][]) => lignes.filter((l) => !l.some(estFumier))
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
/**
 * Ouvre une étape : attend que la carte soit posée, 7 s au plus. Une vue animée (pluie) ne devient jamais « idle » :
 * on capture alors la carte telle qu'elle est. Seule la perte de la carte est une erreur.
 */
async function ouvrirEtape(c: Cadre, id: ModeOng) {
  const ouverte = c.exporter.activer(id)
  ouverte.catch(() => undefined)
  await Promise.race([ouverte, pause(7000)])
  if (!c.exporter.carte()) throw new Error('Carte indisponible.')
}
const SANS_STOCK = 'Aucun stock saisi : la répartition n’est pas calculée (ni tableau ni légende). Saisissez le stock à l’étape 5.'

function tableauEtape(c: Cadre, id: ModeOng, court: boolean): Tableau | undefined {
  const e = lire(c, id)
  if (id === 'repartir' && !e?.tableau) return { colonnes: ['Répartition'], lignes: [[SANS_STOCK]] }
  if (!e?.tableau) return undefined
  const lignes = sansFumier(e.tableau.lignes)
  // Tableau vide (ex. étape 3 sans département en alerte) : la checklist suffit, pas de tableau « aucune ligne »
  if (!lignes.length) return undefined
  if (id !== 'repartir') return { colonnes: e.tableau.colonnes, lignes }
  // Étape 5 : colonnes et largeurs du tableau de l'écran ; en page d'étape, les 8 premières lignes et le total
  const largeurs = [2.2, 1.5, 1.5, 1.3, 2, 2, 1.8, 3.3]
  // Cellules vides de la ligne Total (date, raison) : « — » comme les cellules sans objet de l'écran
  if (lignes.length) lignes[lignes.length - 1] = lignes[lignes.length - 1].map((v) => (v === '' ? '—' : v))
  if (!court || lignes.length <= 5) return { colonnes: e.tableau.colonnes, lignes, largeurs, source: SOURCE_REPARTITION }
  return { colonnes: e.tableau.colonnes, lignes: [...lignes.slice(0, 4), lignes[lignes.length - 1]], largeurs, note: `4 premières lignes sur ${lignes.length - 1}, puis le total : tableau complet en fin de dossier.` }
}
const SOURCE_REPARTITION = `proposition calculée dans le navigateur (${METHODE}, version ${VERSION}, méthode du moteur AgroDistrib ; ou remplissage dans l'ordre du scénario), besoins de référence de mart_territoires_agrodistrib`

function etape(c: Cadre, id: ModeOng, rang: number): Etape {
  return {
    id: rang,
    get titre() { return lire(c, id)?.titre ?? questionOng(id) },
    get question() { return lire(c, id)?.question ?? questionOng(id) },
    get checklist() {
      return (lire(c, id)?.lignes ?? []).filter((l) => !estFumier(l.texte)).map((l) => ({ etat: l.etat, texte: sansGras(l.texte) }))
    },
    get tableau() { return tableauEtape(c, id, true) },
    get legende(): Legende | undefined {
      const l = lire(c, id)?.legende
      return l ? { titre: l.titre, entrees: l.entrees.filter((x) => !estFumier(x.libelle)) } : undefined
    },
    activer: () => ouvrirEtape(c, id),
  }
}

/** Sources communes : la date de chaque source quand l'API la donne, sinon « date non disponible ». */
function sources(x: ContexteExport): Source[] {
  const ch = x.ch?.find((l) => l.annee_cycle !== null) ?? x.ch?.[0]
  const minimale = (id: string) => SOURCES_MINIMALES.find((s) => s.id === id)!
  const prixIntrant = x.prix?.filter((p) => p.code_intrant === x.intrant?.code_intrant).sort((a, b) => b.campagne - a.campagne)[0]
  return [
    { ...minimale('cadre_harmonise'), date: ch?.libelle_cycle ?? null, detail: ch ? `période retenue : ${periodeCH(ch)}${ch.source && !minimale('cadre_harmonise').nom.includes(ch.source) ? ` ; ${ch.source}` : ''}` : 'non disponible' },
    { ...minimale('doses_pia'), detail: 'catalogue IFDC-CORAF, à confirmer' },
    { ...minimale('prix'), detail: prixIntrant?.source ? `${prixIntrant.nom_intrant ?? x.intrant?.nom_intrant ?? ''} ${prixIntrant.campagne} : ${prixIntrant.source}` : undefined },
    { id: 'besoins', nom: 'mart_territoires_agrodistrib (besoins de référence historiques : superficie de référence × dose de la zone)' },
    { id: 'vulnerabilite', nom: 'mart_vulnerabilite_departement (score relatif et indicatif, méthode v1)', detail: 'pluie 1991-2020, rendements 1991-2015' },
    { id: 'modeles', nom: `${MODELES.M1.nom}, ${MODELES.M3.nom}, ${MODELES.M4.nom} (schéma SALTIS.ML)` },
    { id: 'opportunites', nom: 'Carte des opportunités (contre-saison, gain de rendement)', detail: 'repérage indicatif' },
  ]
}

function mentions(x: ContexteExport, textes: string[]): Mention[] {
  const m: Mention[] = [{ nature: 'à confirmer', texte: 'Doses IFDC-CORAF PIA (catalogue) : à confirmer' }]
  for (const p of x.prix ?? []) if (p.statut_validation === 'A_CONFIRMER' && intrantsChiffres(x.cadre.ref).some((i) => i.code_intrant === p.code_intrant))
    m.push({ nature: 'à confirmer', texte: `Prix ${p.nom_intrant ?? p.code_intrant} (${p.campagne}) : ${p.source ?? 'source non disponible'}` })
  for (const [code, texte] of Object.entries(x.dossier.prix)) {
    const n = lireNombre(texte)
    if (n !== null && n > 0) m.push({ nature: 'saisi par vous', texte: `Prix d'achat ${x.cadre.ref.intrants.find((i) => i.code_intrant === code)?.nom_intrant ?? code} : ${fcfa(n)} / sac de 50 kg` })
  }
  const stock = lireNombre(x.dossier.stock)
  if (stock !== null && stock > 0) m.push({ nature: 'saisi par vous', texte: `Stock à répartir : ${stock.toLocaleString('fr-FR')} ${x.dossier.unite === 'sacs' ? 'sacs' : 't'}` })
  if (x.scenario.id === 'proportionnel') m.push({ nature: 'saisi par vous', texte: `Arbitrage vulnérabilité ↔ rendement : ${nomArbitrage(x.dossier.arbitrage)}` })
  for (const t of new Set(textes.map(sansGras))) {
    if (/à confirmer/i.test(t)) m.push({ nature: 'à confirmer', texte: t })
    if (/repérages? indicatifs?/i.test(t)) m.push({ nature: 'repérage indicatif', texte: t })
  }
  if (!m.some((e) => e.nature === 'repérage indicatif')) m.push({ nature: 'repérage indicatif', texte: 'Étape 6, zones à fort potentiel : repérages indicatifs, à vérifier sur le terrain' })
  return m
}

const carteDe = (c: Cadre): CarteExport['map'] => c.exporter.carte()

/** Avec carte : rien. Sans carte : chaque étape est ouverte quand même, le temps de publier ses lignes. */
async function ouvrirSansCarte(c: Cadre, ids: ModeOng[]) {
  for (const id of ids) {
    await c.exporter.activer(id).catch(() => undefined)
    await pause(1200)
  }
}

function terminerExport(format: FormatExport, message: string, erreur: boolean) {
  maj({ enCours: null, message, erreur, cadrage: null })
  // Le focus revient au bouton de l'étape 7 (remontée)
  setTimeout(() => document.querySelector<HTMLElement>(`#${ID_BOUTON[format]} button`)?.focus(), 50)
}

export async function exporterDossierOng(x: ContexteExport) {
  if (etat.enCours) return
  const { cadre } = x
  maj({ enCours: 'dossier', message: null, erreur: false })
  const barre = ouvrirBarre('Export du dossier national')
  const map = carteDe(cadre)
  try {
    if (!map) await ouvrirSansCarte(cadre, ETAPES)
    const etapes = ETAPES.map((id, i) => etape(cadre, id, i + 1))
    const d = cadre.ref.departements.find((dep) => dep.code_departement === cadre.selection)
    const resultat = await exporterDossierNational(
      {
        organisation: cadre.user.organisation?.nom ?? 'non disponible',
        annee: cadre.annee,
        campagne: String(cadre.annee),
        culture: (cadre.culture ? libelle(cadre.culture) : 'toutes cultures') + (d ? ` · sélection : ${d.departement}` : ''),
        intrant: x.intrant?.nom_intrant ?? 'non disponible',
        scenario: x.scenario.libelle,
        prix: intrantsChiffres(cadre.ref).map((i) => {
          const tape = lireNombre(x.dossier.prix[i.code_intrant])
          const p = x.prix?.filter((l) => l.code_intrant === i.code_intrant).sort((a, b) => (a.campagne === cadre.annee ? -1 : b.campagne === cadre.annee ? 1 : b.campagne - a.campagne))[0]
          return tape !== null && tape > 0
            ? { produit: i.nom_intrant, prix: fcfa(tape), unite: 'sac de 50 kg', origine: 'saisi par vous' }
            : { produit: i.nom_intrant, prix: p?.prix_cession_sac_50kg_fcfa == null ? null : fcfa(p.prix_cession_sac_50kg_fcfa), unite: 'sac de 50 kg', origine: p ? `prix de cession ${p.campagne} (${p.statut_validation === 'A_CONFIRMER' ? 'à confirmer' : p.statut_validation === 'VALIDEE' ? 'validé' : 'à saisir'})` : 'non disponible' }
        }),
        etapes,
        get repartition() { return tableauEtape(cadre, 'repartir', false)! },
        sources: sources(x),
        get mentions() {
          const textes = ETAPES.flatMap((id) => [...(lire(cadre, id)?.lignes.map((l) => l.texte) ?? []), ...(lire(cadre, id)?.tableau?.lignes.flat() ?? [])])
          return mentions(x, textes)
        },
        limites: [
          'Répartition : une proposition indicative de la solution, à ajuster puis valider par votre organisation.',
          'Besoins : besoins de référence historiques, pas des besoins prévisionnels.',
        ],
        contoursGadm: true,
      },
      { map, webgl: map !== null, restaurer: () => cadre.exporter.activer('exporter').catch(() => undefined) },
      (p) => barre.maj(p),
    )
    if (!map) await cadre.exporter.activer('exporter').catch(() => undefined)
    const avertissementIA = resultat.explicationsIA ? '' : ` Les explications IA étaient indisponibles (${resultat.avertissementIA ?? 'erreur inconnue'}) : des repères de lecture sans IA ont été ajoutés.`
    terminerExport('dossier', (map ? `Dossier exporté : ${resultat.nomFichier} (${resultat.nbPages} pages).` : `${CARTE_ABSENTE_MSG} Fichier : ${resultat.nomFichier}.`) + avertissementIA, !map)
  } catch (e) {
    await cadre.exporter.activer('exporter').catch(() => undefined)
    terminerExport('dossier', `L'export a échoué : ${e instanceof Error ? e.message : 'erreur inconnue'}. Réessayez.`, true)
  } finally {
    barre.fermer()
  }
}

/** La ligne du département dans la checklist d'une étape, si l'étape montre bien ce département. */
function ligneDep(c: Cadre, id: ModeOng, nom: string, rang: number, tous = false): string | null {
  const e = lire(c, id)
  if (!e || !(e.titre === nom || e.titre.startsWith(`${nom} `))) return null
  const l = tous ? e.lignes.map((x) => sansGras(x.texte)).join(' ; ') : e.lignes[rang] && sansGras(e.lignes[rang].texte)
  return l || null
}

export async function exporterFicheOng(x: ContexteExport) {
  const { cadre } = x
  const code = cadre.selection
  if (etat.enCours || !code) return
  const dep = cadre.ref.departements.find((d) => d.code_departement === code)
  const nom = dep?.departement ?? code
  maj({ enCours: 'fiche', message: null, erreur: false })
  const barre = ouvrirBarre(`Export de la fiche ${nom}`)
  const map = carteDe(cadre)
  const total = ETAPES.length + 2
  try {
    // Les étapes publient les lignes du département choisi : on les ouvre une à une pour les lire
    for (const [i, id] of ETAPES.entries()) {
      barre.maj({ fait: i, total, libelle: `Lecture de l'étape ${i + 1} : ${questionOng(id)}` })
      await ouvrirEtape(cadre, id).catch(() => pause(1200))
    }
    barre.maj({ fait: ETAPES.length, total, libelle: 'Carte du département' })
    await cadre.exporter.activer('exporter').catch(() => undefined)

    const ligneCh = x.ch?.find((l) => l.code_departement === code)
    const phase = ligneCh?.phase_retenue ?? null
    const src = sources(x)
    const nomSource = (id: string) => src.find((s) => s.id === id)?.nom ?? null
    const saison = lire(cadre, 'saison')
    const lignesSaison = saison?.lignes.map((l) => sansGras(l.texte)).join(' ; ')
    const rangRep = lire(cadre, 'repartir')?.tableau?.lignes.find((l) => l[0] === nom)
    const stockSaisi = Boolean(lire(cadre, 'repartir')?.tableau)
    const val = (texte: string | null | undefined, source: string | null, siAbsent: Valeur['siAbsent'] = 'non disponible', mention?: Valeur['mention']): Valeur => ({ texte: texte ?? null, source, siAbsent, mention })

    const intrants = intrantsChiffres(cadre.ref).sort((a, b) => (a.code_intrant === x.intrant?.code_intrant ? -1 : b.code_intrant === x.intrant?.code_intrant ? 1 : 0))
    const besoins: BesoinFiche[] = []
    // Culture choisie : ses seules lignes (la fiche tient sur une page) ; sinon toutes les cultures du département
    for (const t of (x.territoires ?? []).filter((l) => l.code_departement === code && (!cadre.culture || l.culture === cadre.culture))) {
      for (const i of intrants) {
        const v = i.colonne_besoin === 'besoin_semences_retenu_t' && !t.besoin_semences_applicable ? null : t[i.colonne_besoin]
        if (v === 0) continue // produit absent de la formule : besoin nul, non listé
        besoins.push({ culture: libelle(t.culture), produit: i.nom_intrant, sacs: v === null ? null : nombre(sacsDeTonnes(v)), siAbsent: 'dose à saisir', source: 'mart_territoires_agrodistrib' })
      }
    }

    const resultat = await exporterFicheDepartement(
      {
        organisation: cadre.user.organisation?.nom ?? 'non disponible',
        annee: cadre.annee,
        departement: { code, nom: nomLisible(nom), region: dep?.region ?? null, zone: dep?.zone_agroecologique ? libelle(dep.zone_agroecologique) : null },
        phaseCh: {
          phase, nom: ligneCh?.libelle_phase_retenue ?? null, couleur: x.phases?.find((p) => p.phase === phase)?.couleur ?? null,
          periode: ligneCh ? periodeCH(ligneCh) : null, source: ligneCh ? `${nomSource('cadre_harmonise')} ; cycle ${ligneCh.libelle_cycle ?? 'non disponible'}` : null,
        },
        saisonPrevue: val(saison && lignesSaison ? `${sansGras(saison.titre)} ; ${lignesSaison}` : null, `${MODELES.M1.nom} (${MODELES.M1.fiabilite})`),
        risqueRecolte: val(ligneDep(cadre, 'alerte', nom, 0), `${MODELES.M3.nom} (${MODELES.M3.fiabilite})`),
        vulnerabilite: val(ligneDep(cadre, 'campagne', nom, 1), nomSource('vulnerabilite')),
        besoins,
        // Sans ligne de besoin ici, l'étape 4 peut afficher le total du pays sous le nom du département : pas de budget
        budget: val(besoins.length ? ligneDep(cadre, 'besoins', nom, 1) : null, `besoin de l'étape 4 (${x.intrant?.nom_intrant ?? 'intrant'}) × prix : dim_prix_intrant ou saisi par vous`),
        quantiteProposee: stockSaisi
          ? val(rangRep && rangRep[2] !== '—' ? `${rangRep[2]} sur un besoin de ${rangRep[1]} (${rangRep[3]} du besoin), ${rangRep[4]} sacs ; budget : ${rangRep[5]}` : null, `scénario ${x.scenario.libelle.toLowerCase()}, ${SOURCE_REPARTITION}`)
          : val(null, `scénario ${x.scenario.libelle.toLowerCase()} : stock à saisir à l'étape 5`, 'à saisir'),
        dateLimiteLivraison: val(rangRep && rangRep[6] && rangRep[6] !== '—' ? rangRep[6] : null, `${MODELES.M4.nom} : début de la décade de semis conseillée (${MODELES.M4.fiabilite})`),
        contreSaison: val(ligneDep(cadre, 'potentiel', nom, 0), nomSource('opportunites'), 'non disponible', 'repérage indicatif'),
        // Sources de la fiche : les mêmes, en une ligne chacune (la page est comptée)
        sources: src.map((s) => (s.id === 'cadre_harmonise' ? { id: s.id, nom: 'Cadre harmonisé (CILSS et partenaires, via HDX)', date: s.date, licence: s.licence } : s.id === 'doses_pia' ? s : { id: s.id, nom: s.nom, date: s.date, licence: s.licence })),
        legende: x.phases ? { titre: `Cadre harmonisé${ligneCh?.libelle_cycle ? `, ${ligneCh.libelle_cycle}` : ''}`, entrees: x.phases.map((p) => ({ couleur: p.couleur, libelle: `${p.phase} ${p.libelle}` })) } : undefined,
        contoursGadm: true,
      },
      {
        map, webgl: map !== null,
        // L'étape 7 cadre la carte sur le département (cadrer.departement) et colore les phases du Cadre harmonisé
        activer: async () => {
          maj({ cadrage: code })
          await pause(1200)
        },
        restaurer: async () => maj({ cadrage: null }),
      },
    )
    barre.maj({ fait: total, total, libelle: 'Fiche prête' })
    const avertissementIA = resultat.explicationsIA ? '' : ` Les explications IA étaient indisponibles (${resultat.avertissementIA ?? 'erreur inconnue'}) : un repère de lecture sans IA a été ajouté.`
    terminerExport('fiche', (map ? `Fiche exportée : ${resultat.nomFichier}.` : `${CARTE_ABSENTE_MSG} Fichier : ${resultat.nomFichier}.`) + avertissementIA, !map)
  } catch (e) {
    await cadre.exporter.activer('exporter').catch(() => undefined)
    terminerExport('fiche', `L'export a échoué : ${e instanceof Error ? e.message : 'erreur inconnue'}. Réessayez.`, true)
  } finally {
    maj({ cadrage: null })
    barre.fermer()
  }
}
