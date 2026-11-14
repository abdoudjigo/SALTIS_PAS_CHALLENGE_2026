// Agriculteur — « Mes besoins » : il saisit sa culture, sa surface et l'année ; il obtient ce qu'il lui faut
// (semences, engrais, fumier : dose de référence de la zone × surface) et ce qu'il peut en attendre selon le climat
// prévu cette année-là : pluie (modèle 1), récolte et production (modèle 3), période de semis (modèle 4).
// Une dose inconnue reste « à saisir », jamais zéro : l'agriculteur peut taper la sienne. L'eau d'irrigation
// n'apparaît que si la culture la demande.
import { useMemo, useState } from 'react'
import { useBesoins, useTerritoires } from '../../hooks/donnees'
import { etatPrevision, usePrevisionRendement, usePrevisionSaison, useRisqueSemis, type EtatPrevision } from '../../hooks/previsions'
import { libelle, mm, nombre, STATUTS_DOSE, VIDE } from '../../lib/format'
import type { ColonneBesoin, LigneBesoin } from '../../types/marts'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { couleurQuantite, NON_DISPONIBLE, tendance } from '../couleurs'
import { periodeDecades } from '../fiabilite'
import { ChampAnnee, MethodeModele, Morceau } from '../previsions'
import { dire } from '../lecture'
import { CLASSE_WO, cultureWo, decadeWo, FIN_WO, poidsWo, wo } from '../wolof'
import { Avis, Champ, Cle, Degrade, Detail, Groupe, Ligne, Lignes, Reponse, Squelette } from '../ui'

const INTRANTS: { colonne: ColonneBesoin; nom: string }[] = [
  { colonne: 'besoin_semences_retenu_t', nom: 'Semences' },
  { colonne: 'besoin_npk_15_15_15_t', nom: 'NPK 15-15-15' },
  { colonne: 'besoin_uree_t', nom: 'Urée' },
  { colonne: 'besoin_dap_t', nom: 'DAP' },
  { colonne: 'besoin_fumier_t', nom: 'Fumier' },
]

/** Dose par hectare retrouvée depuis le besoin du département : besoin (t) × 1000 / superficie (ha). */
function dose(ligne: LigneBesoin, colonne: ColonneBesoin) {
  if (colonne === 'besoin_semences_retenu_t' && ligne.besoin_semences_applicable === false) return null
  const besoin = ligne[colonne]
  return besoin === null || !ligne.superficie_reference_ha ? null : (besoin * 1000) / ligne.superficie_reference_ha
}
const poids = (kg: number) => (kg >= 1000 ? nombre(kg / 1000, { decimales: 1, unite: 't' }) : nombre(kg, { unite: 'kg' }))
const vide = (etat: EtatPrevision) => (etat === 'chargement' ? '…' : 'non disponible')

