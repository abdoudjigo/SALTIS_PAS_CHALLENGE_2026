// Agriculteur — « Combien m'en faut-il ? » : il saisit sa culture, sa surface et l'année ; il obtient ce qu'il lui faut
// en sacs de 50 kg (semences en kg, fumier en tonnes : dose de référence de la zone × surface) et ce qu'il peut en attendre selon le climat
// prévu cette année-là : pluie (modèle 1), récolte et production (modèle 3), période de semis (modèle 4).
// Une dose inconnue reste « à saisir », jamais zéro : l'agriculteur peut taper la sienne. L'eau d'irrigation
// n'apparaît que si la culture la demande.
//
// Pastilles de l'agriculteur (statut de la dose, `statut_validation_engrais` / `statut_validation_semis` de /besoins) :
// - dose au statut VALIDEE → ok ;
// - dose A_CONFIRMER ou NON_VERIFIEE (ou sans statut) → attention, avec « à confirmer » ;
// - dose inconnue → info, « dose à saisir » ; dose tapée par l'agriculteur → info (« votre dose »).
// Les sacs : kg ÷ 50, arrondis au demi-sac supérieur (`sacs` de conseil.ts).
// Pluie (M1), récolte (M3), semis (M4 : la fenêtre de `fenetreCulture`, la même que « Quand semer ? ») : une année
// qu'un modèle ne couvre pas n'appelle pas l'API (`anneeCouverte`), le détail dit « Pas de prévision … pour {année} ».
import { useMemo, useState } from 'react'
import { useBesoins, useTerritoires } from '../../hooks/donnees'
import { useActuelles, etatActuel, useRecolteFinMai, usePrevisionSaison, useRisqueSemis, type EtatPrevision } from '../../hooks/previsions'
import { libelle, mm, nombre, pct, STATUTS_DOSE, VIDE } from '../../lib/format'
import { lireSaisie } from '../../lib/saisie'
import type { ColonneBesoin, StatutDose } from '../../types/marts'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { couleurQuantite, NON_DISPONIBLE, tendance } from '../carte/couleurs'
import { debutDecade, natureAnnee, periodeDecades } from '../regles/fiabilite'
import { MethodeModele, Morceau } from '../previsions'
import { CLASSE_WO, cultureWo, decadeWo, FIN_WO, poidsWo, wo } from '../voix/wolof'
import { cultureRetenue, dose, enSacs, fenetreCulture, heuresPompage, nombreSacs, repliCulture, sacs } from '../regles/conseil'
import { aLire, CHOISIR, puceAnnee, puceCulture, puceSurface, type LigneCheck } from '../interface/fiche'
import { FicheReponse } from '../interface/FicheReponse'
import { AFaire, Avis, Cle, Cles, Degrade, ErreurChamp, Groupe, Ligne, Lignes, LigneFiabilite, Squelette, type Action } from '../interface/ui'

/** `forme` : comment on le compte. Engrais en sacs de 50 kg, semences en kg, fumier en tonnes. */
const INTRANTS: { colonne: ColonneBesoin; nom: string; forme: 'sacs' | 'kg' | 't'; dose: 'semis' | 'engrais' }[] = [
  { colonne: 'besoin_semences_retenu_t', nom: 'Semences', forme: 'kg', dose: 'semis' },
  { colonne: 'besoin_npk_15_15_15_t', nom: 'NPK 15-15-15', forme: 'sacs', dose: 'engrais' },
  { colonne: 'besoin_uree_t', nom: 'Urée', forme: 'sacs', dose: 'engrais' },
  { colonne: 'besoin_dap_t', nom: 'DAP', forme: 'sacs', dose: 'engrais' },
  { colonne: 'besoin_fumier_t', nom: 'Fumier', forme: 't', dose: 'engrais' },
]
/** La quantité à acheter, lisible : « 6 sacs (300 kg) », « 40 kg », « 2,5 t ». */
const quantite = (forme: 'sacs' | 'kg' | 't', kg: number) => (Math.round(kg) === 0 ? 'moins de 1 kg' : forme === 'sacs' ? enSacs(kg) : forme === 'kg' ? nombre(kg, { unite: 'kg' }) : nombre(kg / 1000, { decimales: 1, unite: 't' }))
/** Statut d'une dose de référence, affiché à côté de la quantité quand elle n'est pas validée. */
const marqueStatut = (statut: StatutDose | null) => (statut && statut !== 'VALIDEE' && statut !== 'A_COMPLETER' ? STATUTS_DOSE[statut].texte : null)

