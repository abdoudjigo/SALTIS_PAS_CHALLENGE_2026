// Dossier national de campagne : page de garde, une page par étape (carte capturée avec la même
// sélection), répartition complète de l'étape 5, page « Sources, fiabilité et limites ».
import { MODELES } from '../scene/regles/fiabilite'
import { attendreRepos, capturerCarte } from './capture'
import { creerDocument, Redacteur, terminer } from './pdf'
import { dateHeureFr, dateIso, estFumier, ligneSource, sourcesCompletes } from './texte'
import { redigerExplications, type SectionExplication } from './explication'
import type { CarteExport, DonneesDossier, Etape, NatureMention, OptionsExport, Progression, ResultatExport } from './types'

export const CARTE_ABSENTE = 'carte non disponible sur cet appareil'
export const CAPTURE_ECHOUEE = 'capture de la carte impossible'
const NATURES: NatureMention[] = ['à confirmer', 'saisi par vous', 'repérage indicatif']
const MAX_CONTEXTE_EXPLICATION = 1_200
const LIMITES = [
  "Les cartes sont celles affichées au moment de l'export, avec la sélection en cours.",
  "Ce qui manque est écrit « non disponible » ou « à saisir », jamais 0.",
]

export const nomDossier = (annee: number, d: Date) => `dossier-campagne-${annee}-${dateIso(d)}.pdf`

function ajouterExplication(r: Redacteur, texte: string, iaDisponible: boolean) {
  r.sousTitre(iaDisponible ? 'Explication rédigée par IA' : 'Repère de lecture · IA indisponible')
  r.texte(texte, { taille: 9.5, gris: true, apres: 2 })
}

function pageDeGarde(r: Redacteur, d: DonneesDossier, date: Date, explication: string, iaDisponible: boolean) {
  r.y = 40
  r.texte('Dossier de campagne', { taille: 24, style: 'bold', apres: 2 })
  r.texte(`Campagne ${d.campagne}`, { taille: 14, gris: true, apres: 12 })
  r.champ('Organisation', d.organisation)
  r.champ('Exporté le', dateHeureFr(date))
  r.champ('Campagne', d.campagne)
  r.champ('Culture', d.culture)
  r.champ('Intrant', estFumier(d.intrant) ? 'non disponible' : d.intrant)
  r.champ('Scénario', d.scenario)
  ajouterExplication(r, explication, iaDisponible)
  r.sousTitre('Prix des intrants (saisis par vous ou publiés)')
  r.tableau({
    colonnes: ['Produit', 'Prix', 'Unité', 'Origine'],
    largeurs: [3, 2, 2, 3],
    lignes: d.prix.map((p) => [p.produit, p.prix ?? 'à saisir', p.unite, p.origine]),
  })
}

function pageEtape(r: Redacteur, e: Etape, image: string | null, note: string, explication: string, iaDisponible: boolean) {
  r.titre(`Étape ${e.id} · ${e.titre}`)
  r.texte(e.question, { taille: 10.5, style: 'italic', gris: true, apres: 3 })
  ajouterExplication(r, explication, iaDisponible)
  r.carte(image, note, 110)
  if (e.legende) r.legende(e.legende)
  if (e.checklist.length) {
    r.sousTitre('Checklist')
    r.checklist(e.checklist)
  }
  if (e.tableau) {
    r.sousTitre('En bref')
    r.tableau(e.tableau)
  }
}

function pageSources(r: Redacteur, d: DonneesDossier, explication: string, iaDisponible: boolean) {
  r.nouvellePage()
  r.titre('Sources, fiabilité et limites')
  ajouterExplication(r, explication, iaDisponible)
  r.sousTitre('Sources')
  for (const s of sourcesCompletes(d.sources, d.contoursGadm)) r.texte(`- ${ligneSource(s)}`, { taille: 9, retrait: 2 })
  r.sousTitre('Mentions à signaler')
  for (const n of NATURES) {
    const liste = d.mentions.filter((m) => m.nature === n && !estFumier(m.texte))
    r.texte(`« ${n} »`, { taille: 9.5, style: 'bold', apres: 0.5 })
    if (!liste.length) r.texte('aucune', { taille: 9, gris: true, retrait: 2 })
    for (const m of liste) r.texte(`- ${m.texte}`, { taille: 9, retrait: 2, apres: 0.5 })
    r.y += 1
  }
  r.sousTitre('Fiabilité des modèles')
  const fiabilite = d.fiabilite?.length ? d.fiabilite : Object.values(MODELES).map((m) => `${m.nom} : ${m.fiabilite}.`)
  for (const f of fiabilite) r.texte(`- ${f}`, { taille: 9, retrait: 2 })
  r.sousTitre('Limites')
  for (const l of [...(d.limites ?? []), ...LIMITES]) r.texte(`- ${l}`, { taille: 9, retrait: 2 })
}

