// Agriculteur — « Ma parcelle » : on se localise, la carte descend du pays jusqu'au champ,
// et la fenêtre donne le sol, les risques et les cultures adaptées du département, puis ce que disent les
// modèles pour la campagne : saison attendue (modèle 1), décade de semis (modèle 4), récolte habituelle (modèle 3).
//
// Pastilles de l'agriculteur (aucun seuil propre à l'écran) :
// - Jours d'eau gardés par le sol : `reserve_utile_mm` ÷ 4 mm par jour (règle du dataset, `joursEau` de conseil.ts) → info.
// - Saison attendue : la classe la plus probable du modèle 1 (`classe_prevue`) ; « sèche » → attention, sinon ok.
// - Sol : seulement si l'API recommande un amendement (`amendement_ph_recommande`, valeur de zone de
//   /agrodistrib/territoires) → attention. Sinon, pas de ligne. Aucun seuil de pH en dur.
// Semis (M4) et récolte (M3) parlent de la culture conseillée (celle choisie, sinon la mieux adaptée), la même que
// « Que faire » et le bouton Suivant ; une année qu'un modèle ne couvre pas n'appelle pas l'API (`anneeCouverte`).
import { LocateFixed } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useBesoins, useCarte, useChoixCultures, useTerritoires, useVulnerabilite } from '../../hooks/donnees'
import { useActuelles, etatActuel, useRecolteFinMai, usePrevisionSaison, useRisqueSemis, type EtatPrevision } from '../../hooks/previsions'
import { libelle, mm, nombre, pct } from '../../lib/format'
import { lireNombre } from '../../lib/saisie'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { NIVEAUX, teinteVulnerabilite, tendance } from '../couleurs'
import { cleZone, trouverDepartement, ZONE_PAR_CLE, type LonLat } from '../geo'
import { natureAnnee, periodeDecades } from '../fiabilite'
import { Attente, MethodeModele, Morceau } from '../previsions'
import { CLASSE_WO, cultureWo, decadeWo, FIN_WO, wo } from '../wolof'
import { cycleDit, fenetreCulture, joursEau, laCulture, nombreSacs, sacsEngraisParHa, texteJoursEau } from '../conseil'
import { aLire, puceAnnee, type LigneCheck } from '../fiche'
import { FicheReponse } from '../FicheReponse'
import { AFaire, Avis, Bouton, Cle, Cles, Groupe, Lien, Ligne, Lignes, LigneFiabilite, Pastille, Rang, Squelette, type Action } from '../ui'
import { Avis, Bouton, Cle, ErreurChamp, Detail, Groupe, Lien, Ligne, Lignes, Pastille, Rang, Reponse, Squelette } from '../ui'

const vide = (etat: EtatPrevision) => (etat === 'chargement' ? '…' : 'non disponible')

type Etat = 'repos' | 'recherche' | 'refus' | 'indisponible'

function lecturePh(ph: number | null) {
  if (ph === null) return undefined
  if (ph < 5.5) return 'acide'
  if (ph < 6.5) return 'légèrement acide'
  if (ph <= 7.5) return 'neutre'
  return 'basique'
}

type DonneesParcelle = {
  position: LonLat | null
  departement: { departement: string; region: string; zone_agroecologique: string } | undefined
  sol: { classe_texture: string | null; ph_eau: number | null; reserve_utile_mm: number | null } | undefined
  choix: unknown[] | undefined
  adaptees: { culture: string }[]
  attendue: Parameters<typeof tendance>[0] & { pluie_prevue_mm: number | null } | undefined
  annee: number
  semis: { culture: string; decade_semis: number } | undefined
  recolte: { culture: string; rendement_fiable: boolean | null; rendement_bas_kg_ha: number | null; rendement_haut_kg_ha: number | null } | undefined
  vulnerabilite: { freq_alerte_secheresse_pct: number | null; classe_vulnerabilite: string | null } | undefined
}

