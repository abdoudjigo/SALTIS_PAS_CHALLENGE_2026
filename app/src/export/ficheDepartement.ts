// Fiche département (une page, pour le comité départemental) : carte cadrée sur le département,
// phase CH, saison, risques, besoins en sacs, budget, scénario, livraison, contre-saison, sources.
import { attendreRepos, capturerCarte } from './capture'
import { CAPTURE_ECHOUEE, CARTE_ABSENTE } from './dossierNational'
import { BAS, creerDocument, LARGEUR_UTILE, MARGE, Redacteur, terminer } from './pdf'
import { redigerExplications } from './explication'
import { dateHeureFr, ligneSource, NON_DISPONIBLE, pdfTexte, slug, sourcesCompletes, valeurTexte } from './texte'
import type { CarteFiche, DonneesFiche, Legende, OptionsExport, ResultatExport, Valeur } from './types'

/** Couleurs officielles des phases du Cadre harmonisé (1 à 5) et leurs noms. */
export const PHASES_CH = [
  { phase: 1, nom: 'Minimale', couleur: '#CDFACD' },
  { phase: 2, nom: 'Sous pression', couleur: '#FAE61E' },
  { phase: 3, nom: 'Crise', couleur: '#E67800' },
  { phase: 4, nom: 'Urgence', couleur: '#C80000' },
  { phase: 5, nom: 'Famine', couleur: '#640000' },
]

export const LEGENDE_CH: Legende = {
  titre: 'Phase du Cadre harmonisé',
  entrees: PHASES_CH.map((p) => ({ couleur: p.couleur, libelle: `${p.phase} ${p.nom}` })),
}

export const nomFiche = (departement: string, annee: number) => `fiche-${slug(departement)}-${annee}.pdf`

const SOURCES_RESERVEES_MM = 34