export default function Surface({ cadre, publier }: PropsMode) {
  const code = cadre.selection ?? cadre.user.code_departement
  const departement = cadre.ref.departements.find((d) => d.code_departement === code)
  const a = useAnnee(cadre, 'M1')
  const { annee } = a
  const { data: besoins } = useBesoins(code ? { code_departement: code } : {})
  const { data: territoires } = useTerritoires()
  const lignes = useMemo(() => (code ? (besoins ?? []).filter((b) => b.code_departement === code && b.culture).sort((x, y) => libelle(x.culture).localeCompare(libelle(y.culture), 'fr')) : []), [besoins, code])
  // Par défaut, la culture dont on connaît le plus de doses : la réponse est d'emblée utile
  const parDefaut = useMemo(() => [...lignes].sort((x, y) => INTRANTS.filter((i) => dose(y, i.colonne) !== null).length - INTRANTS.filter((i) => dose(x, i.colonne) !== null).length)[0]?.culture ?? null, [lignes])
  const [cultureChoisie, setCulture] = useState<string | null>(cadre.cultureDemandee)
  const [saisie, setSaisie] = useState('1')
  // Doses saisies par l'agriculteur (kg/ha), par culture et par intrant : gardées le temps de la session
  const [dosesSaisies, setDosesSaisies] = useState<Record<string, string>>({})
  const culture = lignes.some((l) => l.culture === cultureChoisie) ? cultureChoisie : parDefaut
  const ligne = lignes.find((l) => l.culture === culture)
  const surface = Math.max(Number(saisie.replace(',', '.')) || 0, 0)

  const intrants = ligne ? INTRANTS.map((i) => {
    const cle = `${culture}|${i.colonne}`
    const texte = dosesSaisies[cle] ?? ''
    const n = texte.trim() === '' ? null : Number(texte.replace(',', '.'))
    const reference = dose(ligne, i.colonne)
    const saisieKgHa = n !== null && Number.isFinite(n) && n >= 0 ? n : null
    return { ...i, cle, texte, reference, kgHa: reference ?? saisieKgHa, horsSujet: i.colonne === 'besoin_semences_retenu_t' && ligne.besoin_semences_applicable === false }
  }) : []
  const connus = intrants.filter((i) => i.reference !== null)

  // Le climat prévu pour l'année choisie
  const saisonReq = usePrevisionSaison(code ? annee : undefined)
  const recolteReq = usePrevisionRendement(code, annee)
  const semisReq = useRisqueSemis(code, annee, culture)
  const saison = saisonReq.data?.donnees.find((l) => l.code_departement === code)
  const recolte = recolteReq.data?.donnees.find((l) => l.culture === culture && l.moment_prevision === 'FIN_MAI')
  const semis = semisReq.data?.donnees.find((l) => l.culture === culture && l.decade_conseillee)
  const t = saison ? tendance(saison) : null
  const production = recolte && recolte.rendement_bas_kg_ha !== null && recolte.rendement_haut_kg_ha !== null ? { bas: recolte.rendement_bas_kg_ha * surface, haut: recolte.rendement_haut_kg_ha * surface } : null
  const nomCulture = culture ? libelle(culture).toLowerCase() : 'culture'
  const de = /^[aeiouéèh]/i.test(nomCulture) ? 'd’' : 'de '

  // L'essentiel, pour l'oreille : ce qu'il faut pour sa surface, puis ce que la saison laisse attendre
  const lus = intrants.map((i) => `${i.nom}|${i.kgHa}|${i.horsSujet}`).join(';')
  const aEcouter = useMemo<string[]>(() => {
    if (!departement) return ['Touchez un département sur la carte, puis choisissez la culture et la surface.']
    if (!besoins) return [] // pendant le chargement : le bouton reste désactivé
    if (!ligne) return [`Pas de culture de référence à ${departement.departement}.`]
    const phrases = [`Pour ${dire.ha(surface)} ${de}${nomCulture} à ${departement.departement}, en ${annee}, voici ce qu'il vous faut.`]
    const aSaisir: string[] = []
    intrants.forEach((i) => {
      if (i.horsSujet) return
      if (i.kgHa === null) return aSaisir.push(i.nom.toLowerCase())
      const total = i.kgHa * surface
      phrases.push(Math.round(total) === 0 ? `Pas de ${i.nom} dans la formule de la zone.` : `${i.nom} : ${dire.kg(total)}.`)
    })
    if (aSaisir.length) phrases.push(`Dose à saisir pour : ${aSaisir.join(', ')}. Elle n'est pas encore connue pour cette zone.`)
    if (t) phrases.push(`La saison ${annee} s'annonce plutôt ${t.classe}, avec ${dire.pct(t.proba)} de chances${saison?.pluie_prevue_mm != null ? ` et ${dire.mm(saison.pluie_prevue_mm)} de pluie attendus` : ''}.`)
    if (semis) phrases.push(`Semez de préférence ${periodeDecades(semis.decade_semis)}.`)
    if (production) phrases.push(`Production ${recolte?.rendement_fiable ? 'attendue' : 'habituelle'} : entre ${dire.kg(production.bas)} et ${dire.kg(production.haut)}.`)
    phrases.push('Les doses sont des références de la zone, en attente de validation par l\'ISRA. Estimations indicatives.')
    return phrases
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lus` résume les intrants (recalculés à chaque rendu)
  }, [departement, besoins, ligne, surface, de, nomCulture, annee, lus, t, saison, semis, production?.bas, production?.haut, recolte])

  const aEcouterWo = useMemo<string[] | undefined>(() => {
    if (!departement || !besoins) return undefined
    if (!ligne || !culture) return [`Amul mbay ci ${departement.departement}.`]
    const NOMS: Record<string, string> = { Semences: 'jiwu', 'NPK 15-15-15': 'N P K', 'Urée': 'ure', DAP: 'D A P', Fumier: 'fumie' }
    const ha = Number.isInteger(surface) ? wo(surface) : String(surface).replace('.', ',')
    const phrases = [`Ngir ${ha} ektaar ${cultureWo(culture)} ci ${departement.departement}, li nga soxla mooy:`]
    const aSaisir: string[] = []
    intrants.forEach((i) => {
      if (i.horsSujet) return
      const nom = NOMS[i.nom] ?? i.nom
      if (i.kgHa === null) return aSaisir.push(nom)
      const total = i.kgHa * surface
      phrases.push(Math.round(total) === 0 ? `${nom} amul.` : `${nom}: ${poidsWo(total)}.`)
    })
    if (aSaisir.length) phrases.push(`Dose bu ${aSaisir.join(', ')} xamuñu ko ba leegi.`)
    if (t) phrases.push(`Atum ${wo(annee)}, nawet bi dina am ${CLASSE_WO[t.classe] ?? t.classe}.`)
    if (semis) phrases.push(`Jiwal ${decadeWo(semis.decade_semis)}.`)
    if (production) phrases.push(`Ngóob mi ñu xaar: diggante ${poidsWo(production.bas)} ak ${poidsWo(production.haut)}.`)
    phrases.push(FIN_WO)
    return phrases
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lus` résume les intrants (recalculés à chaque rendu)
  }, [departement, besoins, ligne, culture, surface, annee, lus, t, semis, production?.bas, production?.haut])

  const sortie = useMemo<Sortie>(() => {
    const surfaces = new Map(territoires?.filter((x) => x.culture === culture).map((x) => [x.code_departement, x.superficie_reference_ha]))
    const max = Math.max(...surfaces.values(), 1)
    return {
      aEcouter,
      aEcouterWo,
      resume: departement ? `${nombre(surface, { decimales: 2 })} ha ${de}${nomCulture} · ${annee}` : 'Choisissez un département',
      vue: {
        ambiance: 'jour', camera: code ? cadrer.departement(cadre, code, { inclinaison: 42, cap: -10 }) : cadrer.pays(cadre), zones: null, relief: false, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [],
        departements: new Map(cadre.ref.departements.map((d) => [d.code_departement, { couleur: surfaces.has(d.code_departement) ? couleurQuantite(Math.sqrt(surfaces.get(d.code_departement)! / max)) : NON_DISPONIBLE }])),
      },
      legende: <Degrade titre={`Superficie ${de}${nomCulture}`} gauche="peu" droite={nombre(max, { unite: 'ha' })} degrade="linear-gradient(to right,#d5eadb,#5aa878,#12391f)" note="Superficie de référence par département. Gris : aucune." />,
      infobulle: (c) => ({ titre: cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c, lignes: [surfaces.has(c) ? `${nombre(surfaces.get(c), { unite: 'ha' })} ${de}${nomCulture}` : 'Pas de superficie de référence'] }),
    }
  }, [territoires, culture, nomCulture, de, code, cadre, departement, surface, annee, aEcouter, aEcouterWo])
  usePublier(publier, sortie)

  if (!departement) return <Reponse titre="Choisissez un département" phrase="Touchez un département sur la carte pour estimer vos besoins." />

  return (
    <div>
      <Reponse cle={`${code}-${culture}-${annee}`} titre={ligne ? `${nombre(surface, { decimales: 2 })} ha ${de}${nomCulture} en ${annee}` : departement.departement}
        phrase={ligne ? `${departement.departement}. ${t ? `Saison ${t.texte} (${nombre(t.proba)} %)` : 'Saison : prévision non disponible'}${semis ? `, à semer ${periodeDecades(semis.decade_semis)}` : ''}.` : undefined}>
        {ligne && <Cle large valeur={production ? `${nombre(production.bas / 1000, { decimales: 1 })} – ${nombre(production.haut / 1000, { decimales: 1 })}` : '—'} unite={production ? 't' : undefined} libelle={production ? 'production attendue' : `production : ${vide(etatPrevision(recolteReq))}`} />}
        {ligne && <Cle valeur={saison?.pluie_prevue_mm == null ? '—' : nombre(saison.pluie_prevue_mm)} unite={saison?.pluie_prevue_mm == null ? undefined : 'mm'} libelle="pluie attendue" />}
      </Reponse>
      {!besoins && <Squelette lignes={5} />}
      {besoins && !lignes.length && <Avis>Pas de superficie agricole de référence dans ce département : aucun besoin n'est calculé.</Avis>}

      {ligne && (
        <>
          <div className="mt-4 grid grid-cols-[1fr_6rem] gap-2">
            <Champ libelle="Culture">
              <select className="champ-scene" value={culture ?? ''} onChange={(e) => setCulture(e.target.value)}>
                {lignes.map((l) => <option key={l.culture} value={l.culture!}>{libelle(l.culture)}</option>)}
              </select>
            </Champ>
            <Champ libelle="Surface (ha)">
              <input className="champ-scene tabular-nums" inputMode="decimal" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
            </Champ>
          </div>
          <ChampAnnee cadre={cadre} a={a} saison={saison} className="mt-2" />

          <Groupe titre="Ce qu'il vous faut" complement={`${connus.length} dose${connus.length > 1 ? 's' : ''} connue${connus.length > 1 ? 's' : ''} sur ${intrants.length}`}>
            <ul className="space-y-1.5">
              {intrants.map((i) => (
                <li key={i.colonne} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-3">
                  <label htmlFor={`dose-${i.colonne}`} className="text-sm text-white/75">{i.nom}
                    {i.reference !== null && <span className="block text-2xs text-white/45">{nombre(i.reference, { decimales: 1 })} kg/ha</span>}
                    {i.reference === null && <span className="block text-2xs text-soleil-500">{i.horsSujet ? 'riz pluvial : dose à saisir' : 'dose à saisir'}</span>}
                  </label>
                  <span className="flex items-center gap-2">
                    {i.reference === null && <span className="block w-20"><input id={`dose-${i.colonne}`} className="champ-scene tabular-nums" inputMode="decimal" placeholder="kg/ha" value={i.texte} onChange={(e) => setDosesSaisies((v) => ({ ...v, [i.cle]: e.target.value }))} /></span>}
                    <span className="min-w-16 text-right text-md font-semibold text-white tabular-nums">{i.kgHa === null ? VIDE : poids(i.kgHa * surface)}</span>
                  </span>
                </li>
              ))}
              {ligne.irrigation_requise && (
                <li className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-3">
                  <span className="text-sm text-white/75">Eau d'irrigation<span className="block text-2xs text-white/45">culture irriguée · estimation, non mesurée</span></span>
                  <span className="text-right text-md font-semibold text-white tabular-nums">{ligne.volume_irrigation_m3_ha === null ? 'non disponible' : nombre(ligne.volume_irrigation_m3_ha * surface, { unite: 'm³' })}</span>
                </li>
              )}
            </ul>
            {connus.length < intrants.length && <p className="mt-2 text-2xs leading-snug text-white/50">Doses à saisir : pas encore de référence validée (en attente de l'ISRA). Votre dose sert au calcul, elle n'est pas enregistrée.</p>}
          </Groupe>

          <Groupe titre={`Ce que ${annee} laisse attendre`}>
            <dl className="-my-2 divide-y divide-white/[0.07]">
              <Morceau modele="M1" reserve={a.tendance ? 'prévision de tendance' : undefined} libelle="Pluie de la saison" valeur={saison?.pluie_prevue_mm == null ? vide(etatPrevision(saisonReq)) : mm(saison.pluie_prevue_mm)}>
                {saison && saison.pluie_basse_mm !== null && saison.pluie_haute_mm !== null && <>Entre {nombre(saison.pluie_basse_mm)} et {mm(saison.pluie_haute_mm)}. Normale : {mm(saison.pluie_normale_mm)}.</>}
              </Morceau>
              <Morceau modele="M3" reserve={recolte?.rendement_fiable ? "prévision de l'année" : 'fiabilité faible : récolte habituelle'} libelle="Récolte par hectare"
                valeur={recolte && recolte.rendement_bas_kg_ha !== null && recolte.rendement_haut_kg_ha !== null ? `${nombre(recolte.rendement_bas_kg_ha)} – ${nombre(recolte.rendement_haut_kg_ha, { unite: 'kg/ha' })}` : vide(etatPrevision(recolteReq))}>
                {production ? <>Soit {poids(production.bas)} à {poids(production.haut)} pour votre surface, d'une année difficile à une bonne année.</> : etatPrevision(recolteReq) !== 'chargement' ? `Pas de récolte attendue calculée pour ${nomCulture} en ${annee}.` : null}
              </Morceau>
              <Morceau modele="M4" libelle="Période de semis" valeur={semis ? periodeDecades(semis.decade_semis, semis.decade_semis, true) : vide(etatPrevision(semisReq))}>
                {semis ? <>{nombre(semis.risque_total_pct)} % de risque, le plus bas.</> : etatPrevision(semisReq) !== 'chargement' ? `Pas de période calculée pour ${nomCulture}.` : null}
              </Morceau>
            </dl>
          </Groupe>

          <Detail libelle="Voir le statut des doses">
            <Groupe titre="Statut des doses de référence">
              <Lignes>
                <Ligne libelle="Engrais" valeur={ligne.statut_validation_engrais ? STATUTS_DOSE[ligne.statut_validation_engrais].texte : VIDE} detail={ligne.source_reference_engrais ?? undefined} />
                <Ligne libelle="Semis" valeur={ligne.statut_validation_semis ? STATUTS_DOSE[ligne.statut_validation_semis].texte : VIDE} detail={ligne.source_reference_semis ?? undefined} />
                <Ligne libelle="Zone agroécologique" valeur={libelle(departement.zone_agroecologique)} />
              </Lignes>
            </Groupe>
          </Detail>

          <MethodeModele cibles={[{ modele: 'M1', tendance: a.tendance }, { modele: 'M3', moment: 'FIN_MAI', culture: recolte?.culture, volet: 'rendement' }, { modele: 'M4' }]}
            avertissements={[...(recolteReq.data?.avertissements ?? []), ...(semisReq.data?.avertissements ?? [])]}>
            <p>Estimation indicative : doses de référence de la zone × votre surface, pas un conseil validé pour votre parcelle. Les doses ne changent pas avec l'année ; ce qui change, c'est la pluie, la récolte et la période de semis attendues.</p>
            <p>« Dose à saisir » : aucune dose n'est connue, le besoin n'est pas calculé, il n'est pas nul. Les doses « à confirmer » ou « non vérifiées » restent à valider par l'ISRA.</p>
            <p>Production attendue = surface × fourchette de rendement du département (8 chances sur 10).</p>
          </MethodeModele>
        </>
      )}
    </div>
  )
}
