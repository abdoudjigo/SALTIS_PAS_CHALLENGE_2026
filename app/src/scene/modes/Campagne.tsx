// ONG, étape 1 — « Où agir en priorité ? » : les départements à surveiller pour la campagne choisie.
// Signaux côte à côte, chacun avec sa pastille : pluie attendue (modèle 1), risque pour la récolte (modèle 3, vu fin
// mai), vulnérabilité (mart), et la phase du Cadre harmonisé quand son cycle est celui de l'année choisie.
// On classe par nombre de signaux au rouge, jamais par un score qui les additionnerait : ils n'ont pas la même fiabilité.
// Puce « Voir » : la carte des priorités, la vulnérabilité (vue et classement de Vulnerabilite.tsx), ou le Cadre
// harmonisé (palette officielle, lue dans /referentiels/phases-cadre-harmonise).
import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { useCadreHarmonise, usePhasesCadreHarmonise, useVulnerabilite } from '../../hooks/donnees'
import { etatPrevision, useAlerteRecolte, usePrevisionSaison } from '../../hooks/previsions'
import { libelle, mm, nombre, pct } from '../../lib/format'
import type { LigneCadreHarmonise } from '../../types/marts'
import { CULTURES_RENDEMENT, SEUIL_ALERTE_PCT, type PrevisionRendement, type PrevisionSaison } from '../../types/previsions'
import { estAlerte, risqueHabituelEleve } from '../regles/alertes'
import { cadrer, questionOng, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { chCompte, couleurPhase, enCrise, etatPhase, nomPhase, periodeCH, PHASE_CRISE } from '../regles/cadreHarmonise'
import { ordonner } from '../regles/repartition'
import { NON_DISPONIBLE, tendance } from '../carte/couleurs'
import { aLire, puceAnnee, puceChoix, puceCulture, type EtatLigne, type LigneCheck } from '../interface/fiche'
import { FicheReponse } from '../interface/FicheReponse'
import { Attente, MarquesRendement, MethodeModele, Morceau } from '../previsions'
import { Categories, Groupe, Lien, Ligne, Lignes } from '../interface/ui'
import { ClassementVulnerabilite, classerVulnerabilite, ScoreVulnerabilite, vueVulnerabilite } from '../carte/vueVulnerabilite'

type Niveau = 'rouge' | 'orange' | 'calme' | 'inconnu'
const TEINTES: Record<Niveau, string> = { rouge: 'var(--color-alerte-500)', orange: 'var(--color-soleil-500)', calme: 'var(--color-vert-500)', inconnu: 'rgb(255 255 255 / 0.25)' }
/** Couleurs de la carte (Mapbox ne lit pas les variables CSS) : alerte-700, alerte-500, soleil-500, vert-100. */
const CARTE = ['#d5eadb', '#f2b544', '#d2492f', '#a3311c']
const ECART_PLUIE_PCT = 5

/** Le niveau d'un signal en pastille de la fiche. */
const ETAT_NIVEAU: Record<Niveau, EtatLigne> = { rouge: 'non', orange: 'attention', calme: 'ok', inconnu: 'info' }
type VueEtape = 'priorite' | 'vulnerabilite' | 'ch'
const VUES: { id: VueEtape; libelle: string }[] = [{ id: 'priorite', libelle: 'Voir : priorité' }, { id: 'vulnerabilite', libelle: 'Voir : vulnérabilité' }, { id: 'ch', libelle: 'Voir : Cadre harmonisé' }]

interface Dossier {
  code: string
  nom: string
  pluie: PrevisionSaison | null
  ecart: number | null
  recolte: PrevisionRendement | null
  vulnerabilite: number | null
  ch: LigneCadreHarmonise | null
  /** `ch` : inconnu quand le cycle du Cadre harmonisé n'est pas celui de l'année choisie (il n'est alors pas compté) */
  niveaux: { pluie: Niveau; recolte: Niveau; vulnerabilite: Niveau; ch: Niveau }
  rouges: number
  oranges: number
}

/** Les signaux au rouge d'un département, en mots. */
function raisons(d: Dossier): string[] {
  const r: string[] = []
  if (d.niveaux.ch === 'rouge') r.push(`Cadre harmonisé en ${nomPhase(d.ch)}`)
  if (d.niveaux.recolte === 'rouge' && d.recolte) r.push(`récolte en alerte (${pct(d.recolte.proba_chute_pct)})`)
  if (d.niveaux.vulnerabilite === 'rouge') r.push('vulnérabilité très élevée')
  if (d.niveaux.pluie === 'rouge') r.push('pluie nettement sous la normale')
  return r
}

const Point = ({ niveau }: { niveau: Niveau }) => <span className="size-2 shrink-0 rounded-full" style={{ background: TEINTES[niveau] }} aria-hidden />

export default function Campagne({ cadre, publier }: PropsMode) {
  // Les années du modèle 1, qui porte la pluie attendue ; le risque de récolte s'affiche là où le modèle 3 existe
  const a = useAnnee(cadre, 'M1')
  const { annee } = a
  const [vueCarte, setVue] = useState<VueEtape>('priorite')
  // La culture partagée, si le modèle 3 la couvre ; sinon la culture la plus exposée de chaque département
  const cultureM3 = cadre.culture && CULTURES_RENDEMENT.includes(cadre.culture) ? cadre.culture : null
  const saison = usePrevisionSaison(annee)
  const alerte = useAlerteRecolte(annee, 'FIN_MAI', cultureM3)
  const { data: vulnerabilites } = useVulnerabilite()
  const { data: ch } = useCadreHarmonise()
  const { data: phases } = usePhasesCadreHarmonise()
  const etat = etatPrevision(saison)
  const etatAlerte = etatPrevision(alerte)
  const code = cadre.selection
  const cycleCH = ch?.find((l) => l.annee_cycle !== null)?.annee_cycle ?? null
  // Une seule règle (cadreHarmonise.ts) : le Cadre harmonisé ne compte que pour l'année de son cycle
  const chCompteAnnee = chCompte(ch?.find((l) => l.annee_cycle !== null), annee)

  const dossiers = useMemo<Dossier[]>(() => {
    const pluies = new Map(saison.data?.donnees.map((l) => [l.code_departement, l]))
    const vuln = new Map(vulnerabilites?.map((v) => [v.code_departement, v]))
    const phasesCH = new Map(ch?.map((l) => [l.code_departement, l]))
    const recoltes = new Map<string, PrevisionRendement>()
    alerte.data?.donnees.forEach((l) => {
      const m = recoltes.get(l.code_departement)
      if (l.proba_chute_pct !== null && (!m || l.proba_chute_pct > m.proba_chute_pct!)) recoltes.set(l.code_departement, l)
    })
    return cadre.ref.departements.map((d) => {
      const p = pluies.get(d.code_departement) ?? null
      const r = recoltes.get(d.code_departement) ?? null
      const v = vuln.get(d.code_departement)
      const c = phasesCH.get(d.code_departement) ?? null
      const ecart = p && p.pluie_prevue_mm !== null && p.pluie_normale_mm ? (p.pluie_prevue_mm / p.pluie_normale_mm - 1) * 100 : null
      const niveaux: Dossier['niveaux'] = {
        pluie: ecart === null ? 'inconnu' : ecart <= -2 * ECART_PLUIE_PCT ? 'rouge' : ecart <= -ECART_PLUIE_PCT ? 'orange' : 'calme',
        // Rouge seulement pour une alerte fiable ; un risque habituel élevé, sans prévision de l'année, reste à l'orange
        recolte: !r ? 'inconnu' : estAlerte(r) ? 'rouge' : risqueHabituelEleve(r) || (r.proba_chute_reference_pct !== null && r.proba_chute_pct! > r.proba_chute_reference_pct) ? 'orange' : 'calme',
        vulnerabilite: !v?.classe_vulnerabilite ? 'inconnu' : v.classe_vulnerabilite.startsWith('très élevée') ? 'rouge' : v.classe_vulnerabilite.startsWith('élevée') ? 'orange' : 'calme',
        ch: !chCompteAnnee || c?.phase_retenue == null ? 'inconnu' : ({ non: 'rouge', attention: 'orange', ok: 'calme', info: 'inconnu' } as const)[etatPhase(c.phase_retenue)],
      }
      const compte = (n: Niveau) => Object.values(niveaux).filter((x) => x === n).length
      return { code: d.code_departement, nom: d.departement, pluie: p, ecart, recolte: r, vulnerabilite: v?.score_vulnerabilite ?? null, ch: c, niveaux, rouges: compte('rouge'), oranges: compte('orange') }
    }).sort((a, b) => b.rouges - a.rouges || b.oranges - a.oranges || (b.recolte?.proba_chute_pct ?? -1) - (a.recolte?.proba_chute_pct ?? -1))
  }, [saison.data, alerte.data, vulnerabilites, ch, chCompteAnnee, cadre.ref.departements])

  const aSurveiller = dossiers.filter((d) => d.rouges > 0)
  const fiche = dossiers.find((d) => d.code === code)
  const ficheVuln = vulnerabilites?.find((v) => v.code_departement === code)
  const classement = useMemo(() => classerVulnerabilite(vulnerabilites), [vulnerabilites])
  const pays = saison.data?.donnees[0]
  const t = pays ? tendance(pays) : null

  // Cadre harmonisé du pays : départements en phase 3 ou plus, personnes en phases 3 à 5 (additives)
  const crises = (ch ?? []).filter((l) => enCrise(l.phase_retenue))
  const personnes = (ch ?? []).filter((l) => l.population_phase3_5_retenue !== null)
  const totalPersonnes = personnes.reduce((s, l) => s + l.population_phase3_5_retenue!, 0)
  const tete = [...personnes].sort((x, y) => y.population_phase3_5_retenue! - x.population_phase3_5_retenue!).slice(0, 3)
  const pirePhase = (ch ?? []).reduce<number | null>((m, l) => (l.phase_retenue == null ? m : Math.max(m ?? 0, l.phase_retenue)), null)
  const periode = periodeCH(ch?.[0])
  const nbAlertes = dossiers.filter((d) => d.recolte && estAlerte(d.recolte)).length
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

  const titre = fiche ? fiche.nom : etat === 'ok' ? `${pluriel(aSurveiller.length, 'département')} à surveiller en ${annee}` : `Campagne ${annee}`
  const lignes: LigneCheck[] = fiche ? [
    !fiche.ch ? { etat: 'info', texte: 'Cadre harmonisé non disponible ici' }
      : { etat: etatPhase(fiche.ch.phase_retenue), texte: `Cadre harmonisé : **${nomPhase(fiche.ch)}**${fiche.ch.population_phase3_5_retenue !== null ? `, ${nombre(fiche.ch.population_phase3_5_retenue)} pers. en phases 3 à 5` : ''}` },
    ficheVuln?.score_vulnerabilite == null ? { etat: 'info', texte: 'Vulnérabilité non notée (données insuffisantes)' }
      : { etat: ETAT_NIVEAU[fiche.niveaux.vulnerabilite], texte: `Vulnérabilité : **${nombre(ficheVuln.score_vulnerabilite)} / 100**${ficheVuln.classe_vulnerabilite ? `, ${libelle(ficheVuln.classe_vulnerabilite).toLowerCase()}` : ''}` },
    etat !== 'ok' ? { etat: 'info', texte: `Signaux ${annee} non disponibles` }
      : { etat: fiche.rouges ? 'non' : fiche.oranges ? 'attention' : 'ok', texte: fiche.rouges ? `**${fiche.rouges}** au rouge : ${raisons(fiche).join(', ')}` : fiche.oranges ? `**${fiche.oranges}** ${fiche.oranges > 1 ? 'signaux' : 'signal'} à l’orange, aucun au rouge` : 'Aucun signal au rouge ni à l’orange' },
  ] : [
    !ch ? { etat: 'info', texte: 'Cadre harmonisé non disponible' }
      : { etat: etatPhase(pirePhase as LigneCadreHarmonise['phase_retenue']), texte: `**${pluriel(crises.length, 'département')}** en phase ${PHASE_CRISE} ou plus ; **${nombre(totalPersonnes)}** personnes en phases 3 à 5${tete.length ? `, surtout ${tete.map((l) => l.departement).join(', ')}` : ''}` },
    etatAlerte !== 'ok' ? { etat: 'info', texte: `Alerte récolte non disponible pour ${annee}` }
      : nbAlertes ? { etat: 'attention', texte: `**${pluriel(nbAlertes, 'département')}** en alerte récolte (prévision fiable, risque ≥ ${SEUIL_ALERTE_PCT} %)` }
        : { etat: 'info', texte: `Aucune alerte récolte fiable pour ${annee} : risque habituel seulement` },
    !t ? { etat: 'info', texte: `Saison ${annee} non disponible` }
      : { etat: t.classe === 'sèche' ? 'attention' : 'ok', texte: `Saison la plus probable : **${t.classe}** (${pct(t.proba)} de chances)` },
  ]
  const cleLignes = lignes.map((l) => l.texte).join('|')

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(dossiers.map((d) => [d.code, d]))
    const rang = (d: Dossier) => (d.rouges >= 2 ? 3 : d.rouges === 1 ? 2 : d.oranges > 0 ? 1 : 0)
    const vuln = vueVulnerabilite(vulnerabilites)
    const entreesPriorite = [{ couleur: CARTE[3], libelle: '2 signaux au rouge ou plus' }, { couleur: CARTE[2], libelle: '1 signal au rouge' }, { couleur: CARTE[1], libelle: 'Signal à l’orange' }, { couleur: CARTE[0], libelle: 'Rien à signaler' }]
    const entreesCH = [...(phases ?? []).map((p) => ({ couleur: p.couleur, libelle: `Phase ${p.phase} · ${p.libelle}` })), { couleur: NON_DISPONIBLE, libelle: 'Non disponible' }]
    const departements = vueCarte === 'vulnerabilite' ? vuln.departements
      : vueCarte === 'ch' ? (ch ? new Map(cadre.ref.departements.map((d) => {
        const l = ch.find((x) => x.code_departement === d.code_departement)
        return [d.code_departement, { couleur: couleurPhase(phases, l?.phase_retenue) }]
      })) : null)
        : etat === 'ok' ? new Map(dossiers.map((d) => [d.code, Object.values(d.niveaux).every((n) => n === 'inconnu') ? { couleur: NON_DISPONIBLE } : { couleur: CARTE[rang(d)], hauteur: 4000 + rang(d) * 22000 }])) : null
    const legende = vueCarte === 'vulnerabilite' ? { titre: 'Score de vulnérabilité', entrees: vuln.entrees }
      : vueCarte === 'ch' ? { titre: `Cadre harmonisé · ${periode}`, entrees: entreesCH } : { titre: `À surveiller en ${annee}`, entrees: entreesPriorite }
    return {
      aEcouter: aLire(titre, lignes),
      resume: fiche ? `${fiche.nom} · ${fiche.rouges} ${fiche.rouges > 1 ? 'signaux' : 'signal'} au rouge` : `${aSurveiller.length} départements à surveiller en ${annee}`,
      vue: {
        ambiance: 'crepuscule', camera: cadrer.pays(cadre, { inclinaison: vueCarte === 'ch' ? 30 : 52, cap: -14 }), zones: null, relief: vueCarte !== 'ch', selection: code, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [],
        departements,
      },
      legende: vueCarte === 'vulnerabilite' ? vuln.legende : <Categories titre={legende.titre} entrees={legende.entrees} />,
      infobulle: (c) => {
        if (vueCarte === 'vulnerabilite') return vuln.infobulle(c)
        const d = parCode.get(c)
        if (!d) return null
        if (vueCarte === 'ch') return { titre: d.nom, lignes: [`Cadre harmonisé : ${nomPhase(d.ch)}`, `Phases 3 à 5 : ${d.ch?.population_phase3_5_retenue == null ? 'non disponible' : `${nombre(d.ch.population_phase3_5_retenue)} personnes`}`, periode] }
        return { titre: d.nom, lignes: [
          `Cadre harmonisé : ${nomPhase(d.ch)}`,
          `Pluie attendue : ${d.pluie ? mm(d.pluie.pluie_prevue_mm) : 'non disponible'}`,
          `Récolte : ${d.recolte ? `${pct(d.recolte.proba_chute_pct)} de risque (${libelle(d.recolte.culture).toLowerCase()})` : 'non disponible'}`,
          `Vulnérabilité : ${d.vulnerabilite === null ? 'non notée' : `${nombre(d.vulnerabilite)} / 100`}`,
        ] }
      },
      etape: {
        titre, question: questionOng('campagne'), lignes, legende,
        tableau: { colonnes: ['Département', 'Signaux au rouge', 'Cadre harmonisé', 'Vulnérabilité (/100)'], lignes: aSurveiller.map((d) => [d.nom, raisons(d).join(', ') || '—', nomPhase(d.ch), d.vulnerabilite === null ? 'non notée' : nombre(d.vulnerabilite)]) },
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lignes` est résumé par `cleLignes`
  }, [dossiers, aSurveiller, fiche, annee, code, cadre, etat, vueCarte, vulnerabilites, ch, phases, periode, titre, cleLignes])
  usePublier(publier, sortie)

  // Le niveau dit aussi en texte (lecteurs d'écran) : la couleur seule ne suffit pas
  const DIT: Record<Niveau, string> = { rouge: 'au rouge', orange: 'à l’orange', calme: 'rien à signaler', inconnu: 'non disponible' }
  const cellule = (niveau: Niveau, valeur: string) => (
    <td className="px-1 py-1 text-right text-xs text-white tabular-nums"><span className="inline-flex items-center justify-end gap-1.5"><Point niveau={niveau} />{valeur}<span className="sr-only"> ({DIT[niveau]})</span></span></td>
  )
  const ligne = (d: Dossier) => (
    <tr key={d.code} className={clsx(d.code === code && 'bg-white/[0.09] shadow-[inset_2px_0_0_var(--color-soleil-500)]')}>
      <th scope="row" className="py-0 pr-1 text-left font-normal">
        <button type="button" onClick={() => cadre.choisir(d.code)} aria-current={d.code === code ? 'true' : undefined}
          className="min-h-11 w-full truncate rounded-md text-left text-sm text-white transition hover:bg-white/[0.06] hover:underline">{d.nom}</button>
      </th>
      {cellule(chCompteAnnee ? d.niveaux.ch : 'inconnu', d.ch?.phase_retenue == null ? '—' : String(d.ch.phase_retenue))}
      {cellule(d.niveaux.pluie, d.pluie?.pluie_prevue_mm == null ? '—' : nombre(d.pluie.pluie_prevue_mm))}
      {cellule(d.niveaux.recolte, d.recolte ? pct(d.recolte.proba_chute_pct) : '—')}
      {cellule(d.niveaux.vulnerabilite, d.vulnerabilite === null ? '—' : nombre(d.vulnerabilite))}
    </tr>
  )
  const tableauDepartements = (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">Signaux par département, les plus signalés d'abord</caption>
      <thead>
        <tr className="border-b border-white/[0.09] text-2xs leading-tight text-white/60">
          <th scope="col" className="pb-1.5 text-left font-normal">Département</th>
          {['Phase CH', 'Pluie attendue (mm)', 'Risque récolte', 'Vulnérabilité (/100)'].map((t) => <th key={t} scope="col" className="w-[3.9rem] px-1 pb-1.5 text-right font-normal">{t}</th>)}
        </tr>
      </thead>
      <tbody>{dossiers.map(ligne)}</tbody>
    </table>
  )
  // Les départements du Cadre harmonisé, dans l'ordre du scénario Urgence (même fonction : phase, personnes, vulnérabilité)
  const ordreCH = useMemo(() => {
    const vuln = new Map(vulnerabilites?.map((v) => [v.code_departement, v.score_vulnerabilite]))
    const lignesCH = (ch ?? []).filter((l) => l.phase_retenue !== null)
    const parCode = new Map(lignesCH.map((l) => [l.code_departement, l]))
    const criteres = new Map(lignesCH.map((l) => [l.code_departement, { phase: l.phase_retenue, personnes_phase3_5: l.population_phase3_5_retenue, vulnerabilite: vuln.get(l.code_departement) ?? null, potentiel_adapte: null }]))
    return ordonner(lignesCH.map((l) => ({ code: l.code_departement, besoin_t: 0, vulnerabilite: vuln.get(l.code_departement) ?? null })), criteres, 'urgence').map((d) => parCode.get(d.code)!)
  }, [ch, vulnerabilites])
  const pikine = ch?.find((l) => l.fusion_keur_massar)

  return (
    <FicheReponse cadre={cadre} mode="campagne" cle={`${code}-${annee}-${vueCarte}`} titre={titre} lignes={lignes} aEcouter={sortie.aEcouter}
      puces={[puceAnnee(cadre, a, fiche?.pluie), puceCulture(cadre, cadre.ref.cultures, cadre.culture, 'Toutes'), puceChoix('vue', 'Voir', VUES, vueCarte, setVue)]}
      etat={<>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">Cadre harmonisé : {periode}{ch && !chCompteAnnee ? ` · cycle ${cycleCH ?? 'non disponible'}, non compté dans les signaux de ${annee}` : ''}.</p>
        {cadre.culture && !cultureM3 && <p className="mt-1 text-xs text-white/60">{libelle(cadre.culture)} n'est pas couvert par le modèle 3 : risque de récolte de la culture la plus exposée.</p>}
        <Attente etat={etat} objet={`la campagne ${annee}`} lignes={4} />
      </>}
      detail={<>
        {fiche && (
          <Groupe titre="Les signaux du département">
            <dl className="-my-2 divide-y divide-white/[0.07]">
              <div className="py-2">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-white/60">Cadre harmonisé</dt>
                  <dd className="text-right text-sm font-medium text-white tabular-nums">{nomPhase(fiche.ch)}</dd>
                </div>
                {fiche.ch && <p className="mt-1 text-2xs leading-snug text-white/60">{fiche.ch.libelle_periode_courante ?? 'situation courante'} : phase {fiche.ch.phase_courante ?? 'non disponible'} · {fiche.ch.libelle_periode_projetee ?? 'projection'} : phase {fiche.ch.phase_projetee ?? 'non disponible'}{fiche.ch.note_fusion ? ` · ${fiche.ch.note_fusion}` : ''}</p>}
              </div>
              <Morceau modele="M1" libelle="Pluie attendue" valeur={fiche.pluie?.pluie_prevue_mm == null ? 'non disponible' : `${mm(fiche.pluie.pluie_prevue_mm)}${fiche.ecart === null ? '' : ` (${nombre(Math.round(fiche.ecart) + 0, { unite: '%', signe: true })})`}`}>
                {fiche.pluie && fiche.pluie.pluie_basse_mm !== null && fiche.pluie.pluie_haute_mm !== null && <>Entre {nombre(fiche.pluie.pluie_basse_mm)} et {mm(fiche.pluie.pluie_haute_mm)}, 8 chances sur 10. Normale : {mm(fiche.pluie.pluie_normale_mm)}.</>}
              </Morceau>
              <Morceau modele="M3" libelle="Risque pour la récolte" reserve={fiche.recolte?.alerte_fiable ? "prévision de l'année" : 'fiabilité faible : risque habituel, vu fin mai'} valeur={fiche.recolte ? pct(fiche.recolte.proba_chute_pct) : 'non disponible'}>
                {fiche.recolte && <>{libelle(fiche.recolte.culture)}{cultureM3 ? '' : ', la culture la plus exposée'}. Habituel : {pct(fiche.recolte.proba_chute_reference_pct)}.<span className="mt-1.5 block"><MarquesRendement ligne={fiche.recolte} quoi="alerte" /></span></>}
              </Morceau>
            </dl>
          </Groupe>
        )}
        {fiche && ficheVuln && <ScoreVulnerabilite fiche={ficheVuln} />}
        {ch && (
          <Groupe titre="Cadre harmonisé" complement={periode}>
            <Lignes>
              {ordreCH.slice(0, 8).map((l) => (
                <Ligne key={l.code_departement} libelle={l.departement} valeur={nomPhase(l)} detail={l.population_phase3_5_retenue === null ? 'phases 3 à 5 : non disponible' : `${nombre(l.population_phase3_5_retenue)} pers. en phases 3 à 5`} teinte={couleurPhase(phases, l.phase_retenue)} />
              ))}
            </Lignes>
            {pikine?.note_fusion && <p className="mt-2 text-2xs leading-snug text-white/60">{pikine.departement} : {pikine.note_fusion}.</p>}
            <p className="mt-2 text-2xs leading-snug text-white/60">Source : {ch[0]?.source} · licence {ch[0]?.licence}. Hors score de vulnérabilité ; les personnes s'additionnent, les phases jamais.</p>
          </Groupe>
        )}
        {etat === 'ok' && (
          <Groupe titre="Tous les départements" complement="les plus signalés d'abord">
            {tableauDepartements}
          </Groupe>
        )}
        {vulnerabilites && <ClassementVulnerabilite classement={classement} code={code} choisir={cadre.choisir} />}
        {fiche && <div className="mt-3"><Lien onClick={() => cadre.choisir(null)}>Revenir à la liste du pays</Lien></div>}
        <MethodeModele cibles={[{ modele: 'M1', tendance: a.tendance }, { modele: 'M3', moment: 'FIN_MAI', volet: 'alerte' }]} avertissements={[...(saison.data?.avertissements ?? []), ...(alerte.data?.avertissements ?? [])]}>
          <p>Indicatif, à valider avec les techniciens. Les signaux n'ont pas la même fiabilité : ils sont montrés côte à côte et jamais fondus en un seul chiffre. Le classement compte les signaux au rouge.</p>
          <p>Au rouge : pluie attendue au moins {2 * ECART_PLUIE_PCT} % sous la normale ; risque de chute de récolte d'au moins {SEUIL_ALERTE_PCT} % avec une prévision fiable ; vulnérabilité « très élevée » (relative) ; Cadre harmonisé en phase {PHASE_CRISE} ou plus, compté seulement pour l'année de son cycle. À l'orange : pluie {ECART_PLUIE_PCT} % sous la normale, risque de récolte au-dessus de l'habituel ou d'au moins {SEUIL_ALERTE_PCT} % sans prévision fiable (vu fin mai, c'est le risque habituel du département), vulnérabilité « élevée », phase 2 « sous pression ».</p>
          <p>Vulnérabilité : score relatif et indicatif (méthode v1), aléa sécheresse 60 %, sensibilité des rendements 40 %.</p>
        </MethodeModele>
      </>} />
  )
}
