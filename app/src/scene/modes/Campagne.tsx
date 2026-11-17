// Organisation — « Préparer la campagne » : les départements à surveiller pour la campagne à venir.
// Trois signaux côte à côte, chacun avec sa pastille : pluie attendue (modèle 1), risque pour la récolte
// (modèle 3, vu fin mai), vulnérabilité (mart). On classe par nombre de signaux au rouge, jamais par un score
// qui les additionnerait : ils n'ont pas la même fiabilité.
import clsx from 'clsx'
import { useMemo } from 'react'
import { useVulnerabilite } from '../../hooks/donnees'
import { etatPrevision, useAlerteRecolte, usePrevisionSaison } from '../../hooks/previsions'
import { libelle, mm, nombre, pct } from '../../lib/format'
import { SEUIL_ALERTE_PCT, type PrevisionRendement, type PrevisionSaison } from '../../types/previsions'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { NON_DISPONIBLE, tendance } from '../couleurs'
import { Attente, ChampAnnee, MarquesRendement, MethodeModele, Morceau } from '../previsions'
import { culture as cult, dire } from '../lecture'
import { Categories, Cle, Detail, Groupe, Lien, Reponse } from '../ui'

type Niveau = 'rouge' | 'orange' | 'calme' | 'inconnu'
const TEINTES: Record<Niveau, string> = { rouge: 'var(--color-alerte-500)', orange: 'var(--color-soleil-500)', calme: 'var(--color-vert-500)', inconnu: 'rgb(255 255 255 / 0.25)' }
/** Couleurs de la carte (Mapbox ne lit pas les variables CSS) : alerte-700, alerte-500, soleil-500, vert-100. */
const CARTE = ['#d5eadb', '#f2b544', '#d2492f', '#a3311c']
const ECART_PLUIE_PCT = 5

interface Dossier {
  code: string
  nom: string
  pluie: PrevisionSaison | null
  ecart: number | null
  recolte: PrevisionRendement | null
  vulnerabilite: number | null
  niveaux: { pluie: Niveau; recolte: Niveau; vulnerabilite: Niveau }
  rouges: number
  oranges: number
}

/** Les signaux au rouge d'un département, en mots. */
function raisons(d: Dossier): string[] {
  const r: string[] = []
  if (d.niveaux.recolte === 'rouge' && d.recolte) r.push(`récolte en alerte, ${dire.pct(d.recolte.proba_chute_pct)} de risque de chute pour ${cult.le(libelle(d.recolte.culture))}`)
  if (d.niveaux.vulnerabilite === 'rouge') r.push('vulnérabilité très élevée')
  if (d.niveaux.pluie === 'rouge') r.push('pluie nettement sous la normale')
  return r
}

/** L'essentiel, pour l'oreille : la saison, combien de départements surveiller, lesquels et pourquoi. */
function ecouterCampagne(annee: number, classe: string | null, proba: number | null, aSurveiller: Dossier[], fiche: Dossier | undefined): string[] {
  if (fiche) {
    const phrases = [`${fiche.nom}, campagne ${annee} : ${fiche.rouges} signal${fiche.rouges > 1 ? 'aux' : ''} au rouge.`]
    if (fiche.pluie?.pluie_prevue_mm != null) phrases.push(`Pluie attendue : ${dire.mm(fiche.pluie.pluie_prevue_mm)}${fiche.ecart !== null ? `, soit ${Math.abs(Math.round(fiche.ecart))} pour cent ${fiche.ecart < 0 ? 'sous' : 'au-dessus de'} la normale` : ''}.`)
    phrases.push(fiche.recolte ? `Risque de chute de récolte : ${dire.pct(fiche.recolte.proba_chute_pct)}, pour ${cult.le(libelle(fiche.recolte.culture))}.` : 'Risque de récolte non disponible.')
    phrases.push(fiche.vulnerabilite === null ? 'Vulnérabilité non notée.' : `Vulnérabilité : ${dire.nombre(fiche.vulnerabilite)} sur cent, comparée aux autres départements.`)
    phrases.push('Estimations indicatives.')
    return phrases
  }
  const phrases = classe ? [`Campagne ${annee} : la saison s'annonce plutôt ${classe} dans le pays, avec ${dire.pct(proba)} de chances.`] : [`Campagne ${annee}.`]
  if (!aSurveiller.length) phrases.push('Aucun département n\'a de signal au rouge.')
  else {
    phrases.push(`${aSurveiller.length} département${aSurveiller.length > 1 ? 's sont' : ' est'} à surveiller.`)
    aSurveiller.slice(0, 3).forEach((d) => phrases.push(`${d.nom} : ${raisons(d).join(', ')}.`))
  }
  phrases.push('Un signal est au rouge quand la récolte risque de chuter d\'au moins 40 pour cent, quand la vulnérabilité est très élevée, ou quand la pluie attendue est nettement sous la normale. Estimations indicatives.')
  return phrases
}

