// Organisation — « Alerte récolte » (modèle 3) : les départements où la récolte risque de chuter (rendement sous
// 80 % de l'habituel). Au-dessus du seuil d'alerte, le département bat en rouge sur la carte, comme un signalement.
// « Fiable » seulement là où le modèle fait mieux que la fréquence passée (`alerte_fiable`).
import { useMemo, useState } from 'react'
import { etatPrevision, useAlerteRecolte } from '../../hooks/previsions'
import { libelle, nombre, pct } from '../../lib/format'
import { CULTURES_RENDEMENT, MOMENTS, SEUIL_ALERTE_PCT, type Moment, type PrevisionRendement } from '../../types/previsions'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { couleurChute, degrade, eclaircir, NON_DISPONIBLE, teinteChute } from '../couleurs'
import { nomMoment } from '../fiabilite'
import { Attente, ChampAnnee, MarquesRendement, MethodeModele } from '../previsions'
import { culture as cult, dire } from '../lecture'
import { Champ, Cle, Degrade, Detail, Fourchette, Groupe, Lien, Ligne, Lignes, Marque, Rang, Reponse, Segments } from '../ui'

const TOUTES = 'TOUTES'

/** L'essentiel, pour l'oreille : combien de départements en alerte, lesquels, et ce que vaut l'alerte. */
function ecouterAlerte(annee: number, moment: string, alertes: PrevisionRendement[], fiche: PrevisionRendement | undefined, rang: number, total: number): string[] {
  const fiable = (l: PrevisionRendement) => (l.alerte_fiable ? 'Cette alerte est fiable à ce moment de la saison.' : 'À ce stade, c\'est le risque habituel de ce département, pas encore une prévision de l\'année.')
  if (fiche) {
    const enAlerte = (fiche.proba_chute_pct ?? 0) >= SEUIL_ALERTE_PCT
    return [
      `${fiche.departement}, récolte ${annee}, vue à ${moment} : ${enAlerte ? 'en alerte' : 'pas en alerte'}.`,
      `Risque de chute pour ${cult.le(libelle(fiche.culture))} : ${dire.pct(fiche.proba_chute_pct)}, contre ${dire.pct(fiche.proba_chute_reference_pct)} habituellement. Rang ${rang} sur ${total}.`,
      fiable(fiche),
    ]
  }
  const n = alertes.length
  const phrases = [n ? `Récolte ${annee} : ${n} département${n > 1 ? 's sont' : ' est'} en alerte.` : `Récolte ${annee} : aucun département ne dépasse ${SEUIL_ALERTE_PCT} pour cent de risque de chute.`]
  alertes.slice(0, 5).forEach((l) => phrases.push(`${l.departement}, pour ${cult.le(libelle(l.culture))} : ${dire.pct(l.proba_chute_pct)} de risque.`))
  if (n > 5) phrases.push(`Et ${n - 5} autre${n - 5 > 1 ? 's' : ''}, sur la carte.`)
  phrases.push(`Une alerte, c'est au moins ${SEUIL_ALERTE_PCT} pour cent de risque que la récolte tombe sous 80 pour cent de l'habituel. Les départements en alerte clignotent en rouge sur la carte.`)
  if (n) phrases.push(fiable(alertes[0]))
  return phrases
}

