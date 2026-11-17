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
import { periodeDecades } from '../fiabilite'
import { Attente, ChampAnnee, MethodeModele } from '../previsions'
import { dire } from '../lecture'
import { cultureWo, decadeWo, FIN_WO, pctWo, wo } from '../wolof'
import { Champ, Cle, Degrade, Detail, Groupe, Ligne, Lignes, Reponse } from '../ui'

/** En dessous de ce risque total, une décade voisine de la meilleure fait encore partie du bon moment. */
const RISQUE_BON_MOMENT = 20
type Temps = 'tot' | 'bon' | 'tard'
const TEMPS: Record<Temps, { nom: string; classe: string }> = {
  tot: { nom: 'Trop tôt', classe: 'bg-soleil-500/45' },
  bon: { nom: 'Bon moment', classe: 'bg-vert-500' },
  tard: { nom: 'Trop tard', classe: 'bg-alerte-500/70' },
}

/** Le bon moment : la décade conseillée et ses voisines immédiates tant que le risque reste bas. */
function fenetre(decades: RisqueSemis[]) {
  const i = decades.findIndex((d) => d.decade_conseillee)
  if (i < 0) return null
  const bonne = (d: RisqueSemis | undefined) => d !== undefined && d.risque_total_pct !== null && d.risque_total_pct < RISQUE_BON_MOMENT
  let [de, a] = [i, i]
  while (bonne(decades[de - 1])) de--
  while (bonne(decades[a + 1])) a++
  return { de, a, meilleure: decades[i] }
}

/** Frise de début juin à mi-août : une case par décade, trois couleurs, la meilleure cochée. */
function Frise({ decades, de, a, choisie, onChoisir }: { decades: RisqueSemis[]; de: number; a: number; choisie: number; onChoisir: (decade: number) => void }) {
  const temps = (i: number): Temps => (i < de ? 'tot' : i > a ? 'tard' : 'bon')
  const zones = ([['tot', de], ['bon', a - de + 1], ['tard', decades.length - a - 1]] as [Temps, number][]).filter(([, n]) => n > 0)
  return (
    <div>
      <div className="grid grid-cols-8 gap-0.5 text-2xs font-medium text-white/90" aria-hidden>
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
      <div className="mt-1.5 grid grid-cols-8 gap-0.5 text-2xs text-white/60 tabular-nums" aria-hidden>
        <span className="col-span-3">1er juin</span><span className="col-span-3">1er juil.</span><span className="col-span-2">1er août</span>
      </div>
    </div>
  )
}

export default function QuandSemer({ cadre, publier }: PropsMode) {
  const a = useAnnee(cadre, 'M4')
  const { annee } = a
  const [cultureChoisie, setCulture] = useState<string | null>(cadre.cultureDemandee)
  const [decadeChoisie, setDecade] = useState<number | null>(null)
  const code = cadre.selection ?? cadre.user.code_departement
  const departement = cadre.ref.departements.find((d) => d.code_departement === code)

  const requete = useRisqueSemis(code, annee)
  const etat = etatPrevision(requete)
  const cultures = useMemo(() => [...new Set(requete.data?.donnees.map((l) => l.culture))].sort((a, b) => a.localeCompare(b, 'fr')), [requete.data])
  const culture = cultureChoisie && (cultures.length === 0 || cultures.includes(cultureChoisie)) ? cultureChoisie : cultures.includes('ARACHIDE') ? 'ARACHIDE' : cultures[0] ?? 'ARACHIDE'
  const decades = useMemo(() => (requete.data?.donnees ?? []).filter((l) => l.culture === culture).sort((a, b) => a.decade_semis - b.decade_semis), [requete.data, culture])
  const f = useMemo(() => fenetre(decades), [decades])
  const detail = decades.find((d) => d.decade_semis === decadeChoisie) ?? f?.meilleure
  const carte = useCarteSemis(culture, annee)
  const nomCulture = libelle(culture).toLowerCase()
  const article = /^[aeiouéèh]/i.test(nomCulture) ? "l'" : nomCulture.startsWith('pastèque') ? 'la ' : 'le '
  const sur = f !== null && f.meilleure.risque_total_pct !== null && f.meilleure.risque_total_pct < RISQUE_BON_MOMENT

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
      resume: departement ? (f ? `${libelle(culture)} : semer ${periodeDecades(decades[f.de].decade_semis, decades[f.a].decade_semis, true)}` : departement.departement) : 'Choisissez un département',
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
  }, [carte.data, departement, f, decades, culture, nomCulture, code, cadre, annee, article, sur])
  usePublier(publier, sortie)

  if (!departement) return <Reponse titre="Choisissez un département" phrase="Touchez un département sur la carte pour voir quand y semer." />

  return (
    <div>
      {f ? (
        <Reponse cle={`${code}-${annee}-${culture}`} titre={sur ? `Semez ${article}${nomCulture} ${periodeDecades(decades[f.de].decade_semis, decades[f.a].decade_semis)}` : `Le moins risqué : ${periodeDecades(f.meilleure.decade_semis)}`}
          phrase={`${departement.departement} · ${annee}.${sur ? '' : ' Aucune période n’est vraiment sûre ici pour cette culture.'}`}>
          <Cle large valeur={periodeDecades(f.meilleure.decade_semis, f.meilleure.decade_semis, true).replace('du ', '')} libelle="le meilleur moment" teinte="var(--color-vert-100)" />
          <Cle valeur={nombre(f.meilleure.risque_total_pct)} unite="%" libelle="de risque" />
        </Reponse>
      ) : (
        <Reponse cle={`${code}-${annee}-${culture}`} titre={departement.departement} phrase={`Quand semer ${article}${nomCulture}.`} />
      )}
      <Attente etat={etat} objet={`${departement.departement} en ${annee}`} />
      {etat === 'ok' && !f && <p className="mt-4 text-sm text-white/70">Pas de période de semis calculée pour {article}{nomCulture} dans ce département.</p>}

      {f && detail && (
        <div className="mt-5">
          <Frise decades={decades} de={f.de} a={f.a} choisie={detail.decade_semis} onChoisir={setDecade} />
          <p className="mt-3 text-sm text-white/90" aria-live="polite">
            <span className="font-medium text-white">{libelle(periodeDecades(detail.decade_semis))}</span> : {pct(detail.risque_total_pct)} de risque
            {detail.decade_conseillee ? ', le plus bas.' : (detail.risque_faux_depart_pct ?? 0) >= (detail.risque_fin_trop_tot_pct ?? 0) ? ' (un sec après le semis).' : ' (pluies finies avant la récolte).'}
          </p>
        </div>
      )}

      <Champ libelle="Culture" className="mt-4">
        <select className="champ-scene" value={culture} onChange={(e) => { setCulture(e.target.value); setDecade(null) }}>
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
