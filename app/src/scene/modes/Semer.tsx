// Agriculteur — « Que semer ? » : la réponse nomme la culture et le cycle à semer, la saison (carte des
// opportunités : courte, longue, contre-saison) et quoi faire ensuite ; puis les cultures, leurs cycles et la
// récolte attendue (modèle 3). La carte montre, pour la culture choisie, où elle est adaptée dans tout le pays.
//
// Pastilles de l'agriculteur : le titre ET la liste lisent le même champ, `niveau_adequation` de /choix-cultures
// (le score du projet : 0,6 × cycle couvert + 0,4 × eau couverte), triés par niveau puis par cycle couvert.
// - adaptée → ok ; à risque → attention ; déconseillée → non ; irrigation requise → info, avec le lien Contre-saison ;
//   autre niveau → info.
// - Texte : « {culture} {cycle} j : {niveau} » et la raison principale, sans seuil nouveau :
//   `proba_besoin_eau_couvert_pct` < `proba_cycle_couvert_pct` → « l'eau manque », sinon « saison trop courte ».
//   Pas de raison quand le niveau est « adaptée ».
// - La culture de l'écran : celle de la puce (cadre.culture) ; sans choix, la première de la liste triée, que la
//   puce affiche alors comme choisie (`cultureRetenue` de conseil.ts). Le titre, la première ligne, la voix, le
//   résumé et le bouton Suivant parlent de cette culture : son niveau, son meilleur cycle et la même raison.
// - Les lignes suivantes : les cultures suivantes de la liste triée (3 lignes au plus).
import clsx from 'clsx'
import { useMemo, useState, type ReactNode } from 'react'
import { useChoixCultures, useOpportunite, useTerritoires } from '../../hooks/donnees'
import { useActuelles, etatActuel, useRecolteFinMai, type EtatPrevision } from '../../hooks/previsions'
import { libelle, nombre, pct } from '../../lib/format'
import type { LigneChoixCulture, NiveauAdequation } from '../../types/marts'
import type { PrevisionRendement } from '../../types/previsions'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { NIVEAUX, NON_DISPONIBLE } from '../couleurs'
import { MarquesRendement, MethodeModele } from '../previsions'
import { cultureWo, FIN_WO, wo } from '../wolof'
import { anneesSur5, cultureRetenue, cycleDit, laCulture, repliCulture } from '../conseil'
import { aLire, CHOISIR, puceAnnee, puceCulture, type EtatLigne, type LigneCheck } from '../fiche'
import { FicheReponse } from '../FicheReponse'
import { AFaire, Barre, Categories, Cle, Cles, Fourchette, Groupe, Lien, Ligne, Lignes, LigneFiabilite, Squelette, type Action } from '../ui'

const ORDRE: NiveauAdequation[] = ['adaptée', 'à risque', 'déconseillée', 'irrigation requise', 'non évaluée (culture pluriannuelle)']
const rang = (n: NiveauAdequation | null) => (n ? ORDRE.indexOf(n) : ORDRE.length)
const ETAT_NIVEAU: Partial<Record<NiveauAdequation, EtatLigne>> = { 'adaptée': 'ok', 'à risque': 'attention', 'déconseillée': 'non', 'irrigation requise': 'info' }
/** La raison d'un niveau, sans seuil nouveau : l'eau couverte face au cycle couvert. Aucune pour « adaptée ». */
function raison(m: LigneChoixCulture) {
  const niveau = m.niveau_adequation
  if (!niveau || niveau === 'adaptée' || niveau === 'irrigation requise' || m.proba_besoin_eau_couvert_pct === null || m.proba_cycle_couvert_pct === null) return ''
  return m.proba_besoin_eau_couvert_pct < m.proba_cycle_couvert_pct ? 'l’eau manque' : 'saison trop courte'
}