/** La même chose en wolof (mascotte « WLF »). Une phrase par ligne. */
function useTexteParcelleWo({ position, departement, choix, adaptees, attendue, annee, semis, recolte }: DonneesParcelle): string {
  if (!position) return 'Wonal ma sa tool ci kart bi, walla nga bind ay koordone yi.'
  if (!departement) return 'Bérab bii nekkul ci Senegaal.'
  const phrases = [`Sa tool mi ngi ci departemaa ${departement.departement}, ci diiwaanu ${departement.region}.`]
  if (choix) phrases.push(adaptees.length
    ? `${wo(adaptees.length)} mbay yoo mën a bey fi. Yi gën: ${adaptees.slice(0, 3).map((c) => cultureWo(c.culture)).join(', ')}.`
    : 'Amul mbay bu baax fi.')
  const t = attendue ? tendance(attendue) : null
  if (t) phrases.push(`Atum ${wo(annee)}, nawet bi dina am ${CLASSE_WO[t.classe] ?? t.classe}${attendue?.pluie_prevue_mm != null ? `, ak ${wo(attendue.pluie_prevue_mm)} milimetar taw` : ''}.`)
  if (semis) phrases.push(`${cultureWo(semis.culture)}: jamono ji gën ngir ji mooy ${decadeWo(semis.decade_semis)}.`)
  if (recolte && recolte.rendement_bas_kg_ha !== null && recolte.rendement_haut_kg_ha !== null)
    phrases.push(`Ngóob ${cultureWo(recolte.culture)}: diggante ${wo(recolte.rendement_bas_kg_ha)} ak ${wo(recolte.rendement_haut_kg_ha)} kilo ci ektaar.`)
  phrases.push(FIN_WO)
  return phrases.join('\n')
}

