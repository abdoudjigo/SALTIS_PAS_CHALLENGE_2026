// Agriculteur — « Quand semer » (modèle 4) : la réponse est une période, en dates. Une frise de début juin à
// mi-août montre trois temps : trop tôt (la pluie de semis peut être suivie d'un sec), le bon moment, trop tard
// (les pluies finissent avant la récolte). La carte montre le meilleur moment dans chaque département.
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { etatPrevision, useCarteSemis, useRisqueSemis } from '../../hooks/previsions'
import { libelle, nombre, pct } from '../../lib/format'
import type { RisqueSemis } from '../../types/previsions'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { couleurDecade, degrade } from '../couleurs'
import { datesDecade, debutDecade, MODELES, natureAnnee, periodeDecades } from '../fiabilite'
import { Attente, ChampAnnee, MethodeModele } from '../previsions'
import { dire } from '../lecture'
import { cultureWo, decadeWo, FIN_WO, pctWo, wo } from '../wolof'
import { fenetre, repliCulture, RISQUE_BON_MOMENT } from '../conseil'
import { AFaire, Champ, Cle, Cles, Degrade, Detail, Groupe, Ligne, Lignes, LigneFiabilite, Reponse, type Action } from '../ui'

type Temps = 'tot' | 'bon' | 'tard'
const TEMPS: Record<Temps, { nom: string; classe: string }> = {
  tot: { nom: 'Trop tôt', classe: 'bg-soleil-500/45' },
  bon: { nom: 'Bon moment', classe: 'bg-vert-500' },
  tard: { nom: 'Trop tard', classe: 'bg-alerte-500/70' },
}

