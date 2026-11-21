// ONG, étape 7 — « Exporter le dossier » : deux PDF produits dans le navigateur (moteur app/src/export/, phase D2).
// - Dossier national : l'export ouvre les étapes 1 à 6 une à une (cadre.exporter.activer), capture leur carte et lit
//   leur sortie, puis rouvre cette étape ;
// - Fiche département : une page sur le département choisi, carte cadrée sur lui (cadrer.departement), phases du
//   Cadre harmonisé. Désactivée tant qu'aucun département n'est choisi.
// L'état de l'export (en cours, message) vit hors du composant (export/ong.ts) : l'étape est démontée pendant l'export.
import { FileDown } from 'lucide-react'
import { useMemo, useSyncExternalStore } from 'react'
import { abonnerEtatExport, exporterDossierOng, exporterFicheOng, ID_BOUTON, lireEtatExport, type ContexteExport } from '../../export/ong'
import { useCadreHarmonise, usePhasesCadreHarmonise, usePrixIntrants, useTerritoires } from '../../hooks/donnees'
import { couleurPhase } from '../regles/cadreHarmonise'
import { libelle } from '../../lib/format'
import { cadrer, PARCOURS_ONG, questionOng, usePublier, type PropsMode, type Sortie } from '../cadre'
import { aLire, type LigneCheck } from '../interface/fiche'
import { FicheReponse } from '../interface/FicheReponse'
import { useDossier } from '../ong/dossier'
import { fcfa, intrantOng } from '../ong/ong'
import { lireNombre } from '../../lib/saisie'
import { SCENARIOS } from '../regles/repartition'
import { Avis, Bouton, Groupe, Ligne, Lignes, Marque } from '../interface/ui'

