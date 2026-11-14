// Agriculteur — « Quelle culture » : les cultures du département, leurs cycles et la récolte attendue (modèle 3) ;
// la carte montre, pour la culture choisie, où elle est adaptée dans tout le pays.
import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { useChoixCultures, useTerritoires } from '../../hooks/donnees'
import { etatPrevision, usePrevisionRendement, type EtatPrevision } from '../../hooks/previsions'
import { libelle, nombre, pct } from '../../lib/format'
import type { LigneChoixCulture, NiveauAdequation } from '../../types/marts'
import type { PrevisionRendement } from '../../types/previsions'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { NIVEAUX, NON_DISPONIBLE } from '../couleurs'
import { ChampAnnee, MarquesRendement, MethodeModele } from '../previsions'
import { culture as cult, dire } from '../lecture'
import { cultureWo, FIN_WO, wo } from '../wolof'
import { Barre, Categories, Cle, Fourchette, Groupe, Reponse, Squelette } from '../ui'

const ORDRE: NiveauAdequation[] = ['adaptée', 'à risque', 'déconseillée', 'irrigation requise', 'non évaluée (culture pluriannuelle)']
/** Le cycle se dit au masculin : « cycle court », pas « cycle courte ». */
const CYCLE_DIT: Record<string, string> = { courte: 'court', moyenne: 'moyen', longue: 'long' }
const rang = (n: NiveauAdequation | null) => (n ? ORDRE.indexOf(n) : ORDRE.length)

/** Récolte attendue d'une culture (modèle 3, vue fin mai) : toujours la fourchette, et ce qu'elle vaut. */
function Recolte({ etat, ligne, annee }: { etat: EtatPrevision; ligne: PrevisionRendement | undefined; annee: number }) {
  const vide = etat === 'chargement' ? 'chargement…' : etat === 'non-chargee' ? 'prévisions pas encore chargées' : etat === 'erreur' ? 'les prévisions ne répondent pas' : etat === 'absente' ? `non disponible pour ${annee}` : !ligne ? 'non disponible pour cette culture' : null
  return (
    <div className="mt-3 border-t border-white/[0.09] pt-2.5">
      <p className="text-2xs font-medium tracking-etiquette text-white/50 uppercase">Récolte attendue <span className="tracking-normal text-white/35 normal-case">{annee}</span></p>
      {vide || !ligne ? <p className="mt-1.5 text-xs text-white/55">Récolte attendue : {vide}.</p> : (
        <>
          <p className="mt-1.5 text-sm font-medium text-white tabular-nums">
            {ligne.rendement_bas_kg_ha === null || ligne.rendement_haut_kg_ha === null ? 'Fourchette non disponible' : `${nombre(ligne.rendement_bas_kg_ha)} – ${nombre(ligne.rendement_haut_kg_ha)}`}
            <span className="ml-1 text-xs font-normal text-white/55">kg/ha · habituel {ligne.tendance_kg_ha === null ? 'non disponible' : nombre(ligne.tendance_kg_ha)}</span>
          </p>
          <div className="mt-1.5">
            <Fourchette bas={ligne.rendement_bas_kg_ha} haut={ligne.rendement_haut_kg_ha} valeur={ligne.rendement_median_kg_ha} repere={ligne.tendance_kg_ha} couleur="var(--color-soleil-500)"
              description={`Rendement entre ${nombre(ligne.rendement_bas_kg_ha)} et ${nombre(ligne.rendement_haut_kg_ha, { unite: 'kg/ha' })}, 8 chances sur 10 ; habituel ${nombre(ligne.tendance_kg_ha, { unite: 'kg/ha' })}`} />
          </div>
          <p className="mt-1 mb-2 text-2xs text-white/45">Bande : année difficile à bonne année · trait : rendement habituel</p>
          <MarquesRendement ligne={ligne} quoi="rendement" />
        </>
      )}
    </div>
  )
}