/** Récolte attendue d'une culture (modèle 3, vue fin mai) : toujours la fourchette, et ce qu'elle vaut. */
function Recolte({ etat, ligne, annee, couverte }: { etat: EtatPrevision; ligne: PrevisionRendement | undefined; annee: number; couverte: boolean }) {
  const vide = !couverte ? `pas de prévision de récolte pour ${annee}` : etat === 'chargement' ? 'chargement…' : etat === 'non-chargee' ? 'prévisions pas encore chargées' : etat === 'erreur' ? 'les prévisions ne répondent pas' : etat === 'absente' ? `non disponible pour ${annee}` : !ligne ? 'non disponible pour cette culture' : null
  return (
    <div className="mt-3 border-t border-white/[0.09] pt-2.5">
      <p className="text-2xs font-medium tracking-etiquette text-white/60 uppercase">Récolte attendue <span className="tracking-normal text-white/60 normal-case">{annee}</span></p>
      {vide || !ligne ? <p className="mt-1.5 text-xs text-white/60">Récolte attendue : {vide}.</p> : (
        <>
          <p className="mt-1.5 text-sm font-medium text-white tabular-nums">
            {ligne.rendement_bas_kg_ha === null || ligne.rendement_haut_kg_ha === null ? 'Fourchette non disponible' : `${nombre(ligne.rendement_bas_kg_ha)} – ${nombre(ligne.rendement_haut_kg_ha)}`}
            <span className="ml-1 text-xs font-normal text-white/60">kg/ha · habituel {ligne.tendance_kg_ha === null ? 'non disponible' : nombre(ligne.tendance_kg_ha)}</span>
          </p>
          <div className="mt-1.5">
            <Fourchette bas={ligne.rendement_bas_kg_ha} haut={ligne.rendement_haut_kg_ha} valeur={ligne.rendement_median_kg_ha} repere={ligne.tendance_kg_ha} couleur="var(--color-soleil-500)"
              description={`Rendement entre ${nombre(ligne.rendement_bas_kg_ha)} et ${nombre(ligne.rendement_haut_kg_ha, { unite: 'kg/ha' })}, 8 chances sur 10 ; habituel ${nombre(ligne.tendance_kg_ha, { unite: 'kg/ha' })}`} />
          </div>
          <p className="mt-1 mb-2 text-2xs text-white/60">Bande : année difficile à bonne année · trait : rendement habituel</p>
          <MarquesRendement ligne={ligne} quoi="rendement" />
        </>
      )}
    </div>
  )
}

/** Une ligne du bandeau de saison : un filet de la couleur de la carte des opportunités, une phrase. */
function LigneSaison({ couleur, children }: { couleur: string; children: ReactNode }) {
  return <p className="border-l-2 pl-3 text-sm leading-relaxed text-white/80" style={{ borderColor: couleur }}>{children}</p>
}
type LigneS = { couleur: string; texte: string; lien?: string; suite?: string }
/** « MIL (SOUNA) : Mil sanio (type tardif) (135 j) ; … » → « Mil sanio (type tardif), 135 jours ; … » */
const varietesLisibles = (texte: string) => texte.split(';').map((v) => v.replace(/^[^:]+:\s*/, '').replace(/\s*\((\d+) j\)/, ', $1 jours').trim()).join(' ; ')