export default function Exporter({ cadre, publier }: PropsMode) {
  const { dossier } = useDossier()
  const { data: listePrix } = usePrixIntrants()
  const { data: ch } = useCadreHarmonise()
  const { data: phases } = usePhasesCadreHarmonise()
  const { data: territoires } = useTerritoires()
  const etat = useSyncExternalStore(abonnerEtatExport, lireEtatExport)
  const code = cadre.selection
  const nomDep = code ? cadre.ref.departements.find((d) => d.code_departement === code)?.departement ?? code : null
  const intrant = intrantOng(cadre.ref, dossier)
  const scenario = SCENARIOS.find((s) => s.id === dossier.scenario) ?? SCENARIOS[0]
  // Seuls les prix lisibles et positifs comptent (même lecture que les étapes 4 et 5)
  const prixSaisis = Object.entries(dossier.prix).flatMap(([code, texte]) => {
    const n = lireNombre(texte)
    return n !== null && n > 0 ? [[code, n] as const] : []
  })
  const stock = lireNombre(dossier.stock)
  const titre = 'Exporter le dossier'
  const lignes: LigneCheck[] = [
    { etat: 'info', texte: `Le dossier reprend les **${PARCOURS_ONG.length - 1}** étapes du parcours` },
    { etat: 'info', texte: `Campagne **${cadre.annee}**, ${cadre.culture ? libelle(cadre.culture).toLowerCase() : 'toutes cultures'}, ${intrant?.nom_intrant ?? 'intrant non choisi'}` },
    { etat: 'info', texte: `Scénario **${scenario.libelle.toLowerCase()}** · ${prixSaisis.length} prix saisi${prixSaisis.length > 1 ? 's' : ''} par vous` },
  ]
  const cleLignes = lignes.map((l) => l.texte).join('|')

  const sortie = useMemo<Sortie>(() => ({
    aEcouter: aLire(titre, lignes),
    resume: titre,
    // Fiche en cours : la carte se cadre sur le département et montre les phases du Cadre harmonisé
    vue: etat.cadrage
      ? { ambiance: 'jour', camera: cadrer.departement(cadre, etat.cadrage), zones: null, relief: false, selection: etat.cadrage, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [],
        departements: ch ? new Map(cadre.ref.departements.map((d) => [d.code_departement, { couleur: couleurPhase(phases, ch.find((l) => l.code_departement === d.code_departement)?.phase_retenue) }])) : null }
      : { ambiance: 'jour', camera: cadrer.pays(cadre), zones: null, relief: false, selection: cadre.selection, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [], departements: null },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lignes` est résumé par `cleLignes`
  }), [cadre, cleLignes, etat.cadrage, ch, phases])
  usePublier(publier, sortie)
  const contexte = (): ContexteExport => ({ cadre, dossier, intrant, scenario, prix: listePrix, ch, phases, territoires })

  return (
    <FicheReponse cadre={cadre} mode="exporter" cle="exporter" titre={titre} lignes={lignes} aEcouter={sortie.aEcouter}
      etat={
        <div className="mt-4 grid gap-2">
          <div id={ID_BOUTON.dossier}>
            <Bouton plein disabled={etat.enCours !== null} onClick={() => void exporterDossierOng(contexte())} decritPar="export-dossier-aide" className="w-full justify-center">
              <FileDown className="size-4" aria-hidden />{etat.enCours === 'dossier' ? 'Export du dossier en cours…' : 'Télécharger le dossier national (PDF)'}
            </Bouton>
          </div>
          <p id="export-dossier-aide" className="text-2xs leading-snug text-white/60">Page de garde, une page par étape avec sa carte, sa checklist et son tableau, la répartition complète, puis les sources. L'export ouvre chaque étape : la carte bouge, ne touchez à rien.</p>
          <div id={ID_BOUTON.fiche}>
            <Bouton disabled={etat.enCours !== null || !code} onClick={() => void exporterFicheOng(contexte())} decritPar="export-fiche-aide" className="w-full justify-center">
              <FileDown className="size-4" aria-hidden />{etat.enCours === 'fiche' ? 'Export de la fiche en cours…' : nomDep ? `Télécharger la fiche ${nomDep} (PDF)` : 'Télécharger la fiche département (PDF)'}
            </Bouton>
          </div>
          <p id="export-fiche-aide" className="text-2xs leading-snug text-white/60">{nomDep ? `Une page pour ${nomDep} : carte, Cadre harmonisé, saison, risques, besoins en sacs, budget, quantité proposée, date limite, contre-saison et sources.` : 'Choisissez un département sur la carte : la fiche département s’active.'}</p>
          <div aria-live="polite">
            {etat.message && (etat.erreur ? <Avis>{etat.message}</Avis> : <p className="text-xs leading-snug text-white/75">{etat.message}</p>)}
          </div>
        </div>
      }
      detail={<>
        <Groupe titre="Contenu prévu du dossier">
          <ol className="space-y-1 text-sm text-white/75">
            {PARCOURS_ONG.filter((p) => p.id !== 'exporter').map((p, i) => <li key={p.id}>{i + 1}. {questionOng(p.id)}</li>)}
          </ol>
        </Groupe>
        <Groupe titre="Vos choix, repris dans le dossier">
          <Lignes>
            <Ligne libelle="Département choisi" valeur={cadre.selection ? cadre.ref.departements.find((d) => d.code_departement === cadre.selection)?.departement ?? cadre.selection : 'tout le pays'} />
            <Ligne libelle="Stock saisi" valeur={stock !== null && stock > 0 ? `${stock.toLocaleString('fr-FR')} ${dossier.unite === 'sacs' ? 'sacs' : 't'}` : 'à saisir'} />
            {prixSaisis.map(([code, prix]) => (
              <Ligne key={code} libelle={`Prix d'achat · ${cadre.ref.intrants.find((i) => i.code_intrant === code)?.nom_intrant ?? code}`} valeur={<span className="inline-flex items-center gap-2">{fcfa(prix)} / sac <Marque>saisi par vous</Marque></span>} />
            ))}
          </Lignes>
        </Groupe>
      </>} />
  )
}