export default function Semer({ cadre, publier }: PropsMode) {
  const code = cadre.selection ?? cadre.user.code_departement
  const departement = cadre.ref.departements.find((d) => d.code_departement === code)
  const { data: choix } = useChoixCultures(code)
  const { data: territoires } = useTerritoires()
  const [cultureChoisie, setCulture] = useState<string | null>(cadre.cultureDemandee)
  // Récolte attendue pour l'année choisie, vue fin mai (avant de choisir sa culture)
  const a = useAnnee(cadre, 'M3')
  const anneeRecolte = a.annee
  const rendements = usePrevisionRendement(code, anneeRecolte)
  const etatRecolte = etatPrevision(rendements)

  const cultures = useMemo(() => {
    const groupes = new Map<string, LigneChoixCulture[]>()
    choix?.forEach((c) => groupes.set(c.culture, [...(groupes.get(c.culture) ?? []), c]))
    return [...groupes].map(([culture, options]) => {
      const cycles = options.filter((o) => o.type_option === 'CYCLE').sort((a, b) => (a.cycle_jours ?? 0) - (b.cycle_jours ?? 0))
      const meilleur = [...cycles].sort((a, b) => rang(a.niveau_adequation) - rang(b.niveau_adequation) || (b.proba_cycle_couvert_pct ?? -1) - (a.proba_cycle_couvert_pct ?? -1))[0]
      return { culture, cycles, meilleur, varietes: options.filter((o) => o.type_option === 'VARIETE') }
    }).sort((a, b) => rang(a.meilleur?.niveau_adequation ?? null) - rang(b.meilleur?.niveau_adequation ?? null) || (b.meilleur?.proba_cycle_couvert_pct ?? -1) - (a.meilleur?.proba_cycle_couvert_pct ?? -1))
  }, [choix])
  const culture = cultureChoisie ?? cultures[0]?.culture ?? null
  const compte = (n: NiveauAdequation) => cultures.filter((c) => c.meilleur?.niveau_adequation === n).length

  // L'essentiel, pour l'oreille : combien de cultures sont adaptées, les meilleures, la récolte de la culture choisie
  const aEcouter = useMemo<string[]>(() => {
    if (!departement) return ['Touchez un département sur la carte pour entendre ses cultures.']
    if (!choix) return []
    const nb = (n: NiveauAdequation) => cultures.filter((c) => c.meilleur?.niveau_adequation === n).length
    const adaptees = cultures.filter((c) => c.meilleur?.niveau_adequation === 'adaptée')
    const combien = (x: number) => (x === 0 ? 'aucune' : String(x))
    const phrases = [`À ${departement.departement}, ${adaptees.length || 'aucune'} culture${adaptees.length > 1 ? 's sont adaptées' : ' est adaptée'}, ${combien(nb('à risque'))} à risque et ${combien(nb('déconseillée'))} déconseillée${nb('déconseillée') > 1 ? 's' : ''}.`]
    adaptees.slice(0, 3).forEach((c) => phrases.push(`${libelle(c.culture)}, cycle ${CYCLE_DIT[c.meilleur?.option ?? ''] ?? c.meilleur?.option ?? ''} : la saison couvre tout le cycle ${dire.pct(c.meilleur?.proba_cycle_couvert_pct)} des années.`))
    const r = culture ? rendements.data?.donnees.find((l) => l.culture === culture && l.moment_prevision === 'FIN_MAI') : undefined
    if (culture && r && r.rendement_bas_kg_ha !== null && r.rendement_haut_kg_ha !== null)
      phrases.push(`Récolte ${r.rendement_fiable ? 'attendue' : 'habituelle'} ${cult.du(libelle(culture))} en ${anneeRecolte} : entre ${dire.nombre(r.rendement_bas_kg_ha)} et ${dire.kgHa(r.rendement_haut_kg_ha)}.`)
    phrases.push('Le pourcentage est la part des années où les pluies couvrent tout le cycle de la culture. Estimations indicatives.')
    return phrases
  }, [departement, choix, cultures, culture, rendements.data, anneeRecolte])

  const aEcouterWo = useMemo<string[] | undefined>(() => {
    if (!departement || !choix) return undefined
    const adaptees = cultures.filter((c) => c.meilleur?.niveau_adequation === 'adaptée')
    const phrases = [adaptees.length
      ? `Ci ${departement.departement}, ${wo(adaptees.length)} mbay yoo mën a bey. Yi gën: ${adaptees.slice(0, 3).map((c) => cultureWo(c.culture)).join(', ')}.`
      : `Ci ${departement.departement}, amul mbay bu baax.`]
    const r = culture ? rendements.data?.donnees.find((l) => l.culture === culture && l.moment_prevision === 'FIN_MAI') : undefined
    if (culture && r && r.rendement_bas_kg_ha !== null && r.rendement_haut_kg_ha !== null)
      phrases.push(`Ngóob ${cultureWo(culture)} ci atum ${wo(anneeRecolte)}: diggante ${wo(r.rendement_bas_kg_ha)} ak ${wo(r.rendement_haut_kg_ha)} kilo ci ektaar.`)
    phrases.push(FIN_WO)
    return phrases
  }, [departement, choix, cultures, culture, rendements.data, anneeRecolte])

  const sortie = useMemo<Sortie>(() => {
    const lignes = new Map(territoires?.filter((t) => t.culture === culture).map((t) => [t.code_departement, t]))
    return {
      aEcouter,
      aEcouterWo,
      resume: departement ? `${departement.departement} · ${culture ? libelle(culture) : 'cultures'}` : 'Choisissez un département',
      vue: {
        ambiance: 'jour', camera: cadrer.pays(cadre, { inclinaison: 28 }), zones: null, relief: false, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0,
        departements: new Map([...lignes].map(([c, t]) => [c, { couleur: t.meilleur_niveau_adequation ? NIVEAUX[t.meilleur_niveau_adequation].couleur : NON_DISPONIBLE }])),
      },
      legende: <Categories titre={culture ? libelle(culture) : 'Culture'} entrees={[...ORDRE.slice(0, 4).map((n) => NIVEAUX[n]), { couleur: NON_DISPONIBLE, libelle: 'Sans superficie de référence' }]} />,
      infobulle: (c) => {
        const t = lignes.get(c)
        const nom = cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c
        return { titre: nom, lignes: t ? [`${libelle(culture ?? '')} : ${t.meilleur_niveau_adequation ?? 'non évaluée'}`, `Cycle couvert (moyen) : ${pct(t.proba_cycle_couvert_moyen_pct)}`] : ['Pas de superficie de référence pour cette culture'] }
      },
    }
  }, [territoires, culture, code, cadre, departement, aEcouter, aEcouterWo])
  usePublier(publier, sortie)

  if (!departement) return <Reponse titre="Choisissez un département" phrase="Touchez un département sur la carte pour voir ses cultures." />

  return (
    <div>
      <Reponse cle={code} titre={departement.departement} phrase="Touchez une culture : la carte montre où elle est adaptée dans le pays.">
        <Cle valeur={choix ? compte('adaptée') : '—'} libelle="cultures adaptées" teinte={NIVEAUX['adaptée'].couleur} />
        <Cle valeur={choix ? compte('à risque') : '—'} libelle="à risque" teinte={NIVEAUX['à risque'].couleur} />
        <Cle valeur={choix ? compte('déconseillée') : '—'} libelle="déconseillées" teinte={NIVEAUX['déconseillée'].couleur} />
      </Reponse>

      <ChampAnnee cadre={cadre} a={a} />

      <Groupe titre="Cultures et cycles">
        {!choix && <Squelette lignes={6} />}
        <ul className="-mx-2">
          {cultures.map(({ culture: c, cycles, meilleur, varietes }) => {
            const niveau = meilleur?.niveau_adequation ? NIVEAUX[meilleur.niveau_adequation] : null
            const ouverte = c === culture
            return (
              <li key={c} className={clsx('rounded-md', ouverte && 'bg-white/[0.07] shadow-[inset_2px_0_0_var(--color-soleil-500)]')}>
                <button type="button" onClick={() => setCulture(c)} aria-expanded={ouverte} className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left transition hover:bg-white/[0.05]">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: niveau?.couleur ?? NON_DISPONIBLE }} aria-hidden />
                  <span className="flex-1 truncate text-sm font-medium text-white">{libelle(c)}</span>
                  <span className="text-xs text-white/60">{niveau?.libelle ?? 'Non évaluée'}</span>
                </button>
                {ouverte && (
                  <div className="maj space-y-2 px-2 pt-1 pb-3">
                    {cycles.map((o) => (
                      <div key={o.option} className="grid grid-cols-[6.5rem_1fr_2.75rem] items-center gap-2.5 text-xs text-white/65">
                        <span>{libelle(o.option)}{o.cycle_jours ? ` · ${o.cycle_jours} j` : ''}</span>
                        <Barre part={o.proba_cycle_couvert_pct} couleur={o.niveau_adequation ? NIVEAUX[o.niveau_adequation].couleur : NON_DISPONIBLE} />
                        <span className="text-right font-medium text-white tabular-nums">{pct(o.proba_cycle_couvert_pct)}</span>
                      </div>
                    ))}
                    {varietes.map((v) => (
                      <p key={v.option} className="text-xs text-white/55">Variété {v.option}{v.cycle_jours ? ` (${v.cycle_jours} j)` : ''} : {v.niveau_adequation ?? 'non évaluée'}</p>
                    ))}
                    {<Recolte etat={etatRecolte} annee={anneeRecolte} ligne={rendements.data?.donnees.find((r) => r.culture === c && r.moment_prevision === 'FIN_MAI')} />}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Groupe>

      <MethodeModele cibles={[{ modele: 'M3', moment: 'FIN_MAI', volet: 'rendement' }]} avertissements={rendements.data?.avertissements}>
        <p>La barre est la part des années (1991-2020) où la saison des pluies couvre tout le cycle. Comparez les cycles sur cette probabilité, pas sur le niveau.</p>
        <p>Niveaux indicatifs, à valider avec les conseillers agricoles. Le mil ressort « déconseillé » dans le nord alors qu'il y est cultivé : calibration en cours.</p>
        <p>Récolte attendue : fourchette du rendement, 8 chances sur 10, vue fin mai. Sauf mention « prévision de l'année », c'est la récolte habituelle du département, pas une prévision. Disponible pour l'arachide, le mil, le sorgho, le niébé et le maïs.</p>
      </MethodeModele>
    </div>
  )
}