export default function Semer({ cadre, publier }: PropsMode) {
  const code = cadre.selection ?? cadre.user.code_departement
  const departement = cadre.ref.departements.find((d) => d.code_departement === code)
  const choix = useActuelles(useChoixCultures(code))
  const { data: territoires } = useTerritoires()
  // La carte des opportunités : saison courte ou longue, contre-saison. Absente (404) : pas de bandeau, pas d'erreur
  const { data: opportunite } = useOpportunite(code)
  // Récolte attendue pour l'année choisie, vue fin mai (avant de choisir sa culture)
  const a = useAnnee(cadre, 'M3', true)
  const anneeRecolte = a.annee
  // Année hors du modèle 3 (ex. 2019) : aucune requête (pas de 404)
  const rendementsReq = useRecolteFinMai(a.couverte ? anneeRecolte : undefined)
  const rendements = useActuelles(rendementsReq)
  const etatRecolte: EtatPrevision = a.couverte ? etatActuel(rendementsReq) : 'absente'

  const cultures = useMemo(() => {
    const groupes = new Map<string, LigneChoixCulture[]>()
    choix?.forEach((c) => groupes.set(c.culture, [...(groupes.get(c.culture) ?? []), c]))
    return [...groupes].map(([culture, options]) => {
      const cycles = options.filter((o) => o.type_option === 'CYCLE').sort((a, b) => (a.cycle_jours ?? 0) - (b.cycle_jours ?? 0))
      const meilleur = [...cycles].sort((a, b) => rang(a.niveau_adequation) - rang(b.niveau_adequation) || (b.proba_cycle_couvert_pct ?? -1) - (a.proba_cycle_couvert_pct ?? -1))[0]
      return { culture, cycles, meilleur, varietes: options.filter((o) => o.type_option === 'VARIETE') }
    }).sort((a, b) => rang(a.meilleur?.niveau_adequation ?? null) - rang(b.meilleur?.niveau_adequation ?? null) || (b.meilleur?.proba_cycle_couvert_pct ?? -1) - (a.meilleur?.proba_cycle_couvert_pct ?? -1))
  }, [choix])
  // La culture partagée si ce département la classe ; sinon la mieux classée, sans écraser le choix partagé
  const culture = useMemo(() => cultureRetenue(cadre.culture, cultures.map((c) => c.culture)), [cadre.culture, cultures])
  const repli = choix && cultures.length ? repliCulture(cadre.culture, culture) : null
  const compte = (n: NiveauAdequation) => cultures.filter((c) => c.meilleur?.niveau_adequation === n).length
  const choisie = cultures.find((c) => c.culture === culture)
  const aucune = choix !== undefined && compte('adaptée') === 0
  // La culture du titre : celle de la puce ; sans choix, la première de la liste triée
  const conseillee = choisie
  const dep = departement?.departement ?? ''

  const m = conseillee?.meilleur
  const cycleTxt = m?.option ? ` en cycle ${cycleDit(m.option)}` : ''
  const pourquoi = m ? raison(m) : ''
  const titre = !choix || !conseillee ? `À ${dep}` : aucune && conseillee === cultures[0]
    ? `À ${dep}, aucune culture adaptée : la moins risquée, ${laCulture(conseillee.culture)}${cycleTxt}`
    : m?.niveau_adequation === 'adaptée' ? `À ${dep}, semez ${laCulture(conseillee.culture)}${cycleTxt}`
      : m?.niveau_adequation === 'irrigation requise' ? `À ${dep}, ${laCulture(conseillee.culture)} demande l’irrigation`
        : m?.niveau_adequation ? `À ${dep}, ${libelle(conseillee.culture)}${cycleTxt} : ${NIVEAUX[m.niveau_adequation].libelle.toLowerCase()}${pourquoi ? `, ${pourquoi}` : ''}`
          : `À ${dep}, ${laCulture(conseillee.culture)} : niveau non disponible`
  const phrase = !choix ? undefined : [
    conseillee?.meilleur ? aucune && conseillee === cultures[0]
      ? `La moins risquée : ${laCulture(conseillee.culture)}, cycle ${cycleDit(conseillee.meilleur.option)}${conseillee.meilleur.niveau_adequation ? ` (${NIVEAUX[conseillee.meilleur.niveau_adequation].libelle.toLowerCase()})` : ''}.`
      : `${libelle(conseillee.culture)}, cycle ${cycleDit(conseillee.meilleur.option)} : la saison des pluies couvre tout le cycle ${anneesSur5(conseillee.meilleur.proba_cycle_couvert_pct)}.` : null,
  ].filter(Boolean).join(' ') || undefined
  const resume = !departement ? 'Choisissez un département' : !choix ? departement.departement : aucune && conseillee && conseillee === cultures[0]
    ? `Aucune culture sûre · ${libelle(conseillee.culture)}`
    : conseillee ? `${libelle(conseillee.culture)}${m?.option ? `, cycle ${cycleDit(m.option)}` : ''}${m?.niveau_adequation ? ` : ${NIVEAUX[m.niveau_adequation].libelle.toLowerCase()}` : ''}` : departement.departement

  // Le bandeau de saison, tiré de la carte des opportunités (jaune : saison courte, vert : longue, bleu : contre-saison)
  const saison: LigneS[] = opportunite ? ([
    opportunite.couleur_fond === 'jaune' && { couleur: 'var(--color-soleil-500)', texte: opportunite.cycle_max_conseille_j !== null ? `Saison courte : un cycle de ${nombre(opportunite.cycle_max_conseille_j)} jours au plus.` : 'Saison courte : choisissez les variétés les plus précoces.' },
    opportunite.couleur_fond === 'vert' && { couleur: 'var(--color-vert-500)', texte: 'Saison longue : un cycle long passe 4 années sur 5.' },
    opportunite.varietes_conseillees && { couleur: 'var(--color-brume)', texte: `Variétés : ${varietesLisibles(opportunite.varietes_conseillees)}.` },
    opportunite.couche_eau && { couleur: 'var(--color-ciel-vif)', texte: `Contre-saison possible : ${opportunite.conseil_agriculteur}`, lien: 'Contre-saison possible', suite: ` : ${opportunite.conseil_agriculteur}` },
    opportunite.categorie_eau === 'non évaluée' && { couleur: 'var(--color-brume)', texte: 'Contre-saison : données sur l’eau en cours d’intégration.' },
  ] as (LigneS | false | '' | null)[]).filter((x): x is LigneS => Boolean(x)) : []

  const cible = conseillee?.culture ?? culture
  const actions: Action[] = cible ? [
    { texte: `Vérifiez quand semer ${laCulture(cible)}.`, vers: { mode: 'semis', libelle: 'Quand semer ?' } },
    { texte: 'Calculez vos semences et engrais.', vers: { mode: 'surface', libelle: 'Combien ?' } },
  ] : []
  // Les actions parlent de la culture conseillée : l'écran ouvert ensuite montre la même
  const allerAvecCulture = (mode: string) => {
    if (cible && cible !== cadre.culture) cadre.choisirCulture(cible)
    cadre.aller(mode)
  }

  // La réponse en 1 à 3 lignes : la culture de l'écran d'abord, puis les suivantes de la liste triée
  const notees = cultures.filter((c) => c.meilleur?.niveau_adequation)
  const enTete = notees.filter((c) => c.culture === culture)
  const lignes: LigneCheck[] = !departement ? [CHOISIR] : [...enTete, ...notees.filter((c) => c.culture !== culture)].slice(0, 3).map(({ culture: c, meilleur: m }) => {
    const niveau = m!.niveau_adequation!
    const r = raison(m!)
    const cycle = m!.cycle_jours !== null ? ` ${nombre(m!.cycle_jours)} j` : ''
    return {
      etat: ETAT_NIVEAU[niveau] ?? 'info',
      texte: `${libelle(c)}${cycle} : **${NIVEAUX[niveau].libelle.toLowerCase()}**${r ? `, ${r}` : ''}`,
      ...(niveau === 'irrigation requise' ? { lien: { libelle: 'Contre-saison', mode: 'contreSaison' as const } } : {}),
    }
  })
  const titreFiche = !departement ? 'Choisissez un département' : titre
  const cleLignes = lignes.map((l) => l.texte).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `lignes` est résumé par `cleLignes`
  const aEcouter = useMemo<string[]>(() => (departement && !choix ? [] : aLire(titreFiche, lignes)), [departement, choix, titreFiche, cleLignes])
  // La culture dépliée dans la liste du détail : un affichage, pas un choix (le choix se fait par la puce)
  const [depliee, setDepliee] = useState<string | null>(null)
  const ouverteDe = depliee ?? culture

  const aEcouterWo = useMemo<string[] | undefined>(() => {
    if (!departement || !choix) return undefined
    const adaptees = cultures.filter((c) => c.meilleur?.niveau_adequation === 'adaptée')
    const phrases = [adaptees.length
      ? `Ci ${departement.departement}, ${wo(adaptees.length)} mbay yoo mën a bey. Yi gën: ${adaptees.slice(0, 3).map((c) => cultureWo(c.culture)).join(', ')}.`
      : `Ci ${departement.departement}, amul mbay bu baax.`]
    const r = culture ? rendements?.donnees.find((l) => l.culture === culture && l.code_departement === code && l.moment_prevision === 'FIN_MAI') : undefined
    if (culture && r && r.rendement_bas_kg_ha !== null && r.rendement_haut_kg_ha !== null)
      phrases.push(`Ngóob ${cultureWo(culture)} ci atum ${wo(anneeRecolte)}: diggante ${wo(r.rendement_bas_kg_ha)} ak ${wo(r.rendement_haut_kg_ha)} kilo ci ektaar.`)
    phrases.push(FIN_WO)
    return phrases
  }, [departement, choix, cultures, culture, rendements, anneeRecolte, code])

  const sortie = useMemo<Sortie>(() => {
    const lignes = new Map(territoires?.filter((t) => t.culture === culture).map((t) => [t.code_departement, t]))
    return {
      aEcouter,
      aEcouterWo,
      resume,
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
  }, [territoires, culture, code, cadre, aEcouter, aEcouterWo, resume])
  usePublier(publier, sortie)

  if (!departement) return <FicheReponse cadre={cadre} mode="semer" cle="aucun" titre={titreFiche} lignes={lignes} aEcouter={aEcouter} aEcouterWo={aEcouterWo} />

  const puces = [puceAnnee(cadre, a), puceCulture(cadre, cultures.map((c) => c.culture), culture)]
  const verdict = choix && conseillee?.meilleur?.niveau_adequation ? NIVEAUX[conseillee.meilleur.niveau_adequation].couleur : undefined
  return (
    <FicheReponse cadre={cadre} mode="semer" cle={`${code}-${a.annee}-${culture}`} culture={culture} puces={puces} titre={titreFiche} teinte={verdict} lignes={lignes}
      aEcouter={aEcouter} aEcouterWo={aEcouterWo}
      etat={<>
        {repli && <p className="mt-2 text-xs text-white/60">{repli}</p>}
        {!choix && <Squelette lignes={2} />}
      </>}
      detail={!choix ? undefined : (
        <>
          {phrase && <p className="mt-4 text-sm leading-relaxed text-white/70">{phrase}</p>}
          {saison.length > 0 && <div className="mt-3 space-y-1.5">{saison.map((l) => (
            <LigneSaison key={l.texte} couleur={l.couleur}>{l.lien ? <><Lien compact onClick={() => cadre.aller('contreSaison')}>{l.lien}</Lien>{l.suite}</> : l.texte}</LigneSaison>
          ))}</div>}

          <AFaire aller={allerAvecCulture} actions={actions} />

          <Cles>
            <Cle valeur={choix ? compte('adaptée') : '—'} libelle="cultures adaptées" teinte={NIVEAUX['adaptée'].couleur} />
            <Cle valeur={choix ? compte('à risque') : '—'} libelle="à risque" teinte={NIVEAUX['à risque'].couleur} />
            <Cle valeur={choix ? compte('déconseillée') : '—'} libelle="déconseillées" teinte={NIVEAUX['déconseillée'].couleur} />
          </Cles>

          <LigneFiabilite parties={['Saisons des pluies 1991-2020 du département', 'niveaux indicatifs, à valider avec les conseillers agricoles']} />

          <Groupe titre="Cultures et cycles" complement="touchez une culture">
            {!choix && <Squelette lignes={6} />}
            <ul className="-mx-2">
              {cultures.map(({ culture: c, cycles, meilleur, varietes }) => {
                const niveau = meilleur?.niveau_adequation ? NIVEAUX[meilleur.niveau_adequation] : null
                const ouverte = c === ouverteDe
                return (
                  <li key={c} className={clsx('rounded-md', ouverte && 'bg-white/[0.07] shadow-[inset_2px_0_0_var(--color-soleil-500)]')}>
                    <button type="button" onClick={() => setDepliee(ouverte ? '' : c)} aria-expanded={ouverte} className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left transition hover:bg-white/[0.05]">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: niveau?.couleur ?? NON_DISPONIBLE }} aria-hidden />
                      <span className="flex-1 truncate text-sm font-medium text-white">{libelle(c)}</span>
                      <span className="text-xs text-white/60">{niveau?.libelle ?? 'Non évaluée'}</span>
                    </button>
                    {ouverte && (
                      <div className="maj space-y-2 px-2 pt-1 pb-3">
                        {cycles.map((o) => (
                          <div key={o.option} className="grid grid-cols-[6.5rem_1fr_7.75rem] items-center gap-2.5 text-xs text-white/65"
                            role="img" aria-label={`Cycle ${cycleDit(o.option)}${o.cycle_jours ? `, ${o.cycle_jours} jours` : ''} : la saison couvre le cycle ${pct(o.proba_cycle_couvert_pct)} des années`}>
                            <span>{libelle(o.option)}{o.cycle_jours ? ` · ${o.cycle_jours} j` : ''}</span>
                            <Barre part={o.proba_cycle_couvert_pct} couleur={o.niveau_adequation ? NIVEAUX[o.niveau_adequation].couleur : NON_DISPONIBLE} />
                            <span className="text-right font-medium text-white tabular-nums">{anneesSur5(o.proba_cycle_couvert_pct)}</span>
                          </div>
                        ))}
                        {varietes.map((v) => (
                          <p key={v.option} className="text-xs text-white/60">Variété {v.option}{v.cycle_jours ? ` (${v.cycle_jours} j)` : ''} : {v.niveau_adequation ?? 'non évaluée'}</p>
                        ))}
                        {<Recolte etat={etatRecolte} annee={anneeRecolte} couverte={a.couverte} ligne={rendements?.donnees.find((r) => r.culture === c && r.code_departement === code && r.moment_prevision === 'FIN_MAI')} />}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Groupe>

          {(choisie || opportunite) && (
            <>
              {choisie && (
                <Groupe titre={`${libelle(choisie.culture)} · part des années où la saison couvre le cycle`}>
                  <Lignes>
                    {choisie.cycles.map((o) => <Ligne key={o.option} libelle={`Cycle ${cycleDit(o.option)}${o.cycle_jours ? ` (${o.cycle_jours} j)` : ''}`} valeur={pct(o.proba_cycle_couvert_pct)} detail={o.niveau_adequation ?? undefined} />)}
                  </Lignes>
                </Groupe>
              )}
              {opportunite && (
                <Groupe titre="La saison des pluies du département">
                  <Lignes>
                    <Ligne libelle="Durée atteinte 4 années sur 5" valeur={nombre(opportunite.duree_saison_courte_j, { unite: 'jours' })} />
                    <Ligne libelle="Durée moyenne" valeur={nombre(opportunite.duree_saison_moyenne_j, { unite: 'jours' })} />
                    <Ligne libelle="Plus long cycle conseillé" valeur={nombre(opportunite.cycle_max_conseille_j, { unite: 'jours' })} />
                    <Ligne libelle="Pluie normale" valeur={nombre(opportunite.pluie_saison_normale_mm, { unite: 'mm' })} detail="1991-2020" />
                    <Ligne libelle="Eau en saison sèche" valeur={libelle(opportunite.categorie_eau)} />
                  </Lignes>
                </Groupe>
              )}
            </>
          )}

          <MethodeModele cibles={[{ modele: 'M3', moment: 'FIN_MAI', volet: 'rendement' }]} avertissements={rendements?.avertissements}>
            <p>« 4 années sur 5 » arrondit la part des années (1991-2020) où la saison des pluies couvre tout le cycle ; le pourcentage exact est dans le détail. Comparez les cycles sur cette part, pas sur le niveau.</p>
            <p>Niveaux indicatifs, à valider avec les conseillers agricoles. Le mil ressort « déconseillé » dans le nord alors qu'il y est cultivé : calibration en cours.</p>
            <p>Saison courte ou longue, contre-saison : carte des opportunités (seuil de 110 jours, à valider avec l'ANCAR).</p>
            <p>Récolte attendue : fourchette du rendement, 8 chances sur 10, vue fin mai. Sauf mention « prévision de l'année », c'est la récolte habituelle du département, pas une prévision. Disponible pour l'arachide, le mil, le sorgho, le niébé et le maïs.</p>
          </MethodeModele>
        </>
      )} />
  )
}