const poids = (kg: number) => (kg >= 1000 ? nombre(kg / 1000, { decimales: 1, unite: 't' }) : nombre(kg, { unite: 'kg' }))
const vide = (etat: EtatPrevision) => (etat === 'chargement' ? '…' : 'non disponible')

export default function Surface({ cadre, publier }: PropsMode) {
  const code = cadre.selection ?? cadre.user.code_departement
  const departement = cadre.ref.departements.find((d) => d.code_departement === code)
  const a = useAnnee(cadre, 'M1', true)
  const aM3 = useAnnee(cadre, 'M3', true)
  const aM4 = useAnnee(cadre, 'M4', true)
  const { annee } = a
  const besoins = useActuelles(useBesoins(code ? { code_departement: code } : {}, Boolean(code)))
  const { data: territoires } = useTerritoires()
  const lignes = useMemo(() => (code ? (besoins ?? []).filter((b) => b.code_departement === code && b.culture).sort((x, y) => libelle(x.culture).localeCompare(libelle(y.culture), 'fr')) : []), [besoins, code])
  // Par défaut, la culture dont on connaît le plus de doses : la réponse est d'emblée utile
  const parDoses = useMemo(() => [...lignes].sort((x, y) => INTRANTS.filter((i) => dose(y, i.colonne) !== null).length - INTRANTS.filter((i) => dose(x, i.colonne) !== null).length).map((l) => l.culture!), [lignes])
  const [saisie, setSaisie] = useState('1')
  // Doses saisies par l'agriculteur (kg/ha), par culture et par intrant : gardées le temps de la session
  const [dosesSaisies, setDosesSaisies] = useState<Record<string, string>>({})
  // La culture partagée si le département a une superficie de référence pour elle ; sinon le choix par défaut
  const culture = useMemo(() => cultureRetenue(cadre.culture, parDoses), [cadre.culture, parDoses])
  const repli = lignes.length ? repliCulture(cadre.culture, culture) : null
  const ligne = lignes.find((l) => l.culture === culture)
  // Surface d'une exploitation : plus de 0, au plus 10 000 ha. Saisie invalide : besoins non calculés (surface 0) et message
  const lectureSurface = lireSaisie(saisie, { min: 0, minExclu: true, max: 10000, unite: 'ha' })
  const surface = lectureSurface.valeur ?? 0

  const intrants = ligne ? INTRANTS.map((i) => {
    const cle = `${culture}|${i.colonne}`
    const texte = dosesSaisies[cle] ?? ''
    const reference = dose(ligne, i.colonne)
    // Dose tapée : de 0 à 2 000 kg/ha ; une saisie invalide n'est pas comptée et affiche son message
    const lecture = lireSaisie(texte, { max: 2000, unite: 'kg/ha' })
    const saisieKgHa = lecture.valeur
    const statut = i.dose === 'semis' ? ligne.statut_validation_semis : ligne.statut_validation_engrais
    return { ...i, cle, texte, erreur: lecture.erreur, reference, kgHa: reference ?? saisieKgHa, statut: reference === null ? null : marqueStatut(statut), validee: reference !== null && statut === 'VALIDEE', horsSujet: i.colonne === 'besoin_semences_retenu_t' && ligne.besoin_semences_applicable === false }
  }) : []
  const connus = intrants.filter((i) => i.reference !== null)
  // Les sacs d'engrais : NPK, urée et DAP dont la dose est connue (ou saisie), chacun arrondi au demi-sac supérieur
  const engrais = intrants.filter((i) => i.forme === 'sacs' && i.kgHa !== null && Math.round(i.kgHa * surface) > 0)
  const nbSacs = engrais.reduce((t, i) => t + sacs(i.kgHa! * surface), 0)
  const semences = intrants.find((i) => i.forme === 'kg' && i.kgHa !== null && !i.horsSujet && Math.round(i.kgHa * surface) > 0)
  const aConfirmer = connus.some((i) => i.statut !== null)

  // Le climat prévu pour l'année choisie
  const saisonReq = usePrevisionSaison(code && a.couverte ? annee : undefined)
  // Le modèle 3 ne couvre pas toutes les années passées (ex. 2019) : hors de ses années, pas d'appel à l'API
  const recolteCouverte = aM3.couverte
  const recolteReq = useRecolteFinMai(recolteCouverte ? annee : undefined)
  const etatRecolte: EtatPrevision = recolteCouverte ? etatActuel(recolteReq) : 'absente'
  // Toutes les cultures du département, filtrées ici : la même requête que « Ma parcelle » et « Quand semer ? »,
  // déjà en cache, et pas de seconde requête quand la culture arrive avec les besoins
  const semisReq = useRisqueSemis(aM4.couverte ? code : null, annee)
  const etatSaison: EtatPrevision = a.couverte ? etatActuel(saisonReq) : 'absente'
  const etatSemis: EtatPrevision = aM4.couverte ? etatActuel(semisReq) : 'absente'
  const saisonDonnees = useActuelles(saisonReq)
  const recolteDonnees = useActuelles(recolteReq)
  const semisDonnees = useActuelles(semisReq)
  const saison = saisonDonnees?.donnees.find((l) => l.code_departement === code)
  const recolte = !recolteCouverte ? undefined : recolteDonnees?.donnees.find((l) => l.culture === culture && l.code_departement === code && l.moment_prevision === 'FIN_MAI')
  const fenetre = fenetreCulture(semisDonnees?.donnees, culture)
  const semis = fenetre?.meilleure
  // Mis en cache : un nouvel objet à chaque rendu relancerait la publication sans fin
  const t = useMemo(() => (saison ? tendance(saison) : null), [saison])
  const production = recolte && recolte.rendement_bas_kg_ha !== null && recolte.rendement_haut_kg_ha !== null ? { bas: recolte.rendement_bas_kg_ha * surface, haut: recolte.rendement_haut_kg_ha * surface } : null
  // En sacs de 100 kg tant que le nombre reste lisible, en tonnes au-delà
  const productionLue = production && production.haut < 20000
    ? { valeur: `${nombre(Math.floor(production.bas / 100))} à ${nombre(Math.ceil(production.haut / 100))}`, unite: 'sacs de 100 kg' }
    : production ? { valeur: `${nombre(production.bas / 1000, { decimales: 1 })} – ${nombre(production.haut / 1000, { decimales: 1 })}`, unite: 't' } : null
  const nomCulture = culture ? libelle(culture).toLowerCase() : 'culture'
  const de = /^[aeiouéèh]/i.test(nomCulture) ? 'd’' : 'de '
  const ha = nombre(surface, { decimales: 2 })

  const titre = !ligne ? departement?.departement ?? '' : engrais.length
    ? `Pour ${ha} ha ${de}${nomCulture} : ${nombreSacs(nbSacs)} d’engrais`
    : `Pour ${ha} ha ${de}${nomCulture} : doses d’engrais à saisir`
  const avant = fenetre ? ` avant le ${debutDecade(fenetre.debut)}` : ''
  const achats = [engrais.length ? `${nombreSacs(nbSacs)} d’engrais` : null, semences ? `${nombre(semences.kgHa! * surface)} kg de semences` : null].filter(Boolean)
  const actions: Action[] = [
    ...(achats.length ? [{ texte: `Achetez ${achats.join(' et ')}${avant}.`, vers: fenetre ? undefined : { mode: 'semis', libelle: 'Quand semer ?' } }] : []),
    ...(aConfirmer ? [{ texte: 'Demandez la bonne quantité à votre conseiller agricole : ces chiffres sont à confirmer.' }] : []),
  ]
  const resume = !departement ? 'Choisissez un département' : !ligne ? departement.departement
    : engrais.length ? `${ha} ha ${de}${nomCulture} : ${nombreSacs(nbSacs)} d’engrais` : `${ha} ha ${de}${nomCulture} : doses à saisir`

  // La réponse en 1 à 3 lignes : les sacs de chaque engrais, les semences ; « à confirmer » si la dose n'est pas validée
  // État d'une dose : validée (ok), de référence non validée (attention, « à confirmer »), tapée par l'agriculteur (info)
  const etatDose = (i: { reference: number | null; validee: boolean }): LigneCheck['etat'] => (i.reference === null ? 'info' : i.validee ? 'ok' : 'attention')
  const conf = (i: { reference: number | null; validee: boolean }) => ({ ok: '', attention: ', à confirmer', info: ', votre dose', non: '' })[etatDose(i)]
  const lignesEngrais: LigneCheck[] = engrais.map((i) => ({ etat: etatDose(i), texte: `${i.nom} : **${nombreSacs(sacs(i.kgHa! * surface))}** de 50 kg${conf(i)}` }))
  const ligneSemences: LigneCheck[] = semences ? [{ etat: etatDose(semences), texte: `Semences : **${nombre(semences.kgHa! * surface)} kg**${conf(semences)}` }] : []
  // Plus de 3 lignes : les engrais en une seule, avec l'état le moins sûr
  const etatsEngrais = engrais.map(etatDose)
  const etatEngrais: LigneCheck['etat'] = etatsEngrais.includes('attention') ? 'attention' : etatsEngrais.includes('info') ? 'info' : 'ok'
  const lignesFiche: LigneCheck[] = !departement ? [CHOISIR] : !ligne ? [] : [
    ...(!engrais.length ? [{ etat: 'info' as const, texte: 'Engrais : quantité **à saisir**' }]
      : lignesEngrais.length + ligneSemences.length > 3 ? [{ etat: etatEngrais, texte: `Engrais : **${nombreSacs(nbSacs)}** de 50 kg${etatEngrais === 'attention' ? ', à confirmer' : etatEngrais === 'info' ? ', votre dose' : ''}` }]
        : lignesEngrais),
    ...ligneSemences,
  ]
  const titreFiche = !departement ? 'Choisissez un département' : titre
  const cleLignes = lignesFiche.map((l) => l.texte).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `lignesFiche` est résumé par `cleLignes`
  const aEcouter = useMemo<string[]>(() => (departement && !besoins ? [] : departement && !ligne ? [`Pas de culture de référence à ${departement.departement}.`] : aLire(titreFiche, lignesFiche)), [departement, besoins, ligne, titreFiche, cleLignes])

  const lus = intrants.map((i) => `${i.nom}|${i.kgHa}|${i.horsSujet}`).join(';')
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
      phrases.push(Math.round(i.kgHa) === 0 ? `${nom} amul.` : `${nom}: ${poidsWo(total)}.`)
    })
    if (aSaisir.length) phrases.push(`Dose bu ${aSaisir.join(', ')} xamuñu ko ba leegi.`)
    if (semis) phrases.push(`Jiwal ${decadeWo(semis.decade_semis)}.`)
    if (t) phrases.push(`Atum ${wo(annee)}, nawet bi dina am ${CLASSE_WO[t.classe] ?? t.classe}.`)
    if (production) phrases.push(`Ngóob mi ñu xaar: diggante ${poidsWo(production.bas)} ak ${poidsWo(production.haut)}.`)
    phrases.push(FIN_WO)
    return phrases
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lus` résume les intrants (recalculés à chaque rendu)
  }, [departement, besoins, ligne, culture, surface, annee, lus, t, semis, production?.bas, production?.haut])

  // La carte ne dépend que de la culture : taper la surface ne recolore pas les 45 départements
  const { ref } = cadre
  const { surfaces, max, departements } = useMemo(() => {
    const surfaces = new Map(territoires?.filter((x) => x.culture === culture).map((x) => [x.code_departement, x.superficie_reference_ha]))
    const max = Math.max(...surfaces.values(), 1)
    const departements = new Map(ref.departements.map((d) => [d.code_departement, { couleur: surfaces.has(d.code_departement) ? couleurQuantite(Math.sqrt(surfaces.get(d.code_departement)! / max)) : NON_DISPONIBLE }]))
    return { surfaces, max, departements }
  }, [territoires, culture, ref])
  const sortie = useMemo<Sortie>(() => {
    return {
      aEcouter,
      aEcouterWo,
      resume,
      vue: {
        ambiance: 'jour', camera: code ? cadrer.departement(cadre, code, { inclinaison: 42, cap: -10 }) : cadrer.pays(cadre), zones: null, relief: false, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [],
        departements,
      },
      legende: <Degrade titre={`Superficie ${de}${nomCulture}`} gauche="peu" droite={nombre(max, { unite: 'ha' })} degrade="linear-gradient(to right,#d5eadb,#5aa878,#12391f)" note="Superficie de référence par département. Gris : aucune." />,
      infobulle: (c) => ({ titre: cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c, lignes: [surfaces.has(c) ? `${nombre(surfaces.get(c), { unite: 'ha' })} ${de}${nomCulture}` : 'Pas de superficie de référence'] }),
    }
  }, [surfaces, max, departements, nomCulture, de, code, cadre, aEcouter, aEcouterWo, resume])
  usePublier(publier, sortie)

  if (!departement) return <FicheReponse cadre={cadre} mode="surface" cle="aucun" titre={titreFiche} lignes={lignesFiche} aEcouter={aEcouter} aEcouterWo={aEcouterWo} />

  const puces = [puceAnnee(cadre, a, saison), ...(lignes.length ? [puceCulture(cadre, lignes.map((l) => l.culture!), culture), puceSurface(saisie, setSaisie, ha, lectureSurface.erreur)] : [])]
  return (
    <FicheReponse cadre={cadre} mode="surface" cle={`${code}-${culture}-${annee}`} culture={culture} puces={puces} titre={titreFiche} lignes={lignesFiche}
      aEcouter={aEcouter} aEcouterWo={aEcouterWo}
      etat={<>
        {repli && <p className="mt-2 text-xs text-white/60">{repli}</p>}
        {!besoins && <Squelette lignes={5} />}
        {besoins && !lignes.length && <Avis>Pas de superficie agricole de référence dans ce département : aucun besoin n'est calculé.</Avis>}
      </>}
      detail={!ligne ? undefined : (
        <>
          <p className="mt-4 text-sm leading-relaxed text-white/70">{`${departement.departement} · ${annee}. ${t ? `Saison ${t.texte} (prévision)` : 'Saison : prévision non disponible'}${semis ? `, à semer ${periodeDecades(semis.decade_semis)}` : ''}.`}</p>
          <AFaire aller={cadre.aller} actions={actions} />

          <Groupe titre="Ce qu'il vous faut" complement={`${connus.length} dose${connus.length > 1 ? 's' : ''} connue${connus.length > 1 ? 's' : ''} sur ${intrants.length}`}>
            <ul className="space-y-1.5">
              {intrants.map((i) => (
                <li key={i.colonne} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-3">
                  <label htmlFor={`dose-${i.colonne}`} className="text-sm text-white/75">{i.nom}
                    {i.reference !== null && <span className="block text-2xs text-white/60">{nombre(i.reference, { decimales: 1 })} kg pour 1 ha{i.statut && Math.round(i.reference) > 0 && <> · <span className="text-soleil-500">{i.statut}</span></>}</span>}
                    {i.reference === null && <span className="block text-2xs text-soleil-500">{i.horsSujet ? 'riz pluvial : dose à saisir' : 'dose à saisir'}</span>}
                  </label>
                  <span className="flex items-center gap-2">
                    {i.reference === null && <span className="block w-32"><input id={`dose-${i.colonne}`} className="champ-scene tabular-nums" inputMode="decimal" placeholder="kg pour 1 ha" aria-label={`${i.nom} : dose en kg pour 1 ha`} value={i.texte} onChange={(e) => setDosesSaisies((v) => ({ ...v, [i.cle]: e.target.value }))}
                      aria-invalid={Boolean(i.erreur)} aria-describedby={i.erreur ? `erreur-dose-${i.colonne}` : undefined} /></span>}
                    {i.kgHa !== null && Math.round(i.kgHa) === 0
                      ? <span className="max-w-32 text-right text-xs text-white/60">pas dans la formule de la zone</span>
                      : <span className="max-w-40 text-right text-sm font-semibold text-white tabular-nums">{i.kgHa === null ? VIDE : quantite(i.forme, i.kgHa * surface)}</span>}
                  </span>
                  {i.erreur && <ErreurChamp id={`erreur-dose-${i.colonne}`} className="col-span-2 mt-0">{i.nom} : {i.erreur}</ErreurChamp>}
                </li>
              ))}
              {ligne.irrigation_requise && (
                <li className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-3">
                  <span className="text-sm text-white/75">Eau d'irrigation<span className="block text-2xs text-white/60">culture irriguée · estimation, non mesurée</span></span>
                  {ligne.volume_irrigation_m3_ha === null
                    ? <span className="text-right text-sm font-semibold text-white tabular-nums">non disponible</span>
                    : <span className="max-w-48 text-right text-xs leading-snug text-white/75 tabular-nums"><span className="text-sm font-semibold text-white">{nombre(ligne.volume_irrigation_m3_ha * surface, { unite: 'm³' })}</span> pour vos {nombre(surface, { decimales: surface % 1 ? 2 : 0 })} ha, soit {heuresPompage(ligne.volume_irrigation_m3_ha * surface)} de pompage à 1 L/s</span>}
                </li>
              )}
            </ul>
            {connus.length < intrants.length && <p className="mt-2 text-2xs leading-snug text-white/60">Doses à saisir : pas encore de référence validée (en attente de l'ISRA). Votre dose sert au calcul, elle n'est pas enregistrée.</p>}
          </Groupe>

          <Cles>
            <Cle large valeur={productionLue?.valeur ?? '—'} unite={productionLue?.unite} libelle={productionLue ? `de récolte, d’une année difficile à une bonne année${recolte?.rendement_fiable ? '' : ' (récolte habituelle)'}` : `récolte : ${vide(etatRecolte)}`} />
            <Cle valeur={saison?.pluie_prevue_mm == null ? '—' : nombre(saison.pluie_prevue_mm)} unite={saison?.pluie_prevue_mm == null ? undefined : 'mm'} libelle={t ? `de pluie attendue, saison ${t.texte}` : 'de pluie attendue'} />
          </Cles>

          <LigneFiabilite marques={[...new Set(connus.map((i) => i.statut).filter((x): x is string => x !== null))].map((m) => `Dose ${m.toLowerCase()} (ISRA)`)}
            parties={['Doses de référence de la zone, pas de votre parcelle', natureAnnee(annee, a.aVenir, saison)]} />


            <Groupe titre={`Ce que ${annee} laisse attendre`}>
              <dl className="-my-2 divide-y divide-white/[0.07]">
                <Morceau modele="M1" reserve={a.tendance ? 'prévision de tendance' : undefined} libelle="Pluie de la saison" valeur={saison?.pluie_prevue_mm == null ? vide(etatSaison) : mm(saison.pluie_prevue_mm)}>
                  {saison && saison.pluie_basse_mm !== null && saison.pluie_haute_mm !== null && <>Entre {nombre(saison.pluie_basse_mm)} et {mm(saison.pluie_haute_mm)}. Normale : {mm(saison.pluie_normale_mm)}.</>}
                </Morceau>
                <Morceau modele="M3" reserve={recolte?.rendement_fiable ? "prévision de l'année" : 'fiabilité faible : récolte habituelle'} libelle="Récolte par hectare"
                  valeur={recolte && recolte.rendement_bas_kg_ha !== null && recolte.rendement_haut_kg_ha !== null ? `${nombre(recolte.rendement_bas_kg_ha)} – ${nombre(recolte.rendement_haut_kg_ha, { unite: 'kg/ha' })}` : vide(etatRecolte)}>
                  {production ? <>Soit {poids(production.bas)} à {poids(production.haut)} pour votre surface, d'une année difficile à une bonne année.</> : !recolteCouverte ? `Pas de prévision de récolte pour ${annee}` : etatRecolte !== 'chargement' ? `Pas de récolte attendue calculée pour ${nomCulture} en ${annee}.` : null}
                </Morceau>
                <Morceau modele="M4" libelle="Période de semis" valeur={semis ? periodeDecades(semis.decade_semis, semis.decade_semis, true) : vide(etatSemis)}>
                  {semis ? <>{pct(semis.risque_total_pct)} de risque, le plus bas.</> : !aM4.couverte ? `Pas de prévision de semis pour ${annee}.` : etatSemis !== 'chargement' ? `Pas de période calculée pour ${nomCulture}.` : null}
                </Morceau>
              </dl>
            </Groupe>
            <Groupe titre="Statut des doses de référence">
              <Lignes>
                <Ligne libelle="Engrais" valeur={ligne.statut_validation_engrais ? STATUTS_DOSE[ligne.statut_validation_engrais].texte : VIDE} detail={ligne.source_reference_engrais ?? undefined} />
                <Ligne libelle="Semis" valeur={ligne.statut_validation_semis ? STATUTS_DOSE[ligne.statut_validation_semis].texte : VIDE} detail={ligne.source_reference_semis ?? undefined} />
                <Ligne libelle="Zone agroécologique" valeur={libelle(departement.zone_agroecologique)} />
              </Lignes>
            </Groupe>

          <MethodeModele cibles={[{ modele: 'M1', tendance: a.tendance }, { modele: 'M3', moment: 'FIN_MAI', culture: recolte?.culture, volet: 'rendement' }, { modele: 'M4' }]}
            avertissements={[...(saisonDonnees?.avertissements ?? []), ...(recolteDonnees?.avertissements ?? []), ...(semisDonnees?.avertissements ?? [])]}>
            <p>C’est une estimation : la quantité conseillée dans votre zone, multipliée par votre surface. Ce n’est pas un conseil fait pour votre champ. Les quantités ne changent pas d’une année à l’autre ; ce qui change, c’est la pluie, la récolte et la date de semis.</p>
            <p>Les engrais sont comptés en sacs de 50 kilos, arrondis au demi-sac au-dessus ; le poids exact est entre parenthèses.</p>
            <p>« À saisir » : on ne connaît pas encore la quantité, donc le besoin n’est pas calculé (il n’est pas nul). Les quantités « à confirmer » doivent encore être validées par l’institut de recherche agricole (ISRA).</p>
            <p>Récolte attendue : votre surface multipliée par la récolte habituelle d’un hectare dans le département, dans 8 cas sur 10. Elle est comptée en sacs de 100 kilos.</p>
          </MethodeModele>
        </>
      )} />
  )
}