export default function AlerteRecolte({ cadre, publier }: PropsMode) {
  const a = useAnnee(cadre, 'M3')
  const { annee } = a
  const [momentChoisi, setMoment] = useState<Moment>('FIN_JUILLET')
  const [culture, setCulture] = useState(TOUTES)
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
  const alertes = useMemo(() => classement.filter((l) => l.proba_chute_pct! >= SEUIL_ALERTE_PCT), [classement])
  const fiche = classement.find((l) => l.code_departement === code)
  const n = alertes.length

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(classement.map((l) => [l.code_departement, l]))
    return {
      aEcouter: requete.data ? ecouterAlerte(annee, nomMoment(moment), alertes, fiche, fiche ? classement.indexOf(fiche) + 1 : 0, classement.length) : undefined,
      resume: `${n} département${n > 1 ? 's' : ''} en alerte · ${annee}`,
      vue: {
        ambiance: 'crepuscule', camera: cadrer.pays(cadre, { inclinaison: 34, cap: 8 }), zones: null, relief: false, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0,
        alertes: alertes.map((l) => l.code_departement),
        departements: requete.data ? new Map(cadre.ref.departements.map((d) => [d.code_departement, { couleur: parCode.has(d.code_departement) ? eclaircir(couleurChute(parCode.get(d.code_departement)!.proba_chute_pct), 0.5) : NON_DISPONIBLE }])) : null,
      },
      legende: <Degrade titre="Risque de chute de récolte" gauche="5 %" droite="65 %" degrade={degrade((v) => eclaircir(couleurChute(v), 0.5), 5, 65)} note={`Rouge qui bat : alerte, risque d'au moins ${SEUIL_ALERTE_PCT} %. Gris : pas de série de rendement.`} />,
      infobulle: (c) => {
        const l = parCode.get(c)
        const nom = cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c
        return { titre: nom, lignes: l ? [`${l.proba_chute_pct! >= SEUIL_ALERTE_PCT ? 'ALERTE · ' : ''}${libelle(l.culture)} : ${pct(l.proba_chute_pct)} de risque`, `Habituel : ${pct(l.proba_chute_reference_pct)}`] : ['Pas de série de rendement'] }
      },
    }
  }, [classement, alertes, requete.data, n, annee, code, cadre, fiche, moment])
  usePublier(publier, sortie)

  return (
    <div>
      {fiche ? (
        <Reponse cle={`${code}-${annee}-${moment}-${culture}`} titre={fiche.departement}
          phrase={`${fiche.proba_chute_pct! >= SEUIL_ALERTE_PCT ? 'En alerte' : 'Pas en alerte'} · ${libelle(fiche.culture).toLowerCase()}, ${annee}, vu à ${nomMoment(moment)}.`}>
          <Cle valeur={nombre(fiche.proba_chute_pct)} unite="%" libelle="risque de chute de récolte" teinte={teinteChute(fiche.proba_chute_pct)} />
          <Cle valeur={nombre(fiche.proba_chute_reference_pct)} unite="%" libelle="risque habituel" />
          <Cle valeur={classement.indexOf(fiche) + 1} unite={`/ ${classement.length}`} libelle="rang" />
        </Reponse>
      ) : (
        <Reponse cle={`${annee}-${moment}-${culture}`} titre={etat === 'ok' ? `${n} département${n > 1 ? 's' : ''} en alerte` : 'Alerte récolte'}
          phrase={`Récolte ${annee}, vu à ${nomMoment(moment)} : risque d'au moins ${SEUIL_ALERTE_PCT} % de chuter sous 80 % de l'habituel.`} />
      )}
      {fiche && <div className="mt-3"><MarquesRendement ligne={fiche} quoi="alerte" /></div>}
      <Attente etat={etat} objet={`la récolte ${annee}`} lignes={5} />

      {!fiche && etat === 'ok' && (
        n > 0 ? (
          <ul className="-mx-2 mt-4">
            {alertes.map((l) => (
              <li key={l.code_departement}>
                <button type="button" onClick={() => cadre.choisir(l.code_departement)} className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left transition hover:bg-white/[0.06]">
                  <span className="point-alerte size-2.5 shrink-0 rounded-full bg-alerte-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">{l.departement}</span>
                    <span className="block text-xs text-white/55">{libelle(l.culture)}</span>
                  </span>
                  {l.alerte_fiable && <Marque ton="ferme">Fiable</Marque>}
                  <span className="text-lg font-semibold text-white tabular-nums">{nombre(l.proba_chute_pct)}<span className="ml-0.5 text-xs font-normal text-white/55">%</span></span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-4 text-sm leading-relaxed text-white/70">Aucun département n'atteint le seuil d'alerte. Le plus exposé : {classement[0] ? `${classement[0].departement}, ${pct(classement[0].proba_chute_pct)}` : 'non disponible'}.</p>
      )}
      {!fiche && n > 0 && !alertes.some((l) => l.alerte_fiable) && <p className="mt-2 text-2xs leading-snug text-white/50">Vu à {nomMoment(moment)}, c'est le risque habituel de ces départements, pas encore une prévision de l'année.</p>}

      <div className="mt-4 space-y-2">
        {a.passee && <Segments libelle="Moment de la saison" options={MOMENTS.map((m) => ({ id: m.id, libelle: m.court }))} valeur={moment} onChange={setMoment} />}
        <Champ libelle="Culture">
          <select className="champ-scene" value={culture} onChange={(e) => setCulture(e.target.value)}>
            <option value={TOUTES}>La plus exposée</option>
            {CULTURES_RENDEMENT.map((c) => <option key={c} value={c}>{libelle(c)}</option>)}
          </select>
        </Champ>
        <ChampAnnee cadre={cadre} a={a} className="" />
      </div>
      {etat === 'ok' && code && !fiche && <p className="mt-4 text-sm text-white/60">Pas de série de rendement dans ce département pour cette sélection.</p>}

      {classement.length > 0 && (
        <Detail libelle={fiche ? 'Voir le détail' : `Voir les ${classement.length} départements`}>
          {fiche && (
            <Groupe titre={`Récolte attendue · ${libelle(fiche.culture).toLowerCase()}`}>
              <Fourchette bas={fiche.rendement_bas_kg_ha} haut={fiche.rendement_haut_kg_ha} valeur={fiche.rendement_median_kg_ha} repere={fiche.tendance_kg_ha} couleur="var(--color-soleil-500)"
                description={`Rendement entre ${nombre(fiche.rendement_bas_kg_ha)} et ${nombre(fiche.rendement_haut_kg_ha, { unite: 'kg/ha' })} ; habituel ${nombre(fiche.tendance_kg_ha, { unite: 'kg/ha' })}`} />
              <p className="mt-1.5 mb-2 text-2xs text-white/45">Bande : année difficile à bonne année · trait : rendement habituel</p>
              <Lignes>
                <Ligne libelle="Fourchette" valeur={fiche.rendement_bas_kg_ha === null || fiche.rendement_haut_kg_ha === null ? 'non disponible' : `${nombre(fiche.rendement_bas_kg_ha)} – ${nombre(fiche.rendement_haut_kg_ha, { unite: 'kg/ha' })}`} detail="8 chances sur 10" />
                <Ligne libelle="Rendement habituel" valeur={fiche.tendance_kg_ha === null ? 'non disponible' : nombre(fiche.tendance_kg_ha, { unite: 'kg/ha' })} detail="10 campagnes précédentes" />
                {fiche.type_prevision !== 'PROJECTION_NON_EVALUEE' && (
                  <Ligne libelle="Réellement récolté" valeur={fiche.rendement_observe_kg_ha === null ? 'non disponible' : nombre(fiche.rendement_observe_kg_ha, { unite: 'kg/ha' })}
                    detail={fiche.chute_observee === null ? undefined : fiche.chute_observee ? 'chute observée' : 'pas de chute'} />
                )}
              </Lignes>
              {fiche.explication && <p className="mt-3 text-xs leading-relaxed text-white/60">Ce qui pèse le plus : {fiche.explication}.</p>}
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
        </Detail>
      )}
      {fiche && <div className="mt-3"><Lien onClick={() => cadre.choisir(null)}>Revenir aux alertes du pays</Lien></div>}

      <MethodeModele cibles={[{ modele: 'M3', moment, culture: culture === TOUTES ? null : culture, volet: 'alerte' }]} avertissements={requete.data?.avertissements}>
        <p>Indicatif. Alerte : risque d'au moins {SEUIL_ALERTE_PCT} % que le rendement passe sous 80 % de l'habituel (moyenne des 10 campagnes précédentes). « Fiable » : le modèle fait mieux que la fréquence passée pour cette culture à ce moment ; sinon, c'est le risque habituel du département.</p>
        <p>Le classement vient surtout du niveau et de l'irrégularité des rendements passés. Depuis 2022, aucune récolte observée ne permet de vérifier ces projections.</p>
      </MethodeModele>
    </div>
  )
}