export async function exporterFicheDepartement(
  donnees: DonneesFiche,
  carte: CarteFiche,
  { telecharger = true }: OptionsExport = {},
): Promise<ResultatExport> {
  const date = donnees.dateExport ?? new Date()
  const map = carte.webgl ? carte.map : null
  let image: string | null = null
  if (map) {
    try {
      await carte.activer?.()
      await attendreRepos(map)
      image = await capturerCarte(map)
    } catch {
      image = null
    } finally {
      if (carte.restaurer) await carte.restaurer()
    }
  }

  const { departement: dep } = donnees
  const redaction = await redigerExplications([{
    id: 'fiche',
    titre: `Indicateurs de ${dep.nom}`,
    contexte: [
      `Phase du Cadre harmonisé : ${donnees.phaseCh.phase ?? NON_DISPONIBLE} ${donnees.phaseCh.nom ?? ''} ${donnees.phaseCh.periode ?? ''}`,
      `Saison prévue : ${valeurTexte(donnees.saisonPrevue)} ; risque récolte : ${valeurTexte(donnees.risqueRecolte)} ; vulnérabilité : ${valeurTexte(donnees.vulnerabilite)}`,
      `Besoins par culture et produit : ${donnees.besoins.slice(0, 5).map((b) => `${b.culture}, ${b.produit}, ${b.sacs ?? b.siAbsent ?? NON_DISPONIBLE} sacs`).join(' ; ')}`,
      `Budget : ${valeurTexte(donnees.budget)} ; quantité proposée : ${valeurTexte(donnees.quantiteProposee)} ; date limite : ${valeurTexte(donnees.dateLimiteLivraison)}`,
      `Contre-saison : ${valeurTexte(donnees.contreSaison)}.`,
    ].join('. ').slice(0, 1_800),
  }])

  const doc = await creerDocument()
  const r = new Redacteur(doc, `Fiche département ${dep.nom} · ${donnees.annee}`)
  r.texte(`Fiche département : ${dep.nom}`, { taille: 17, style: 'bold', apres: 0.5 })
  const lieu = [dep.region && `région ${dep.region}`, dep.zone && `zone ${dep.zone}`].filter(Boolean).join(' · ')
  r.texte(`Campagne ${donnees.annee}${lieu ? ` · ${lieu}` : ''} · ${donnees.organisation} · ${dateHeureFr(date)}`, { taille: 9, gris: true, apres: 2.5 })
  r.texte(
    `${redaction.iaDisponible ? 'Lecture assistée par IA' : 'Repère de lecture · IA indisponible'} : ${redaction.textes.fiche}`,
    { taille: 7.5, gris: true, apres: 1.5 },
  )

  // Carte à gauche, indicateurs clés à droite
  const yHaut = r.y
  const largeurCarte = 92
  r.carte(image, map ? CAPTURE_ECHOUEE : CARTE_ABSENTE, 58, largeurCarte)
  r.legende(donnees.legende ?? LEGENDE_CH, largeurCarte)
  const yApresCarte = r.y

  const phase = PHASES_CH.find((p) => p.phase === donnees.phaseCh.phase)
  const xD = MARGE + largeurCarte + 5
  const largeurD = LARGEUR_UTILE - largeurCarte - 5
  let y = yHaut
  const bloc = (titre: string, texte: string, source?: string | null, couleur?: string) => {
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor('#5F6670')
    doc.text(titre, xD, y, { baseline: 'top' })
    y += 3.6
    let x = xD
    if (couleur) {
      doc.setFillColor(couleur).setDrawColor('#C8CCD1').rect(xD, y + 0.3, 4, 3.6, 'FD')
      x += 5.5
    }
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor('#1F2328')
    const lignes: string[] = doc.splitTextToSize(pdfTexte(texte), largeurD - (x - xD))
    doc.text(lignes, x, y, { baseline: 'top' })
    y += lignes.length * 4.4
    if (source) {
      doc.setFontSize(7).setTextColor('#5F6670')
      const ls: string[] = doc.splitTextToSize(pdfTexte(`Source : ${source}`), largeurD)
      doc.text(ls, xD, y, { baseline: 'top' })
      y += ls.length * 3.1
    }
    y += 1.8
  }
  const valeur = (titre: string, v: Valeur) => bloc(titre, valeurTexte(v) + (v.mention ? ` (${v.mention})` : ''), v.source)
  bloc(
    'Phase du Cadre harmonisé',
    donnees.phaseCh.phase !== null
      ? `Phase ${donnees.phaseCh.phase} : ${donnees.phaseCh.nom ?? phase?.nom ?? ''}${donnees.phaseCh.periode ? ` (${donnees.phaseCh.periode})` : ''}`
      : NON_DISPONIBLE,
    donnees.phaseCh.source,
    donnees.phaseCh.phase !== null ? donnees.phaseCh.couleur ?? phase?.couleur : undefined,
  )
  valeur('Saison prévue', donnees.saisonPrevue)
  valeur('Risque récolte', donnees.risqueRecolte)
  valeur('Vulnérabilité', donnees.vulnerabilite)
  valeur('Contre-saison', donnees.contreSaison)

  // Seconde rangée : scénario, budget, livraison
  r.y = Math.max(yApresCarte, y) + 1
  r.sousTitre('Scénario et livraison')
  r.champ('Quantité proposée', valeurTexte(donnees.quantiteProposee), donnees.quantiteProposee.source)
  r.champ('Budget', valeurTexte(donnees.budget), donnees.budget.source)
  r.champ('Livraison avant le', valeurTexte(donnees.dateLimiteLivraison), donnees.dateLimiteLivraison.source)

  // Besoins : tout ce qui tient au-dessus des sources, sans jamais créer de deuxième page
  r.sousTitre('Besoins par culture et produit')
  const sourcesBesoins = [...new Set(donnees.besoins.map((b) => b.source).filter(Boolean))]
  const { dessinees, total } = r.tableau(
    {
      colonnes: ['Culture', 'Produit', 'Sacs', 'Source'],
      largeurs: [3, 3, 1.5, 4.5],
      lignes: donnees.besoins.map((b) => [b.culture, b.produit, b.sacs ?? b.siAbsent ?? null, b.source]),
      note: sourcesBesoins.length ? undefined : 'Source des besoins : non disponible.',
    },
    BAS - SOURCES_RESERVEES_MM,
  )
  if (dessinees < total) r.texte(`${total - dessinees} ligne(s) non affichée(s) : voir l'étape 4 de l'application (Combien faut-il ?).`, { taille: 7.5, gris: true })

  r.y = Math.max(r.y, BAS - SOURCES_RESERVEES_MM + 2)
  r.texte('Sources', { taille: 9, style: 'bold', apres: 0.5 })
  for (const s of sourcesCompletes(donnees.sources, donnees.contoursGadm)) {
    if (r.y > BAS - 3) break
    r.texte(`- ${ligneSource(s)}`, { taille: 7, retrait: 1, apres: 0.2 })
  }
  // garde-fou : la fiche tient sur une page
  while (doc.getNumberOfPages() > 1) doc.deletePage(doc.getNumberOfPages())

  const nbPages = r.finaliser(date)
  const nomFichier = nomFiche(dep.nom, donnees.annee)
  return {
    nomFichier,
    octets: terminer(doc, nomFichier, telecharger),
    nbPages,
    explicationsIA: redaction.iaDisponible,
    avertissementIA: redaction.avertissement,
  }
}
