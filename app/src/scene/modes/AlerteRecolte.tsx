// Organisation — « Alerte récolte » (modèle 3) : les départements où la récolte risque de chuter (rendement sous
// 80 % de l'habituel). Une alerte (rouge qui bat sur la carte) exige un risque au-dessus du seuil ET une prévision
// fiable (`alerte_fiable`, regles/alertes.ts). Sans prévision fiable, un risque élevé n'est que le risque habituel.
import { useMemo, useState } from 'react'
import { etatPrevision, useAlerteRecolte } from '../../hooks/previsions'
import { libelle, nombre, pct } from '../../lib/format'
import { CULTURES_RENDEMENT, MOMENTS, SEUIL_ALERTE_PCT, type Moment, type PrevisionRendement } from '../../types/previsions'
import { cadrer, questionOng, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { couleurChute, degrade, eclaircir, NON_DISPONIBLE, teinteChute } from '../carte/couleurs'
import { estAlerte, risqueHabituelEleve } from '../regles/alertes'
import { nomMoment } from '../regles/fiabilite'
import { Attente, MarquesRendement, MethodeModele } from '../previsions'
import { aLire, puceAnnee, puceChoix, puceCulture, type LigneCheck } from '../interface/fiche'
import { FicheReponse } from '../interface/FicheReponse'
import { Cle, Cles, Degrade, Fourchette, Groupe, Lien, Ligne, Lignes, Marque, Rang } from '../interface/ui'

const TOUTES = 'TOUTES'

export default function AlerteRecolte({ cadre, publier }: PropsMode) {
  const a = useAnnee(cadre, 'M3')
  const { annee } = a
  const [momentChoisi, setMoment] = useState<Moment>('FIN_JUILLET')
  // La culture partagée (invariant I1), si le modèle 3 la couvre ; sinon la culture la plus exposée
  const culture = cadre.culture && CULTURES_RENDEMENT.includes(cadre.culture) ? cadre.culture : TOUTES
  // Une année à venir n'est vue qu'à fin mai : aucune pluie n'est encore tombée
  const moment = a.passee ? momentChoisi : 'FIN_MAI'
  const requete = useAlerteRecolte(annee, moment, culture === TOUTES ? null : culture)
  const etat = etatPrevision(requete)
  const code = cadre.selection

  // Une ligne par département : sa culture la plus exposée (ou la culture choisie)
  const classement = useMemo(() => {
    const pires = new Map<string, PrevisionRendement>()
    requete.data?.donnees.forEach((l) => {
      const m = pires.get(l.code_departement)
      if (l.proba_chute_pct !== null && (!m || l.proba_chute_pct > m.proba_chute_pct!)) pires.set(l.code_departement, l)
    })
    return [...pires.values()].sort((a, b) => b.proba_chute_pct! - a.proba_chute_pct!)
  }, [requete.data])
  // Alertes de l'année (prévision fiable) ; à part, les risques habituels élevés (sans prévision fiable)
  const alertes = useMemo(() => classement.filter(estAlerte), [classement])
  const eleves = useMemo(() => classement.filter(risqueHabituelEleve), [classement])
  const fiche = classement.find((l) => l.code_departement === code)
  const n = alertes.length
  const ne = eleves.length
  const pluriel = (k: number) => `${k} département${k > 1 ? 's' : ''}`

  // La fiche : combien en alerte, les 3 premiers, et le risque face au risque habituel
  const etatRisque = (l: PrevisionRendement): LigneCheck['etat'] => (estAlerte(l) ? 'non' : risqueHabituelEleve(l) ? 'attention' : l.proba_chute_reference_pct !== null && l.proba_chute_pct! > l.proba_chute_reference_pct ? 'attention' : 'ok')
  const premier = alertes[0] ?? classement[0]
  const titre = fiche ? fiche.departement
    : etat !== 'ok' ? 'Alerte récolte'
      : n ? `${pluriel(n)} en alerte`
        : ne ? `Pas d'alerte fiable : ${pluriel(ne)} à risque habituel élevé`
          : 'Aucune alerte récolte'
  const lignes: LigneCheck[] = etat !== 'ok' ? [] : fiche ? [
    { etat: etatRisque(fiche), texte: `Risque de chute : **${pct(fiche.proba_chute_pct)}** (${libelle(fiche.culture).toLowerCase()})` },
    { etat: 'info', texte: `Risque habituel : **${pct(fiche.proba_chute_reference_pct)}** · rang ${classement.indexOf(fiche) + 1} sur ${classement.length}` },
    fiche.alerte_fiable ? { etat: 'ok', texte: 'Alerte fiable à ce moment de la saison' } : { etat: 'info', texte: 'Risque habituel : pas encore une prévision de l’année' },
  ] : [
    n ? { etat: 'attention', texte: `**${pluriel(n)}** en alerte (prévision fiable, risque ≥ ${SEUIL_ALERTE_PCT} %)` }
      : { etat: 'info', texte: `Aucune alerte fiable pour ${annee} : le modèle ne prévoit pas encore cette récolte` },
    ...(ne ? [{ etat: 'info' as const, texte: `**${pluriel(ne)}** au risque habituel élevé (≥ ${SEUIL_ALERTE_PCT} %), sans prévision de l’année` }] : []),
    ...(classement.length ? [{ etat: 'info' as const, texte: `En tête : ${(alertes.length ? alertes : classement).slice(0, 3).map((l) => `${l.departement} (**${pct(l.proba_chute_pct)}**)`).join(', ')}` }] : []),
    ...(premier ? [{ etat: etatRisque(premier), texte: `${premier.departement} : **${pct(premier.proba_chute_pct)}**, contre ${pct(premier.proba_chute_reference_pct)} d’habitude` }] : []),
  ]
  const cleLignes = lignes.map((l) => l.texte).join('|')

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(classement.map((l) => [l.code_departement, l]))
    return {
      aEcouter: requete.data ? aLire(titre, lignes) : undefined,
      etape: {
        titre, question: questionOng('alerte'), lignes,
        legende: { titre: 'Risque de chute de récolte', entrees: [5, 25, 45, 65].map((v) => ({ couleur: eclaircir(couleurChute(v), 0.5), libelle: `${v} %` })) },
        tableau: {
          colonnes: ['Département', 'Culture', 'Risque', 'Habituel', 'Statut'],
          lignes: [...alertes, ...eleves].map((l) => [l.departement, libelle(l.culture), pct(l.proba_chute_pct), pct(l.proba_chute_reference_pct), estAlerte(l) ? 'Alerte (prévision fiable)' : 'Risque habituel élevé']),
        },
      },
      resume: n ? `${pluriel(n)} en alerte · ${annee}` : `Pas d'alerte fiable · ${annee}`,
      vue: {
        ambiance: 'crepuscule', camera: cadrer.pays(cadre, { inclinaison: 34, cap: 8 }), zones: null, relief: false, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0,
        alertes: alertes.map((l) => l.code_departement),
        departements: requete.data ? new Map(cadre.ref.departements.map((d) => [d.code_departement, { couleur: parCode.has(d.code_departement) ? eclaircir(couleurChute(parCode.get(d.code_departement)!.proba_chute_pct), 0.5) : NON_DISPONIBLE }])) : null,
      },
      legende: <Degrade titre="Risque de chute de récolte" gauche="5 %" droite="65 %" degrade={degrade((v) => eclaircir(couleurChute(v), 0.5), 5, 65)}
        note={`Rouge qui bat : alerte, risque d'au moins ${SEUIL_ALERTE_PCT} % avec une prévision fiable. Sans prévision fiable, la couleur montre le risque habituel. Gris : pas de série de rendement.`} />,
      infobulle: (c) => {
        const l = parCode.get(c)
        const nom = cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c
        const statut = l && estAlerte(l) ? 'ALERTE · ' : l && risqueHabituelEleve(l) ? 'Risque habituel élevé · ' : ''
        return { titre: nom, lignes: l ? [`${statut}${libelle(l.culture)} : ${pct(l.proba_chute_pct)} de risque`, `Habituel : ${pct(l.proba_chute_reference_pct)}`] : ['Pas de série de rendement'] }
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lignes` est résumé par `cleLignes`
  }, [classement, alertes, eleves, requete.data, n, annee, code, cadre, fiche, moment, titre, cleLignes])
  usePublier(publier, sortie)

  const puces = [
    puceAnnee(cadre, a),
    puceCulture(cadre, CULTURES_RENDEMENT, culture === TOUTES ? null : culture, 'La plus exposée'),
    ...(a.passee ? [puceChoix('moment', 'Moment de la saison', MOMENTS.map((m) => ({ id: m.id, libelle: `Vu ${m.libelle}` })), moment, setMoment)] : []),
  ]
  return (
    <FicheReponse cadre={cadre} mode="alerte" cle={`${code}-${annee}-${moment}-${culture}`} titre={titre} lignes={lignes} puces={puces} aEcouter={sortie.aEcouter}
      teinte={fiche ? teinteChute(fiche.proba_chute_pct) : undefined}
      etat={<>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">Récolte {annee}, vu à {nomMoment(moment)} : risque d'au moins {SEUIL_ALERTE_PCT} % de chuter sous 80 % de l'habituel.</p>
        {cadre.culture && culture === TOUTES && <p className="mt-1 text-xs text-white/60">{libelle(cadre.culture)} n'est pas couvert par le modèle 3 : culture la plus exposée.</p>}
        <Attente etat={etat} objet={`la récolte ${annee}`} lignes={4} />
        {etat === 'ok' && code && !fiche && <p className="mt-2 text-sm text-white/60">Pas de série de rendement dans ce département pour cette sélection.</p>}
      </>}
      detail={classement.length > 0 ? <>
        {fiche && (
          <>
            <div className="mt-3"><MarquesRendement ligne={fiche} quoi="alerte" /></div>
            <Cles>
              <Cle valeur={nombre(fiche.proba_chute_pct)} unite="%" libelle="risque de chute de récolte" teinte={teinteChute(fiche.proba_chute_pct)} />
              <Cle valeur={nombre(fiche.proba_chute_reference_pct)} unite="%" libelle="risque habituel" />
              <Cle valeur={classement.indexOf(fiche) + 1} unite={`/ ${classement.length}`} libelle="rang" />
            </Cles>
            <Groupe titre={`Récolte attendue · ${libelle(fiche.culture).toLowerCase()}`}>
              <Fourchette bas={fiche.rendement_bas_kg_ha} haut={fiche.rendement_haut_kg_ha} valeur={fiche.rendement_median_kg_ha} repere={fiche.tendance_kg_ha} couleur="var(--color-soleil-500)"
                description={`Rendement entre ${nombre(fiche.rendement_bas_kg_ha)} et ${nombre(fiche.rendement_haut_kg_ha, { unite: 'kg/ha' })} ; habituel ${nombre(fiche.tendance_kg_ha, { unite: 'kg/ha' })}`} />
              <p className="mt-1.5 mb-2 text-2xs text-white/60">Bande : année difficile à bonne année · trait : rendement habituel</p>
              <Lignes>
                <Ligne libelle="Fourchette" valeur={fiche.rendement_bas_kg_ha === null || fiche.rendement_haut_kg_ha === null ? 'non disponible' : `${nombre(fiche.rendement_bas_kg_ha)} – ${nombre(fiche.rendement_haut_kg_ha, { unite: 'kg/ha' })}`} detail="8 chances sur 10" />
                <Ligne libelle="Rendement habituel" valeur={fiche.tendance_kg_ha === null ? 'non disponible' : nombre(fiche.tendance_kg_ha, { unite: 'kg/ha' })} detail="10 campagnes précédentes" />
                {fiche.type_prevision !== 'PROJECTION_NON_EVALUEE' && (
                  <Ligne libelle="Réellement récolté" valeur={fiche.rendement_observe_kg_ha === null ? 'non disponible' : nombre(fiche.rendement_observe_kg_ha, { unite: 'kg/ha' })}
                    detail={fiche.chute_observee === null ? undefined : fiche.chute_observee ? 'chute observée' : 'pas de chute'} />
                )}
              </Lignes>
              {fiche.explication && <p className="mt-3 text-xs leading-relaxed text-white/70">Ce qui pèse le plus : {fiche.explication}.</p>}
            </Groupe>
          </>
        )}
        {!fiche && n > 0 && (
          <Groupe titre="Départements en alerte" complement={`${n}`}>
            <ul className="-mx-2">
              {alertes.map((l) => (
                <li key={l.code_departement}>
                  <button type="button" onClick={() => cadre.choisir(l.code_departement)} className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left transition hover:bg-white/[0.06]">
                    <span className="point-alerte size-2.5 shrink-0 rounded-full bg-alerte-500" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{l.departement}</span>
                      <span className="block text-xs text-white/60">{libelle(l.culture)} · habituel {pct(l.proba_chute_reference_pct)}</span>
                    </span>
                    <Marque ton="ferme">Fiable</Marque>
                    <span className="text-lg font-semibold text-white tabular-nums">{nombre(l.proba_chute_pct)}<span className="ml-0.5 text-xs font-normal text-white/60">%</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </Groupe>
        )}
        {!fiche && ne > 0 && (
          <Groupe titre="Risque habituel élevé" complement={`${ne}`}>
            <p className="mb-2 text-2xs leading-snug text-white/60">Vu à {nomMoment(moment)}, le modèle ne fait pas mieux que la fréquence passée : c'est le risque habituel de ces départements, pas une alerte pour {annee}.</p>
            <ul className="-mx-2">
              {eleves.map((l) => (
                <li key={l.code_departement}>
                  <button type="button" onClick={() => cadre.choisir(l.code_departement)} className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left transition hover:bg-white/[0.06]">
                    <span className="size-2.5 shrink-0 rounded-full bg-white/40" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{l.departement}</span>
                      <span className="block text-xs text-white/60">{libelle(l.culture)} · habituel {pct(l.proba_chute_reference_pct)}</span>
                    </span>
                    <span className="text-lg font-semibold text-white tabular-nums">{nombre(l.proba_chute_pct)}<span className="ml-0.5 text-xs font-normal text-white/60">%</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </Groupe>
        )}
        <Groupe titre="Tous les départements" complement="du plus exposé au moins exposé">
          <ol>
            {classement.map((l, i) => (
              <Rang key={l.code_departement} rang={i + 1} nom={culture === TOUTES ? `${l.departement} · ${libelle(l.culture).toLowerCase()}` : l.departement} part={(l.proba_chute_pct! / 65) * 100} couleur={couleurChute(l.proba_chute_pct)} valeur={pct(l.proba_chute_pct)}
                actif={l.code_departement === code} onClick={() => cadre.choisir(l.code_departement)} />
            ))}
          </ol>
        </Groupe>
        {fiche && <div className="mt-3"><Lien onClick={() => cadre.choisir(null)}>Revenir aux alertes du pays</Lien></div>}
        <MethodeModele cibles={[{ modele: 'M3', moment, culture: culture === TOUTES ? null : culture, volet: 'alerte' }]} avertissements={requete.data?.avertissements}>
          <p>Indicatif. Alerte : risque d'au moins {SEUIL_ALERTE_PCT} % que le rendement passe sous 80 % de l'habituel (moyenne des 10 campagnes précédentes), <strong>et</strong> prévision fiable : le modèle fait mieux que la fréquence passée pour cette culture à ce moment. Sinon, le risque affiché est le risque habituel du département : il n'est jamais présenté comme une alerte.</p>
          <p>Le classement vient surtout du niveau et de l'irrégularité des rendements passés. Depuis 2022, aucune récolte observée ne permet de vérifier ces projections.</p>
        </MethodeModele>
      </> : undefined} />
  )
}