/**
 * Fabrique le dossier national dans le navigateur. Pour chaque étape : activer(), attente de 'idle',
 * capture, puis étape suivante ; la vue de départ est restaurée à la fin, même en cas d'erreur.
 */
export async function exporterDossierNational(
  donnees: DonneesDossier,
  carte: CarteExport,
  onProgression?: (p: Progression) => void,
  { telecharger = true }: OptionsExport = {},
): Promise<ResultatExport> {
  const date = donnees.dateExport ?? new Date()
  const total = donnees.etapes.length + 2
  const signaler = (fait: number, libelle: string) => onProgression?.({ fait, total, libelle })
  signaler(0, 'Préparation du document')
  const map = carte.webgl ? carte.map : null
  const pages: { etape: Etape; image: string | null }[] = []
  try {
    for (const [i, etape] of donnees.etapes.entries()) {
      signaler(i + 1, `Étape ${etape.id} : ${etape.titre}`)
      let image: string | null = null
      if (map) {
        try {
          await etape.activer()
          await attendreRepos(map)
          image = await capturerCarte(map)
        } catch {
          image = null
        }
      }
      pages.push({
        etape: {
          id: etape.id,
          titre: etape.titre,
          question: etape.question,
          checklist: etape.checklist,
          tableau: etape.tableau,
          legende: etape.legende,
          activer: etape.activer,
        },
        image,
      })
    }
  } finally {
    if (map && carte.restaurer) await carte.restaurer()
  }

  const resumeTableau = (lignes: (string | number | null | undefined)[][]) => {
    const visibles = [...lignes.slice(0, 3), ...(lignes.length > 3 ? [lignes[lignes.length - 1]] : [])]
    return visibles.map((ligne) => ligne.join(' · ')).join(' ; ')
  }
  const sections: SectionExplication[] = [
    {
      id: 'couverture',
      titre: 'Paramètres de campagne',
      contexte: `Campagne ${donnees.campagne} ; culture ${donnees.culture} ; intrant ${donnees.intrant} ; scénario ${donnees.scenario}. La page de garde précise les choix retenus et les prix disponibles.`,
    },
    ...pages.map(({ etape }) => ({
      id: `etape-${etape.id}`,
      titre: etape.titre,
      contexte: [
        `Question : ${etape.question}`,
        `Checklist : ${etape.checklist.map((l) => l.texte).join(' ; ')}`,
        etape.tableau ? `Colonnes : ${etape.tableau.colonnes.join(' ; ')}. Lignes d'exemple (premières et total) : ${resumeTableau(etape.tableau.lignes)}.` : '',
      ].filter(Boolean).join(' ').slice(0, MAX_CONTEXTE_EXPLICATION),
    })),
    {
      id: 'repartition',
      titre: 'Répartition complète',
      contexte: `Tableau de répartition de campagne. Colonnes : ${donnees.repartition.colonnes.join(' ; ')}. Lignes d'exemple (premières et total) : ${resumeTableau(donnees.repartition.lignes)}.`.slice(0, MAX_CONTEXTE_EXPLICATION),
    },
    {
      id: 'sources',
      titre: 'Sources, fiabilité et limites',
      contexte: [
        `Sources : ${donnees.sources.map((s) => s.nom).join(' ; ')}`,
        `Mentions à signaler : ${donnees.mentions.map((m) => `${m.nature} : ${m.texte}`).join(' ; ')}`,
        `Limites : ${[...(donnees.limites ?? []), ...LIMITES].join(' ; ')}`,
      ].join('. ').slice(0, MAX_CONTEXTE_EXPLICATION),
    },
  ]
  signaler(donnees.etapes.length + 1, 'Rédaction des explications')
  const redaction = await redigerExplications(sections)
  const texte = (id: string) => redaction.textes[id]

  const doc = await creerDocument()
  const r = new Redacteur(doc, `Dossier de campagne ${donnees.annee}`)
  pageDeGarde(r, donnees, date, texte('couverture'), redaction.iaDisponible)
  for (const { etape, image } of pages) {
    r.nouvellePage()
    pageEtape(r, etape, image, map ? CAPTURE_ECHOUEE : CARTE_ABSENTE, texte(`etape-${etape.id}`), redaction.iaDisponible)
  }

  signaler(donnees.etapes.length + 1, 'Répartition complète et sources')
  r.nouvellePage()
  r.titre('Répartition complète (étape 5)')
  ajouterExplication(r, texte('repartition'), redaction.iaDisponible)
  r.tableau(donnees.repartition)
  pageSources(r, donnees, texte('sources'), redaction.iaDisponible)
  const nbPages = r.finaliser(date)
  const nomFichier = nomDossier(donnees.annee, date)
  const octets = terminer(doc, nomFichier, telecharger)
  signaler(total, 'Dossier prêt')
  return {
    nomFichier,
    octets,
    nbPages,
    explicationsIA: redaction.iaDisponible,
    avertissementIA: redaction.avertissement,
  }
}