/** Frise de début juin à mi-août : une case par décade, trois couleurs, la meilleure cochée. */
function Frise({ decades, de, a, choisie, onChoisir }: { decades: RisqueSemis[]; de: number; a: number; choisie: number; onChoisir: (decade: number) => void }) {
  const temps = (i: number): Temps => (i < de ? 'tot' : i > a ? 'tard' : 'bon')
  const zones = ([['tot', de], ['bon', a - de + 1], ['tard', decades.length - a - 1]] as [Temps, number][]).filter(([, n]) => n > 0)
  return (
    <div>
      <div className="grid grid-cols-8 gap-0.5 text-2xs font-medium text-white/80" aria-hidden>
        {zones.map(([t, n]) => <span key={t} className="truncate pb-1.5" style={{ gridColumn: `span ${n}` }}>{n > 1 || t === 'bon' ? TEMPS[t].nom : ''}</span>)}
      </div>
      <div className="grid grid-cols-8 gap-0.5" role="radiogroup" aria-label="Période de semis">
        {decades.map((d, i) => (
          <button key={d.decade_semis} type="button" role="radio" aria-checked={d.decade_semis === choisie} onClick={() => onChoisir(d.decade_semis)}
            aria-label={`${periodeDecades(d.decade_semis)} : ${TEMPS[temps(i)].nom.toLowerCase()}, risque ${pct(d.risque_total_pct)}`}
            className={clsx('grid h-11 place-items-center transition hover:brightness-125', TEMPS[temps(i)].classe, i === 0 && 'rounded-l-md', i === decades.length - 1 && 'rounded-r-md', d.decade_semis === choisie && 'ring-2 ring-white ring-inset')}>
            {d.decade_conseillee && <Check className="size-4 text-white" strokeWidth={3} aria-hidden />}
          </button>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-8 gap-0.5 text-2xs text-white/55 tabular-nums" aria-hidden>
        <span className="col-span-3">1er juin</span><span className="col-span-3">1er juil.</span><span className="col-span-2">1er août</span>
      </div>
    </div>
  )
}

export default function QuandSemer({ cadre, publier }: PropsMode) {
  const a = useAnnee(cadre, 'M4')
  const { annee } = a
  const [decadeChoisie, setDecade] = useState<number | null>(null)
  const code = cadre.selection ?? cadre.user.code_departement
  const departement = cadre.ref.departements.find((d) => d.code_departement === code)

  const requete = useRisqueSemis(code, annee)
  const etat = etatPrevision(requete)
  const cultures = useMemo(() => [...new Set(requete.data?.donnees.map((l) => l.culture))].sort((a, b) => a.localeCompare(b, 'fr')), [requete.data])
  // La culture partagée si le modèle 4 la couvre ici ; sinon le choix par défaut, sans écraser la culture partagée
  const demandee = cadre.culture
  const couverte = demandee !== null && (cultures.length === 0 || cultures.includes(demandee))
  const culture = couverte ? demandee : cultures.includes('ARACHIDE') ? 'ARACHIDE' : cultures[0] ?? 'ARACHIDE'
  const repli = cultures.length ? repliCulture(couverte ? null : demandee, culture) : null
  const decades = useMemo(() => (requete.data?.donnees ?? []).filter((l) => l.culture === culture).sort((a, b) => a.decade_semis - b.decade_semis), [requete.data, culture])
  const f = useMemo(() => fenetre(decades), [decades])
  const detail = decades.find((d) => d.decade_semis === decadeChoisie) ?? f?.meilleure
  const carte = useCarteSemis(culture, annee)
  const nomCulture = libelle(culture).toLowerCase()
  const article = /^[aeiouéèh]/i.test(nomCulture) ? "l'" : nomCulture.startsWith('pastèque') ? 'la ' : 'le '
  const sur = f !== null && f.meilleure.risque_total_pct !== null && f.meilleure.risque_total_pct < RISQUE_BON_MOMENT

  // Que faire : ne pas semer trop tôt, semer après une vraie pluie dans la fenêtre, préparer les intrants
  const finDate = (decade: number) => { const d = datesDecade(decade); return `${d.fin} ${['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][d.mois]}` }
  const tot = f && f.de > 0 ? decades[f.de - 1] : undefined
  const actions: Action[] = !f ? [] : !sur
    ? [{ texte: 'Aucune période n’est vraiment sûre cette année : préférez une culture à cycle plus court.', vers: { mode: 'semer', libelle: 'Que semer ?' } }]
    : [
        ...(tot && tot.risque_faux_depart_pct !== null ? [{ texte: `Ne semez pas avant le ${debutDecade(decades[f.de].decade_semis)} : avant, ${nombre(tot.risque_faux_depart_pct)} % de risque d’un sec juste après la levée.` }] : []),
        { texte: `Semez après une pluie d’au moins 20 mm, entre le ${debutDecade(decades[f.de].decade_semis)} et le ${finDate(decades[f.a].decade_semis)}.` },
        { texte: 'Préparez vos semences et engrais.', vers: { mode: 'surface', libelle: 'Combien ?' } },
      ]
  const faire = actions.map((x) => String(x.texte))
  const cleFaire = faire.join('|')

  const sortie = useMemo<Sortie>(() => {
    const lignes = carte.data?.donnees
    const parCode = new Map(lignes?.map((l) => [l.code_departement, l]))
    const aEcouter = !departement
      ? ['Touchez un département sur la carte pour savoir quand y semer.']
      : !f
        ? [`Pas de période de semis calculée pour ${article}${nomCulture} à ${departement.departement}.`]
        : [
            sur
              ? `À ${departement.departement}, en ${annee}, semez ${article}${nomCulture} ${periodeDecades(decades[f.de].decade_semis, decades[f.a].decade_semis)}.`
              : `À ${departement.departement}, en ${annee}, aucune période n'est vraiment sûre pour ${article}${nomCulture}.`,
            ...faire,
            `Le meilleur moment : ${periodeDecades(f.meilleure.decade_semis)}, avec ${dire.pct(f.meilleure.risque_total_pct)} de risque.`,
            'Semer plus tôt, c\'est risquer un épisode sec juste après la levée. Semer plus tard, c\'est risquer que les pluies s\'arrêtent avant la récolte.',
            `Calcul fait avec la prévision de la saison ${annee}. Estimation indicative, à confirmer avec votre conseiller agricole.`,
          ]
    const aEcouterWo = !departement ? undefined : !f
      ? [`Ci ${departement.departement}, amul jamono ji ñu xayma ngir ${cultureWo(culture)}.`]
      : [
          `Ci ${departement.departement}, atum ${wo(annee)}, ${cultureWo(culture)} gi, ngay ji ko ${decadeWo(decades[f.de].decade_semis, decades[f.a].decade_semis)}.`,
          `Jamono ji gën: ${decadeWo(f.meilleure.decade_semis)}. Loraange gi: ${pctWo(f.meilleure.risque_total_pct)}.`,
          'Soo jiwee ba gaaw, taw bi mën na dakk. Soo yàggee, taw bi mën na jeex bala ngóob mi.',
          FIN_WO,
        ]
    return {
      aEcouter,
      aEcouterWo,
      resume: departement ? (f ? (sur ? `${libelle(culture)} : semer ${periodeDecades(decades[f.de].decade_semis, decades[f.a].decade_semis, true)}` : `${libelle(culture)} : aucune période sûre`) : departement.departement) : 'Choisissez un département',
      vue: {
        ambiance: 'jour', camera: cadrer.pays(cadre, { inclinaison: 26, cap: -6 }), zones: null, relief: false, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [],
        departements: lignes ? new Map(lignes.map((l) => [l.code_departement, { couleur: couleurDecade(l.decade_semis) }])) : null,
      },
      legende: <Degrade titre={`Meilleur moment pour semer · ${nomCulture}`} gauche="début juin" droite="mi-août" degrade={degrade(couleurDecade, 16, 23, 7)} note="Gris : non disponible." />,
      infobulle: (c) => {
        const l = parCode.get(c)
        const nom = cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c
        return { titre: nom, lignes: l ? [`${libelle(culture)} : ${periodeDecades(l.decade_semis)}`, `Risque : ${pct(l.risque_total_pct)}`] : ['Non disponible (pas de pluie décadaire)'] }
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `faire` est tiré de `f` et `decades`
  }, [carte.data, departement, f, decades, culture, nomCulture, code, cadre, annee, article, sur, cleFaire])
  usePublier(publier, sortie)

  if (!departement) return <Reponse titre="Choisissez un département" phrase="Touchez un département sur la carte pour voir quand y semer." />

  return (
    <div>
      {f ? (
        <Reponse vivant cle={`${code}-${annee}-${culture}`} titre={sur ? `Semez ${article}${nomCulture} ${periodeDecades(decades[f.de].decade_semis, decades[f.a].decade_semis)}` : `Le moins risqué : ${periodeDecades(f.meilleure.decade_semis)}`}
          phrase={`${departement.departement} · ${annee}.${sur ? '' : ' Aucune période n’est vraiment sûre ici pour cette culture.'}`} />
      ) : (
        <Reponse vivant cle={`${code}-${annee}-${culture}`} titre={departement.departement} phrase={`Quand semer ${article}${nomCulture}.`} />
      )}
      {repli && <p className="mt-2 text-xs text-white/60">{repli}</p>}
      <Attente etat={etat} objet={`${departement.departement} en ${annee}`} />
      {etat === 'ok' && !f && <p className="mt-4 text-sm text-white/60">Pas de période de semis calculée pour {article}{nomCulture} dans ce département.</p>}

      <AFaire aller={cadre.aller} actions={actions} />

      {f && (
        <Cles>
          <Cle large valeur={periodeDecades(f.meilleure.decade_semis, f.meilleure.decade_semis, true).replace('du ', '')} libelle="le meilleur moment" teinte="var(--color-vert-100)" />
          <Cle valeur={nombre(f.meilleure.risque_total_pct)} unite="%" libelle="de risque" />
        </Cles>
      )}

      {f && detail && (
        <div className="mt-5">
          <Frise decades={decades} de={f.de} a={f.a} choisie={detail.decade_semis} onChoisir={setDecade} />
          <p className="mt-3 text-sm text-white/80" aria-live="polite">
            <span className="font-medium text-white">{libelle(periodeDecades(detail.decade_semis))}</span> : {pct(detail.risque_total_pct)} de risque
            {detail.decade_conseillee ? ', le plus bas.' : (detail.risque_faux_depart_pct ?? 0) >= (detail.risque_fin_trop_tot_pct ?? 0) ? ' (un sec après le semis).' : ' (pluies finies avant la récolte).'}
          </p>
        </div>
      )}

      {f && <LigneFiabilite parties={['Modèle 4', MODELES.M4.fiabilite, natureAnnee(annee, a.aVenir)]} />}

      <Champ libelle="Culture" className="mt-4">
        <select className="champ-scene" value={culture} onChange={(e) => { cadre.choisirCulture(e.target.value); setDecade(null) }}>
          {(cultures.length ? cultures : [culture]).map((c) => <option key={c} value={c}>{libelle(c)}</option>)}
        </select>
      </Champ>
      <ChampAnnee cadre={cadre} a={a} className="mt-2" />

      {detail && (
        <Detail>
          <Groupe titre={libelle(periodeDecades(detail.decade_semis))}>
            <Lignes>
              <Ligne libelle="Risque total" valeur={pct(detail.risque_total_pct)} />
              <Ligne libelle="Semer trop tôt" valeur={pct(detail.risque_faux_depart_pct)} detail="un sec après le semis" />
              <Ligne libelle="Semer trop tard" valeur={pct(detail.risque_fin_trop_tot_pct)} detail="pluies finies avant la récolte" />
              <Ligne libelle="Pluie de semis" valeur={pct(detail.chance_pluie_semis_pct)} detail="années avec au moins 20 mm" />
              <Ligne libelle="Cycle de la culture" valeur={detail.cycle_jours === null ? 'non disponible' : `${nombre(detail.cycle_jours)} jours`} />
            </Lignes>
          </Groupe>
        </Detail>
      )}

      <MethodeModele cibles={[{ modele: 'M4' }]} avertissements={requete.data?.avertissements}>
        <p>Indicatif, à valider avec les agronomes. Le meilleur moment est la période de 10 jours au risque le plus bas, parmi celles où une pluie de semis arrive au moins une année sur deux. Le « bon moment » l'étend aux périodes voisines dont le risque reste sous {RISQUE_BON_MOMENT} %.</p>
        <p>Calculé avec la prévision de saison {annee}{a.tendance ? ' (prévision de tendance)' : ''}{detail?.proba_saison_seche_m1_pct != null ? ` : ${pct(detail.proba_saison_seche_m1_pct)} de chances d'une saison sèche` : ''}.</p>
      </MethodeModele>
    </div>
  )
}