const Point = ({ niveau }: { niveau: Niveau }) => <span className="size-2 shrink-0 rounded-full" style={{ background: TEINTES[niveau] }} aria-hidden />

export default function Campagne({ cadre, publier }: PropsMode) {
  // Les années du modèle 1, qui porte la pluie attendue ; le risque de récolte s'affiche là où le modèle 3 existe
  const a = useAnnee(cadre, 'M1')
  const { annee } = a
  const saison = usePrevisionSaison(annee)
  const alerte = useAlerteRecolte(annee, 'FIN_MAI')
  const { data: vulnerabilites } = useVulnerabilite()
  const etat = etatPrevision(saison)
  const code = cadre.selection

  const dossiers = useMemo<Dossier[]>(() => {
    const pluies = new Map(saison.data?.donnees.map((l) => [l.code_departement, l]))
    const vuln = new Map(vulnerabilites?.map((v) => [v.code_departement, v]))
    const recoltes = new Map<string, PrevisionRendement>()
    alerte.data?.donnees.forEach((l) => {
      const m = recoltes.get(l.code_departement)
      if (l.proba_chute_pct !== null && (!m || l.proba_chute_pct > m.proba_chute_pct!)) recoltes.set(l.code_departement, l)
    })
    return cadre.ref.departements.map((d) => {
      const p = pluies.get(d.code_departement) ?? null
      const r = recoltes.get(d.code_departement) ?? null
      const v = vuln.get(d.code_departement)
      const ecart = p && p.pluie_prevue_mm !== null && p.pluie_normale_mm ? (p.pluie_prevue_mm / p.pluie_normale_mm - 1) * 100 : null
      const niveaux: Dossier['niveaux'] = {
        pluie: ecart === null ? 'inconnu' : ecart <= -2 * ECART_PLUIE_PCT ? 'rouge' : ecart <= -ECART_PLUIE_PCT ? 'orange' : 'calme',
        recolte: !r ? 'inconnu' : r.proba_chute_pct! >= SEUIL_ALERTE_PCT ? 'rouge' : r.proba_chute_reference_pct !== null && r.proba_chute_pct! > r.proba_chute_reference_pct ? 'orange' : 'calme',
        vulnerabilite: !v?.classe_vulnerabilite ? 'inconnu' : v.classe_vulnerabilite.startsWith('très élevée') ? 'rouge' : v.classe_vulnerabilite.startsWith('élevée') ? 'orange' : 'calme',
      }
      const compte = (n: Niveau) => Object.values(niveaux).filter((x) => x === n).length
      return { code: d.code_departement, nom: d.departement, pluie: p, ecart, recolte: r, vulnerabilite: v?.score_vulnerabilite ?? null, niveaux, rouges: compte('rouge'), oranges: compte('orange') }
    }).sort((a, b) => b.rouges - a.rouges || b.oranges - a.oranges || (b.recolte?.proba_chute_pct ?? -1) - (a.recolte?.proba_chute_pct ?? -1))
  }, [saison.data, alerte.data, vulnerabilites, cadre.ref.departements])

  const aSurveiller = dossiers.filter((d) => d.rouges > 0)
  const fiche = dossiers.find((d) => d.code === code)
  const pays = saison.data?.donnees[0]
  const t = pays ? tendance(pays) : null

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(dossiers.map((d) => [d.code, d]))
    const rang = (d: Dossier) => (d.rouges >= 2 ? 3 : d.rouges === 1 ? 2 : d.oranges > 0 ? 1 : 0)
    return {
      aEcouter: etat === 'ok' ? ecouterCampagne(annee, t?.classe ?? null, t?.proba ?? null, aSurveiller, fiche) : undefined,
      resume: fiche ? `${fiche.nom} · ${fiche.rouges} ${fiche.rouges > 1 ? 'signaux' : 'signal'} au rouge` : `${aSurveiller.length} départements à surveiller en ${annee}`,
      vue: {
        ambiance: 'crepuscule', camera: cadrer.pays(cadre, { inclinaison: 52, cap: -14 }), zones: null, relief: true, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [],
        departements: etat === 'ok' ? new Map(dossiers.map((d) => [d.code, Object.values(d.niveaux).every((n) => n === 'inconnu') ? { couleur: NON_DISPONIBLE } : { couleur: CARTE[rang(d)], hauteur: 4000 + rang(d) * 22000 }])) : null,
      },
      legende: <Categories titre={`À surveiller en ${annee}`} entrees={[{ couleur: CARTE[3], libelle: '2 signaux au rouge ou plus' }, { couleur: CARTE[2], libelle: '1 signal au rouge' }, { couleur: CARTE[1], libelle: 'Signal à l’orange' }, { couleur: CARTE[0], libelle: 'Rien à signaler' }]} />,
      infobulle: (c) => {
        const d = parCode.get(c)
        return d ? { titre: d.nom, lignes: [
          `Pluie attendue : ${d.pluie ? mm(d.pluie.pluie_prevue_mm) : 'non disponible'}`,
          `Récolte : ${d.recolte ? `${pct(d.recolte.proba_chute_pct)} de risque (${libelle(d.recolte.culture).toLowerCase()})` : 'non disponible'}`,
          `Vulnérabilité : ${d.vulnerabilite === null ? 'non notée' : `${nombre(d.vulnerabilite)} / 100`}`,
        ] } : null
      },
    }
  }, [dossiers, aSurveiller, fiche, annee, code, cadre, etat, t])
  usePublier(publier, sortie)

  const cellule = (niveau: Niveau, valeur: string) => <span className="flex w-[4.25rem] shrink-0 items-center justify-end gap-1.5 text-xs text-white tabular-nums"><Point niveau={niveau} />{valeur}</span>
  const ligne = (d: Dossier) => (
    <li key={d.code}>
      <button type="button" onClick={() => cadre.choisir(d.code)} aria-current={d.code === code ? 'true' : undefined}
        className={clsx('-mx-2 flex min-h-10 w-[calc(100%+1rem)] items-center gap-1 rounded-md px-2 text-left transition hover:bg-white/[0.06]', d.code === code && 'bg-white/[0.09] shadow-[inset_2px_0_0_var(--color-soleil-500)]')}>
        <span className="min-w-0 flex-1 truncate text-sm text-white">{d.nom}</span>
        {cellule(d.niveaux.pluie, d.pluie?.pluie_prevue_mm == null ? '—' : nombre(d.pluie.pluie_prevue_mm))}
        {cellule(d.niveaux.recolte, d.recolte ? pct(d.recolte.proba_chute_pct) : '—')}
        {cellule(d.niveaux.vulnerabilite, d.vulnerabilite === null ? '—' : nombre(d.vulnerabilite))}
      </button>
    </li>
  )
  const entete = (
    <div className="flex items-end gap-1 border-b border-white/[0.09] pb-1.5 text-2xs leading-tight text-white/60">
      <span className="flex-1">Département</span>
      <span className="w-[4.25rem] text-right">Pluie attendue (mm)</span><span className="w-[4.25rem] text-right">Risque récolte</span><span className="w-[4.25rem] text-right">Vulnérabilité (/100)</span>
    </div>
  )

  return (
    <div>
      {fiche ? (
        <Reponse cle={`${code}-${annee}`} titre={fiche.nom} phrase={`Campagne ${annee} · ${fiche.rouges ? `${fiche.rouges} ${fiche.rouges > 1 ? 'signaux' : 'signal'} au rouge` : fiche.oranges ? 'à l’orange' : 'rien à signaler'}.`}>
          <Cle valeur={fiche.pluie?.pluie_prevue_mm == null ? '—' : nombre(fiche.pluie.pluie_prevue_mm)} unite="mm" libelle="pluie attendue" />
          <Cle valeur={fiche.recolte ? nombre(fiche.recolte.proba_chute_pct) : '—'} unite={fiche.recolte ? '%' : undefined} libelle="risque pour la récolte" teinte={fiche.niveaux.recolte === 'rouge' ? TEINTES.rouge : undefined} />
          <Cle valeur={fiche.vulnerabilite === null ? '—' : nombre(fiche.vulnerabilite)} unite={fiche.vulnerabilite === null ? undefined : '/ 100'} libelle="vulnérabilité" teinte={fiche.niveaux.vulnerabilite === 'rouge' ? TEINTES.rouge : undefined} />
        </Reponse>
      ) : (
        <Reponse cle={annee} titre={etat === 'ok' ? `${aSurveiller.length} départements à surveiller en ${annee}` : `Campagne ${annee}`}
          phrase={t ? `Saison ${t.texte} (${nombre(t.proba)} % de chances, tout le pays). Priorité : récolte en alerte, vulnérabilité très élevée ou pluie nettement sous la normale.` : undefined} />
      )}
      <Attente etat={etat} objet={`la campagne ${annee}`} lignes={6} />

      {etat === 'ok' && !fiche && (
        <div className="mt-4">
          {entete}
          <ol>{aSurveiller.map(ligne)}</ol>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-white/60">
            <span className="inline-flex items-center gap-1.5"><Point niveau="rouge" />au rouge</span><span className="inline-flex items-center gap-1.5"><Point niveau="orange" />à l'orange</span><span className="inline-flex items-center gap-1.5"><Point niveau="calme" />rien à signaler</span>
          </p>
        </div>
      )}

      <ChampAnnee cadre={cadre} a={a} saison={fiche?.pluie} />
      {etat === 'ok' && etatPrevision(alerte) === 'absente' && <p className="mt-2 text-xs leading-relaxed text-white/60">Risque de récolte non disponible pour {annee} : le tableau repose sur la pluie attendue et la vulnérabilité.</p>}

      {etat === 'ok' && (
        <Detail libelle={fiche ? 'Voir le détail' : `Voir les ${dossiers.length} départements`}>
          {fiche && (
            <Groupe titre="Les trois signaux">
              <dl className="-my-2 divide-y divide-white/[0.07]">
                <Morceau modele="M1" libelle="Pluie attendue" valeur={fiche.pluie?.pluie_prevue_mm == null ? 'non disponible' : `${mm(fiche.pluie.pluie_prevue_mm)}${fiche.ecart === null ? '' : ` (${nombre(Math.round(fiche.ecart) + 0, { unite: '%', signe: true })})`}`}>
                  {fiche.pluie && fiche.pluie.pluie_basse_mm !== null && fiche.pluie.pluie_haute_mm !== null && <>Entre {nombre(fiche.pluie.pluie_basse_mm)} et {mm(fiche.pluie.pluie_haute_mm)}, 8 chances sur 10. Normale : {mm(fiche.pluie.pluie_normale_mm)}.</>}
                </Morceau>
                <Morceau modele="M3" libelle="Risque pour la récolte" reserve={fiche.recolte?.alerte_fiable ? "prévision de l'année" : 'fiabilité faible : risque habituel, vu fin mai'} valeur={fiche.recolte ? pct(fiche.recolte.proba_chute_pct) : 'non disponible'}>
                  {fiche.recolte && <>{libelle(fiche.recolte.culture)}, la culture la plus exposée. Habituel : {pct(fiche.recolte.proba_chute_reference_pct)}.<span className="mt-1.5 block"><MarquesRendement ligne={fiche.recolte} quoi="alerte" /></span></>}
                </Morceau>
                <div className="py-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-white/70">Vulnérabilité</dt>
                    <dd className="text-right text-sm font-medium text-white tabular-nums">{fiche.vulnerabilite === null ? 'non notée' : `${nombre(fiche.vulnerabilite)} / 100`}</dd>
                  </div>
                  <p className="mt-1 text-2xs leading-snug text-white/60">Indicateur calculé sur le passé (1991-2020), pas un modèle · relatif et indicatif</p>
                </div>
              </dl>
            </Groupe>
          )}
          <Groupe titre="Tous les départements" complement="les plus signalés d'abord">
            {entete}
            <ol>{dossiers.map(ligne)}</ol>
          </Groupe>
        </Detail>
      )}
      {fiche && <div className="mt-3"><Lien onClick={() => cadre.choisir(null)}>Revenir à la liste du pays</Lien></div>}

      <MethodeModele cibles={[{ modele: 'M1', tendance: a.tendance }, { modele: 'M3', moment: 'FIN_MAI', volet: 'alerte' }]} avertissements={[...(saison.data?.avertissements ?? []), ...(alerte.data?.avertissements ?? [])]}>
        <p>Indicatif, à valider avec les techniciens. Les trois signaux n'ont pas la même fiabilité : ils sont montrés côte à côte et jamais fondus en un seul chiffre. Le classement compte les signaux au rouge.</p>
        <p>Au rouge : pluie attendue au moins {2 * ECART_PLUIE_PCT} % sous la normale ; risque de chute de récolte d'au moins {SEUIL_ALERTE_PCT} % (culture la plus exposée, vu fin mai : risque habituel du département) ; vulnérabilité « très élevée » (relative). À l'orange : pluie {ECART_PLUIE_PCT} % sous la normale, risque de récolte au-dessus de l'habituel, vulnérabilité « élevée ».</p>
      </MethodeModele>
    </div>
  )
}