export default function Parcelle({ cadre, publier }: PropsMode) {
  const { position, definirPosition, contours, ref, choisir } = cadre
  const [etat, setEtat] = useState<Etat>('repos')
  const [saisie, setSaisie] = useState({ lat: '', lon: '' })

  const code = useMemo(() => (position ? trouverDepartement(contours, position[0], position[1]) : null), [position, contours])
  useEffect(() => {
    if (code) choisir(code)
  }, [code, choisir])

  const departement = ref.departements.find((d) => d.code_departement === code)
  const { data: territoires } = useTerritoires()
  const { data: vulnerabilites } = useVulnerabilite()
  const choix = useActuelles(useChoixCultures(code))
  const sol = territoires?.find((t) => t.code_departement === code)
  const vulnerabilite = vulnerabilites?.find((v) => v.code_departement === code)

  // Pour chaque culture, son meilleur cycle ; on ne garde que les cultures « adaptées »
  const adaptees = useMemo(() => {
    const meilleures = new Map<string, NonNullable<typeof choix>[number]>()
    choix?.filter((c) => c.type_option === 'CYCLE' && c.niveau_adequation === 'adaptée').forEach((c) => {
      const m = meilleures.get(c.culture)
      if (!m || (c.proba_cycle_couvert_pct ?? 0) > (m.proba_cycle_couvert_pct ?? 0)) meilleures.set(c.culture, c)
    })
    return [...meilleures.values()].sort((a, b) => (b.proba_cycle_couvert_pct ?? 0) - (a.proba_cycle_couvert_pct ?? 0))
  }, [choix])

  // Ce que disent les modèles pour la campagne la plus récente de chacun
  // L'année choisie, prévue par les trois modèles (une année passée hors d'un modèle y est « non disponible »)
  // L'année choisie, la même pour les trois modèles ; une année hors d'un modèle n'appelle pas l'API (pas de 404)
  const a = useAnnee(cadre, 'M1', true)
  const aM3 = useAnnee(cadre, 'M3', true)
  const aM4 = useAnnee(cadre, 'M4', true)
  const annee = a.annee
  const prevSaison = usePrevisionSaison(code && a.couverte ? annee : undefined)
  const prevSemis = useRisqueSemis(aM4.couverte ? code : null, annee)
  const prevRecolte = useRecolteFinMai(aM3.couverte ? annee : undefined)
  const saisonDonnees = useActuelles(prevSaison)
  const semisDonnees = useActuelles(prevSemis)
  const recolteDonnees = useActuelles(prevRecolte)
  const etats: EtatPrevision[] = [a.couverte ? etatActuel(prevSaison) : 'absente', aM4.couverte ? etatActuel(prevSemis) : 'absente', aM3.couverte ? etatActuel(prevRecolte) : 'absente']
  // La dernière saison observée, ou l'année choisie si elle est passée
  const anneeObservee = a.passee ? annee : ref.campagnes.at(-1)
  const saison = useActuelles(useCarte(anneeObservee))?.find((s) => s.code_departement === code)
  const attendue = saisonDonnees?.donnees.find((l) => l.code_departement === code)
  // Une culture déjà choisie (« Que semer ? ») passe en premier
  const partagee = cadre.culture && choix?.some((c) => c.culture === cadre.culture) ? cadre.culture : null
  // La culture à conseiller : celle choisie, sinon la mieux adaptée ; sans culture adaptée, la moins risquée
  const ORDRE_NIVEAUX = ['adaptée', 'à risque', 'déconseillée']
  const moinsRisquee = [...(choix ?? [])].filter((c) => c.type_option === 'CYCLE' && c.niveau_adequation && ORDRE_NIVEAUX.includes(c.niveau_adequation))
    .sort((x, y) => ORDRE_NIVEAUX.indexOf(x.niveau_adequation!) - ORDRE_NIVEAUX.indexOf(y.niveau_adequation!) || (y.proba_cycle_couvert_pct ?? -1) - (x.proba_cycle_couvert_pct ?? -1))[0]?.culture ?? null
  const conseillee = partagee ?? adaptees[0]?.culture ?? moinsRisquee
  const cycleConseille = conseillee ? [...(choix ?? [])].filter((c) => c.type_option === 'CYCLE' && c.culture === conseillee)
    .sort((x, y) => (x.niveau_adequation === 'adaptée' ? 0 : 1) - (y.niveau_adequation === 'adaptée' ? 0 : 1) || (y.proba_cycle_couvert_pct ?? -1) - (x.proba_cycle_couvert_pct ?? -1))[0] : undefined
  const fenetre = fenetreCulture(semisDonnees?.donnees, conseillee)
  // Semis et récolte : la culture conseillée, comme « Que faire » (le modèle 4 couvre 8 cultures, le modèle 3 en couvre 5)
  const semis = fenetre?.meilleure
  const recolte = conseillee ? recolteDonnees?.donnees.find((l) => l.culture === conseillee && l.code_departement === code && l.moment_prevision === 'FIN_MAI') : undefined
  const nomConseillee = conseillee ? libelle(conseillee).toLowerCase() : ''
  const { data: besoins } = useBesoins({ code_departement: code ?? undefined }, Boolean(code))
  const sacsHa = sacsEngraisParHa(besoins?.find((b) => b.code_departement === code && b.culture === conseillee))

  function localiser() {
    if (!navigator.geolocation) return setEtat('indisponible')
    setEtat('recherche')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setEtat('repos')
        definirPosition([p.coords.longitude, p.coords.latitude])
      },
      (e) => setEtat(e.code === e.PERMISSION_DENIED ? 'refus' : 'indisponible'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }
  // Coordonnées en degrés décimaux. Le Sénégal est vers 12 à 17° de latitude et -17,5 à -11° de longitude :
  // deux valeurs dans ces plages mais interverties sont signalées (erreur fréquente). Un point valide hors du pays
  // est accepté, puis signalé « hors du Sénégal » après recherche du département.
  const lectureLat = lireNombre(saisie.lat, { min: -90, max: 90, negatif: true, unite: '°' })
  const lectureLon = lireNombre(saisie.lon, { min: -180, max: 180, negatif: true, unite: '°' })
  const [lat, lon] = [lectureLat.valeur ?? NaN, lectureLon.valeur ?? NaN]
  const saisieValide = lectureLat.valeur !== null && lectureLon.valeur !== null
  const interverties = saisieValide && lat < -10 && lat > -18 && lon > 11 && lon < 17.5
  const erreurCoordonnees = lectureLat.erreur ? `Latitude : ${lectureLat.erreur}` : lectureLon.erreur ? `Longitude : ${lectureLon.erreur}` : null

  // La réponse : où est le champ et combien de cultures y réussissent ; le sol dit simplement
  const texture = sol?.classe_texture ? libelle(sol.classe_texture).toLowerCase() : null
  const n = adaptees.length
  const titre = !departement ? '' : !choix ? `Votre champ est à ${departement.departement}`
    : n ? `Votre champ est à ${departement.departement} : ${n} culture${n > 1 ? 's y réussissent' : ' y réussit'}`
      : `Votre champ est à ${departement.departement} : aucune culture pluviale n’y réussit 4 années sur 5`
  const phrase = departement
    ? [texture ? `Terre ${texture}${lecturePh(sol?.ph_eau ?? null) ? `, ${lecturePh(sol!.ph_eau)}` : ''}.` : null, sol ? texteJoursEau(sol.reserve_utile_mm) : null].filter(Boolean).join(' ')
    : null
  const jours = joursEau(sol?.reserve_utile_mm)
  const tAttendue = attendue ? tendance(attendue) : null

  // Que faire : quoi semer, quand, et combien d'engrais pour 1 ha (seulement si les doses existent)
  const actions: Action[] = [
    ...(conseillee ? [{ texte: adaptees.length || partagee
      ? `Commencez par ${laCulture(conseillee)}${cycleConseille ? `, cycle ${cycleDit(cycleConseille.option)}` : ''}.`
      : `Choisissez la culture la moins risquée : ${laCulture(conseillee)}${cycleConseille ? `, cycle ${cycleDit(cycleConseille.option)}` : ''}.`, vers: { mode: 'semer', libelle: 'Que semer ?' } }] : []),
    ...(fenetre ? [{ texte: fenetre.sur ? `Semez ${periodeDecades(fenetre.debut, fenetre.fin)}.` : `Semez de préférence ${periodeDecades(fenetre.meilleure.decade_semis)} : aucune période n’est vraiment sûre.`, vers: { mode: 'semis', libelle: 'Quand semer ?' } }] : []),
    ...(sacsHa !== null ? [{ texte: `Préparez ${nombreSacs(sacsHa)} d’engrais pour 1 ha.`, vers: { mode: 'surface', libelle: 'Combien ?' } }] : []),
  ]
  // Les actions parlent de la culture conseillée : l'écran ouvert ensuite montre la même
  const allerAvecCulture = (mode: string) => {
    if (conseillee && conseillee !== cadre.culture) cadre.choisirCulture(conseillee)
    cadre.aller(mode)
  }

  // Des chaînes, pas l'objet : le compilateur React sait qu'elles ne seront pas modifiées
  const [nomDep, regionDep, zoneDep] = [departement?.departement, departement?.region, departement?.zone_agroecologique]
  // La réponse en 1 à 3 lignes : l'eau gardée par le sol, la saison attendue, une alerte sol s'il y en a une
  const lignesFiche: LigneCheck[] = !departement ? [{ etat: 'info', texte: 'Ou touchez votre champ sur la carte' }] : [
    ...(sol && jours !== null ? [{ etat: 'info' as const, texte: jours === 0 ? 'Le sol garde l’eau **moins de 5 jours** sans pluie' : `Le sol garde l’eau **${jours} jours** sans pluie` }] : []),
    ...(tAttendue ? [{ etat: (tAttendue.classe === 'sèche' ? 'attention' : 'ok') as LigneCheck['etat'], texte: `Saison ${annee} : plutôt **${tAttendue.classe}**` }] : []),
    ...(sol?.amendement_ph_recommande ? [{ etat: 'attention' as const, texte: 'Sol : **amendement du pH** recommandé' }] : []),
  ]
  const titreFiche = departement ? titre : 'Où est votre champ ?'
  const texteEcoute = aLire(titreFiche, lignesFiche).join('\n')
  const texteEcouteWo = useTexteParcelleWo({ position: position ? [position[0], position[1]] : null,
    departement: nomDep && regionDep && zoneDep ? { departement: nomDep, region: regionDep, zone_agroecologique: zoneDep } : undefined, sol, choix, adaptees, attendue, annee: annee, semis, recolte, vulnerabilite })

  const sortie = useMemo<Sortie>(() => {
    const surPoint = (p: LonLat) => definirPosition(p)
    if (!position) return { surPoint, resume: 'Où est votre champ ?', vue: { ambiance: 'jour', camera: cadrer.pays(cadre), zones: {}, departements: null, satellite: false, arcs: [], reperes: [], pluie: 0 } }
    return {
      surPoint,
      resume: departement ? (choix ? `${departement.departement} : ${n ? `${n} culture${n > 1 ? 's' : ''} qui réussi${n > 1 ? 'ssent' : 't'}` : 'aucune culture sûre'}` : departement.departement) : 'Point hors du Sénégal',
      vue: {
        ambiance: 'jour', zones: null, departements: null, arcs: [], pluie: 0, satellite: true,
        // Hors du Sénégal : on montre le point, sans descendre
        camera: code ? { centre: position, zoom: 14.4, inclinaison: 62, cap: -22, duree: 7000, marge: cadre.marge } : { centre: position, zoom: 6, marge: cadre.marge },
        reperes: [{ id: 'parcelle', position, genre: 'position', libelle: code ? 'Votre parcelle' : 'Hors du Sénégal' }],
      },
    }
    // Le compilateur React renonce à optimiser ce composant (analyse trop prudente des objets du référentiel) ;
    // la mise en cache manuelle reste correcte : toutes les dépendances sont listées.
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [position, code, cadre, definirPosition, departement, choix, n])
  // Le texte parlé s'ajoute à part : il change avec des données que la carte n'utilise pas
  const sortieEcoute = useMemo<Sortie>(() => ({ ...sortie, aEcouter: texteEcoute.split('\n'), aEcouterWo: texteEcouteWo.split('\n') }), [sortie, texteEcoute, texteEcouteWo])
  usePublier(publier, sortieEcoute)

  const zone = departement ? ZONE_PAR_CLE.get(cleZone(departement.zone_agroecologique)) : undefined
  const avis = (
    <>
      {etat === 'refus' && <Avis>Localisation refusée. Touchez votre champ sur la carte, ou saisissez ses coordonnées.</Avis>}
      {etat === 'indisponible' && <Avis>Position introuvable pour le moment. Touchez votre champ sur la carte, ou saisissez ses coordonnées.</Avis>}
      {position && !code && <Avis>Ce point est hors du Sénégal : les données couvrent les 45 départements du pays.</Avis>}
    </>
  )

  if (!departement)
    return (
      <FicheReponse cadre={cadre} mode="parcelle" cle={`aucun-${etat}`} titre={titreFiche} lignes={lignesFiche} aEcouter={sortieEcoute.aEcouter} aEcouterWo={sortieEcoute.aEcouterWo}
        avant={
          <Bouton plein className="mt-2 w-full" onClick={localiser} disabled={etat === 'recherche'}>
            <LocateFixed className="size-4" aria-hidden />{etat === 'recherche' ? 'Recherche du signal…' : 'Me localiser'}
          </Bouton>
        }
        etat={avis}
        detail={
          <>
            <p className="mt-4 text-sm leading-relaxed text-white/70">Activez la localisation, ou touchez la carte à l’endroit du champ : elle descend jusqu’à la parcelle.</p>
            <Groupe titre="Ou saisir les coordonnées">
              <form className="grid grid-cols-[1fr_1fr_auto] gap-2" onSubmit={(e) => { e.preventDefault(); if (saisieValide) definirPosition([lon, lat]) }}>
                <input className="champ-scene" inputMode="decimal" placeholder="Lat. 14,15" aria-label="Latitude" value={saisie.lat} onChange={(e) => setSaisie((s) => ({ ...s, lat: e.target.value }))} />
                <input className="champ-scene" inputMode="decimal" placeholder="Lon. -16,07" aria-label="Longitude" value={saisie.lon} onChange={(e) => setSaisie((s) => ({ ...s, lon: e.target.value }))} />
                <Bouton disabled={!saisieValide} onClick={() => saisieValide && definirPosition([lon, lat])}>Aller</Bouton>
              </form>
            </Groupe>
          </>
        } />
      <div>
        <Reponse titre="Où est votre champ ?" phrase="Activez la localisation, ou touchez la carte à l’endroit du champ : elle descend jusqu’à la parcelle." />
        <Bouton plein className="mt-4 w-full" onClick={localiser} disabled={etat === 'recherche'}>
          <LocateFixed className="size-4" aria-hidden />{etat === 'recherche' ? 'Recherche du signal…' : 'Me localiser'}
        </Bouton>
        {avis}
        <Groupe titre="Ou saisir les coordonnées">
          <form className="grid grid-cols-[1fr_1fr_auto] gap-2" noValidate onSubmit={(e) => { e.preventDefault(); if (saisieValide) definirPosition([lon, lat]) }}>
            <input className="champ-scene" inputMode="decimal" placeholder="Lat. 14,15" aria-label="Latitude" value={saisie.lat} onChange={(e) => setSaisie((s) => ({ ...s, lat: e.target.value }))}
              aria-invalid={Boolean(lectureLat.erreur)} aria-describedby={erreurCoordonnees || interverties ? 'erreur-coordonnees' : undefined} />
            <input className="champ-scene" inputMode="decimal" placeholder="Lon. -16,07" aria-label="Longitude" value={saisie.lon} onChange={(e) => setSaisie((s) => ({ ...s, lon: e.target.value }))}
              aria-invalid={Boolean(lectureLon.erreur)} aria-describedby={erreurCoordonnees || interverties ? 'erreur-coordonnees' : undefined} />
            <Bouton disabled={!saisieValide} onClick={() => saisieValide && definirPosition([lon, lat])}>Aller</Bouton>
          </form>
          {erreurCoordonnees && <ErreurChamp id="erreur-coordonnees">{erreurCoordonnees}</ErreurChamp>}
          {!erreurCoordonnees && interverties && (
            <ErreurChamp id="erreur-coordonnees">
              Latitude et longitude semblent interverties : au Sénégal, la latitude est positive (vers 14) et la longitude négative (vers -16).{' '}
              <button type="button" onClick={() => setSaisie((s) => ({ lat: s.lon, lon: s.lat }))} className="font-semibold text-white underline underline-offset-4">Les échanger</button>
            </ErreurChamp>
          )}
        </Groupe>
      </div>
    )

  return (
    <FicheReponse cadre={cadre} mode="parcelle" cle={`${code}-${annee}-${conseillee}`} culture={conseillee} puces={[puceAnnee(cadre, a, attendue)]} titre={titreFiche} teinte={n ? NIVEAUX['adaptée'].couleur : undefined} lignes={lignesFiche}
      aEcouter={sortieEcoute.aEcouter} aEcouterWo={sortieEcoute.aEcouterWo}
      detail={
        <>
          <p className="mt-4 text-sm leading-relaxed text-white/70">{phrase || `Région de ${departement.region}.`}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {zone && <Pastille couleur={zone.couleur}>{zone.nom}</Pastille>}
            {departement.zone_secondaire && <Pastille couleur="var(--color-brume)">transition vers {libelle(departement.zone_secondaire)}</Pastille>}
          </div>
          {avis}

          <AFaire aller={allerAvecCulture} actions={actions} />

      <Detail libelle="Voir les cultures, le sol et les risques">
      <Groupe titre="Ce qu'on peut y cultiver">
        {!choix ? <Squelette /> : adaptees.length ? (
          <ol>
            {adaptees.slice(0, 5).map((c) => <Rang key={c.culture} nom={`${libelle(c.culture)} · cycle ${c.option}`} part={c.proba_cycle_couvert_pct} couleur={NIVEAUX['adaptée'].couleur} valeur={pct(c.proba_cycle_couvert_pct)} />)}
          </ol>
        ) : <p className="text-sm text-white/70">Aucune culture pluviale classée « adaptée » dans ce département.</p>}
        <div className="mt-2"><Lien onClick={() => cadre.aller('semer')}>Comparer toutes les cultures</Lien></div>
      </Groupe>

      <Groupe titre="Le sol">
        {sol ? (
          <Lignes>
            <Ligne libelle="Texture" valeur={sol.classe_texture ? libelle(sol.classe_texture) : 'non disponible'} />
            <Ligne libelle="pH (eau)" valeur={nombre(sol.ph_eau, { decimales: 1 })} detail={lecturePh(sol.ph_eau)} />
            <Ligne libelle="Réserve utile en eau" valeur={mm(sol.reserve_utile_mm)} />
            <Ligne libelle="Carbone organique" valeur={nombre(sol.carbone_organique_g_kg, { decimales: 1, unite: 'g/kg' })} />
          </Lignes>
        ) : territoires ? <p className="text-sm text-white/70">Sol non disponible pour ce département.</p> : <Squelette lignes={4} />}
      </Groupe>

          <Groupe titre={`Campagne ${annee}, selon les modèles`}>
            {etats.every((e) => e === 'non-chargee') ? <Attente etat="non-chargee" /> : (
              <dl className="-my-2 divide-y divide-white/[0.07]">
                <Morceau modele="M1" libelle="Saison" valeur={attendue ? `${tendance(attendue)?.texte ?? 'non disponible'}${tendance(attendue) ? `, ${nombre(tendance(attendue)!.proba)} %` : ''}` : vide(etats[0])}>
                  {attendue?.pluie_prevue_mm != null && <>{mm(attendue.pluie_prevue_mm)} attendus{attendue.pluie_basse_mm !== null && attendue.pluie_haute_mm !== null ? ` (entre ${nombre(attendue.pluie_basse_mm)} et ${nombre(attendue.pluie_haute_mm)})` : ''}.</>}
                </Morceau>
                <Morceau modele="M4" libelle={`Semer${conseillee ? ` · ${nomConseillee}` : ''}`} valeur={semis ? periodeDecades(semis.decade_semis, semis.decade_semis, true) : vide(etats[1])}>
                  {semis ? <>{pct(semis.risque_total_pct)} de risque, le plus bas.</> : !aM4.couverte ? `Pas de prévision de semis pour ${annee}.` : etats[1] === 'ok' || etats[1] === 'absente' ? `Pas de période de semis calculée pour ${nomConseillee || 'cette culture'}.` : null}
                </Morceau>
                <Morceau modele="M3" libelle={`Récolte${conseillee ? ` · ${nomConseillee}` : ''}`}
                  reserve={recolte?.rendement_fiable ? "prévision de l'année" : 'fiabilité faible : récolte habituelle'}
                  valeur={recolte && recolte.rendement_bas_kg_ha !== null && recolte.rendement_haut_kg_ha !== null ? `${nombre(recolte.rendement_bas_kg_ha)} – ${nombre(recolte.rendement_haut_kg_ha, { unite: 'kg/ha' })}` : vide(etats[2])}>
                  {!aM3.couverte ? `Pas de prévision de récolte pour ${annee}.` : !recolte && (etats[2] === 'ok' || etats[2] === 'absente') ? `Pas de prévision de récolte pour ${nomConseillee || 'cette culture'}.` : null}
                </Morceau>
              </dl>
            )}
            <div className="mt-1"><Lien onClick={() => cadre.aller('semis')}>Voir quand semer, culture par culture</Lien></div>
          </Groupe>
          <Groupe titre="Ce qu'on peut y cultiver">
            {!choix ? <Squelette /> : adaptees.length ? (
              <ol>
                {adaptees.slice(0, 5).map((c) => <Rang key={c.culture} nom={`${libelle(c.culture)} · cycle ${cycleDit(c.option)}`} part={c.proba_cycle_couvert_pct} couleur={NIVEAUX['adaptée'].couleur} valeur={pct(c.proba_cycle_couvert_pct)} />)}
              </ol>
            ) : <p className="text-sm text-white/60">Aucune culture pluviale classée « adaptée » dans ce département.</p>}
            <div className="mt-2"><Lien onClick={() => cadre.aller('semer')}>Comparer toutes les cultures</Lien></div>
          </Groupe>

          <Groupe titre="Le sol">
            {sol ? (
              <Lignes>
                <Ligne libelle="Texture" valeur={sol.classe_texture ? libelle(sol.classe_texture) : 'non disponible'} />
                <Ligne libelle="pH (eau)" valeur={nombre(sol.ph_eau, { decimales: 1 })} detail={lecturePh(sol.ph_eau)} />
                <Ligne libelle="Réserve utile en eau" valeur={mm(sol.reserve_utile_mm)} detail={jours === null ? undefined : `environ ${jours} jours sans pluie (÷ 4 mm par jour)`} />
                <Ligne libelle="Carbone organique" valeur={nombre(sol.carbone_organique_g_kg, { decimales: 1, unite: 'g/kg' })} />
              </Lignes>
            ) : territoires ? <p className="text-sm text-white/60">Sol non disponible pour ce département.</p> : <Squelette lignes={4} />}
          </Groupe>

          <Groupe titre="Les risques">
            <Lignes>
              <Ligne libelle="Vulnérabilité" valeur={vulnerabilite?.classe_vulnerabilite ? libelle(vulnerabilite.classe_vulnerabilite) : 'non évaluée'}
                teinte={vulnerabilite?.score_vulnerabilite != null ? teinteVulnerabilite(vulnerabilite.score_vulnerabilite) : undefined} />
              <Ligne libelle="Saisons en alerte sécheresse" valeur={pct(vulnerabilite?.freq_alerte_secheresse_pct)} detail="sur 1991-2020" />
              <Ligne libelle="Séquence sèche de 15 jours" valeur={pct(vulnerabilite?.proba_sequence_seche_15j_pct)} detail="probabilité par saison" />
              <Ligne libelle={`Saison ${anneeObservee ?? ''} observée`} valeur={saison?.classe_saison ? libelle(saison.classe_saison) : 'non disponible'}
                detail={saison?.anomalie_pluie_saison_pct != null ? `${nombre(saison.anomalie_pluie_saison_pct, { unite: '%', signe: true })} de pluie` : undefined} />
            </Lignes>
          </Groupe>


          <div className="mt-5 flex gap-2 border-t border-white/[0.09] pt-4">
            <Bouton onClick={localiser} disabled={etat === 'recherche'} className="flex-1"><LocateFixed className="size-4" aria-hidden />{etat === 'recherche' ? 'Recherche…' : 'Me relocaliser'}</Bouton>
            <Bouton onClick={() => definirPosition(null)} className="flex-1">Revoir le pays</Bouton>
          </div>

          <MethodeModele cibles={[{ modele: 'M1', tendance: a.tendance }, { modele: 'M4' }, { modele: 'M3', moment: 'FIN_MAI', culture: recolte?.culture, volet: 'rendement' }]}
            avertissements={[...(saisonDonnees?.avertissements ?? []), ...(semisDonnees?.avertissements ?? []), ...(recolteDonnees?.avertissements ?? [])]}>
            <p>Sol et risques sont des valeurs du département {departement.departement} (SoilGrids, CHIRPS) : elles ne décrivent pas votre parcelle au mètre près.</p>
            <p>Le pourcentage d'une culture est la part des années (1991-2020) où la saison des pluies couvre tout son cycle.</p>
            <p>La vulnérabilité est relative entre départements et indicative.</p>
            <p>Position : {position![1].toFixed(4)}° N, {Math.abs(position![0]).toFixed(4)}° O.</p>
            <p>Les trois lignes « selon les modèles » viennent de modèles différents, de fiabilité différente : elles se lisent séparément. Semis et récolte portent sur la culture conseillée (celle choisie, sinon la mieux adaptée). Récolte : année difficile à bonne année, 8 chances sur 10, vue fin mai.</p>
          </MethodeModele>
        </>
      } />
  )
}
