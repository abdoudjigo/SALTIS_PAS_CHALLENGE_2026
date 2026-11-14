// Agriculteur — « Ma parcelle » : on se localise, la carte descend du pays jusqu'au champ,
// et la fenêtre donne le sol, les risques et les cultures adaptées du département, puis ce que disent les
// modèles pour la campagne : saison attendue (modèle 1), décade de semis (modèle 4), récolte habituelle (modèle 3).
import { LocateFixed } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useCarte, useChoixCultures, useTerritoires, useVulnerabilite } from '../../hooks/donnees'
import { etatPrevision, usePrevisionRendement, usePrevisionSaison, useRisqueSemis, type EtatPrevision } from '../../hooks/previsions'
import { libelle, mm, nombre, pct } from '../../lib/format'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { NIVEAUX, teinteVulnerabilite, tendance } from '../couleurs'
import { cleZone, trouverDepartement, ZONE_PAR_CLE, type LonLat } from '../geo'
import { periodeDecades } from '../fiabilite'
import { Attente, ChampAnnee, MethodeModele, Morceau } from '../previsions'
import { culture as cult, dire } from '../lecture'
import { CLASSE_WO, cultureWo, decadeWo, FIN_WO, wo } from '../wolof'
import { Avis, Bouton, Cle, Detail, Groupe, Lien, Ligne, Lignes, Pastille, Rang, Reponse, Squelette } from '../ui'

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

/** L'essentiel sur le terrain, pour l'oreille : où, le sol, quoi cultiver, puis la campagne selon les modèles. Une phrase par ligne. */
function useTexteParcelle({ position, departement, sol, choix, adaptees, attendue, annee, semis, recolte, vulnerabilite }: DonneesParcelle): string {
  const phrases = ((): string[] => {
    if (!position) return ['Activez la localisation, ou touchez votre champ sur la carte : je vous dirai l\'essentiel sur votre terrain.']
    if (!departement) return ['Ce point est hors du Sénégal. Les données couvrent les quarante-cinq départements du pays.']
    const zoneNom = ZONE_PAR_CLE.get(cleZone(departement.zone_agroecologique))?.nom
    const phrases = [`Votre champ est dans le département de ${departement.departement}, région de ${departement.region}${zoneNom ? `, zone ${zoneNom}` : ''}.`]
    if (sol) {
      const qualites = [sol.classe_texture ? libelle(sol.classe_texture).toLowerCase() : null, lecturePh(sol.ph_eau)].filter(Boolean).join(', ')
      phrases.push(`Le sol est ${qualites ? `de type ${qualites}` : 'non décrit'}${sol.reserve_utile_mm != null ? `, avec une réserve en eau de ${dire.mm(sol.reserve_utile_mm)}` : ''}.`)
    }
    if (choix) {
      const noms = adaptees.slice(0, 3).map((c) => cult.le(libelle(c.culture)))
      phrases.push(adaptees.length
        ? `${adaptees.length} culture${adaptees.length > 1 ? 's' : ''} y ${adaptees.length > 1 ? 'sont adaptées' : 'est adaptée'}. Les mieux placées : ${noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}` : noms[0]}.`
        : 'Aucune culture pluviale n\'y est classée adaptée.')
    }
    const t = attendue ? tendance(attendue) : null
    if (t) phrases.push(`Pour la campagne ${annee}, la saison s'annonce plutôt ${t.classe}, avec ${dire.pct(t.proba)} de chances${attendue?.pluie_prevue_mm != null ? ` et ${dire.mm(attendue.pluie_prevue_mm)} de pluie attendus` : ''}.`)
    if (semis) phrases.push(`Pour ${cult.le(libelle(semis.culture))}, le meilleur moment pour semer est ${periodeDecades(semis.decade_semis)}.`)
    if (recolte && recolte.rendement_bas_kg_ha !== null && recolte.rendement_haut_kg_ha !== null)
      phrases.push(`Récolte ${recolte.rendement_fiable ? 'attendue' : 'habituelle'} ${cult.du(libelle(recolte.culture))} : entre ${dire.nombre(recolte.rendement_bas_kg_ha)} et ${dire.kgHa(recolte.rendement_haut_kg_ha)}.`)
    if (vulnerabilite?.freq_alerte_secheresse_pct != null)
      phrases.push(`Côté risques : ${dire.pct(vulnerabilite.freq_alerte_secheresse_pct)} des saisons ont connu une alerte sécheresse depuis 1991${vulnerabilite.classe_vulnerabilite ? ` ; vulnérabilité ${libelle(vulnerabilite.classe_vulnerabilite).replace(' (relatif)', '').toLowerCase()}, comparée aux autres départements` : ''}.`)
    phrases.push('Ces valeurs décrivent le département, pas votre champ au mètre près. Ce sont des estimations indicatives.')
    return phrases
  })()
  return phrases.join('\n')
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
  const { data: saisons } = useCarte(ref.campagnes.at(-1))
  const { data: choix } = useChoixCultures(code)
  const sol = territoires?.find((t) => t.code_departement === code)
  const vulnerabilite = vulnerabilites?.find((v) => v.code_departement === code)
  const saison = saisons?.find((s) => s.code_departement === code)

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
  const a = useAnnee(cadre, 'M1')
  const [anneeSaison, anneeSemis, anneeRecolte] = [a.annee, a.annee, a.annee]
  const prevSaison = usePrevisionSaison(code ? anneeSaison : undefined)
  const prevSemis = useRisqueSemis(code, anneeSemis)
  const prevRecolte = usePrevisionRendement(code, anneeRecolte)
  const etats = [etatPrevision(prevSaison), etatPrevision(prevSemis), etatPrevision(prevRecolte)]
  const attendue = prevSaison.data?.donnees.find((l) => l.code_departement === code)
  // La culture la mieux adaptée que chaque modèle connaît (le modèle 4 couvre 8 cultures, le modèle 3 en couvre 5)
  const semis = adaptees.map((a) => prevSemis.data?.donnees.find((l) => l.culture === a.culture && l.decade_conseillee)).find(Boolean)
  const recolte = adaptees.map((a) => prevRecolte.data?.donnees.find((l) => l.culture === a.culture && l.moment_prevision === 'FIN_MAI')).find(Boolean)

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
  const lat = Number(saisie.lat.replace(',', '.'))
  const lon = Number(saisie.lon.replace(',', '.'))
  const saisieValide = saisie.lat !== '' && saisie.lon !== '' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180

  // La réponse en une ligne : le sol, puis ce qu'on peut y semer
  const texture = sol?.classe_texture ? libelle(sol.classe_texture).toLowerCase() : null
  const phrase = departement
    ? [texture ? `Sol ${texture}${lecturePh(sol?.ph_eau ?? null) ? `, ${lecturePh(sol!.ph_eau)}` : ''}` : null, choix ? `${adaptees.length} culture${adaptees.length > 1 ? 's' : ''} adaptée${adaptees.length > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')
    : null

  // Des chaînes, pas l'objet : le compilateur React sait qu'elles ne seront pas modifiées
  const [nomDep, regionDep, zoneDep] = [departement?.departement, departement?.region, departement?.zone_agroecologique]
  const texteEcoute = useTexteParcelle({ position: position ? [position[0], position[1]] : null,
    departement: nomDep && regionDep && zoneDep ? { departement: nomDep, region: regionDep, zone_agroecologique: zoneDep } : undefined, sol, choix, adaptees, attendue, annee: a.annee, semis, recolte, vulnerabilite })
  const texteEcouteWo = useTexteParcelleWo({ position: position ? [position[0], position[1]] : null,
    departement: nomDep && regionDep && zoneDep ? { departement: nomDep, region: regionDep, zone_agroecologique: zoneDep } : undefined, sol, choix, adaptees, attendue, annee: a.annee, semis, recolte, vulnerabilite })

  const sortie = useMemo<Sortie>(() => {
    const surPoint = (p: LonLat) => definirPosition(p)
    if (!position) return { surPoint, resume: 'Où est votre champ ?', vue: { ambiance: 'jour', camera: cadrer.pays(cadre), zones: {}, departements: null, satellite: false, arcs: [], reperes: [], pluie: 0 } }
    return {
      surPoint,
      resume: departement ? [departement.departement, phrase].filter(Boolean).join(' · ') : 'Point hors du Sénégal',
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
  }, [position, code, cadre, definirPosition, departement, phrase])
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
      <div>
        <Reponse titre="Où est votre champ ?" phrase="Activez la localisation, ou touchez la carte à l’endroit du champ : elle descend jusqu’à la parcelle." />
        <Bouton plein className="mt-4 w-full" onClick={localiser} disabled={etat === 'recherche'}>
          <LocateFixed className="size-4" aria-hidden />{etat === 'recherche' ? 'Recherche du signal…' : 'Me localiser'}
        </Bouton>
        {avis}
        <Groupe titre="Ou saisir les coordonnées">
          <form className="grid grid-cols-[1fr_1fr_auto] gap-2" onSubmit={(e) => { e.preventDefault(); if (saisieValide) definirPosition([lon, lat]) }}>
            <input className="champ-scene" inputMode="decimal" placeholder="Lat. 14,15" aria-label="Latitude" value={saisie.lat} onChange={(e) => setSaisie((s) => ({ ...s, lat: e.target.value }))} />
            <input className="champ-scene" inputMode="decimal" placeholder="Lon. -16,07" aria-label="Longitude" value={saisie.lon} onChange={(e) => setSaisie((s) => ({ ...s, lon: e.target.value }))} />
            <Bouton disabled={!saisieValide} onClick={() => saisieValide && definirPosition([lon, lat])}>Aller</Bouton>
          </form>
        </Groupe>
      </div>
    )

  return (
    <div>
      <Reponse cle={code} titre={departement.departement} phrase={phrase || `Région de ${departement.region}.`}>
        <Cle valeur={nombre(sol?.ph_eau, { decimales: 1 })} libelle="pH du sol" />
        <Cle valeur={nombre(sol?.reserve_utile_mm)} unite="mm" libelle="réserve utile en eau" />
        <Cle valeur={choix ? adaptees.length : '—'} libelle="cultures adaptées" teinte={NIVEAUX['adaptée'].couleur} />
      </Reponse>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {zone && <Pastille couleur={zone.couleur}>{zone.nom}</Pastille>}
        {departement.zone_secondaire && <Pastille couleur="var(--color-brume)">transition vers {libelle(departement.zone_secondaire)}</Pastille>}
      </div>
      {avis}

      <Groupe titre={`Campagne ${a.annee}, selon les modèles`}>
        {etats.every((e) => e === 'non-chargee') ? <Attente etat="non-chargee" /> : (
          <dl className="-my-2 divide-y divide-white/[0.07]">
            <Morceau modele="M1" libelle="Saison" valeur={attendue ? `${tendance(attendue)?.texte ?? 'non disponible'}${tendance(attendue) ? `, ${nombre(tendance(attendue)!.proba)} %` : ''}` : vide(etats[0])}>
              {attendue?.pluie_prevue_mm != null && <>{mm(attendue.pluie_prevue_mm)} attendus{attendue.pluie_basse_mm !== null && attendue.pluie_haute_mm !== null ? ` (entre ${nombre(attendue.pluie_basse_mm)} et ${nombre(attendue.pluie_haute_mm)})` : ''}.</>}
            </Morceau>
            <Morceau modele="M4" libelle={`Semer${semis ? ` · ${libelle(semis.culture).toLowerCase()}` : ''}`} valeur={semis ? periodeDecades(semis.decade_semis, semis.decade_semis, true) : vide(etats[1])}>
              {semis ? <>{pct(semis.risque_total_pct)} de risque, le plus bas.</> : etats[1] === 'ok' || etats[1] === 'absente' ? 'Pas de période calculée pour les cultures adaptées.' : null}
            </Morceau>
            <Morceau modele="M3" libelle={`Récolte${recolte ? ` · ${libelle(recolte.culture).toLowerCase()}` : ''}`}
              reserve={recolte?.rendement_fiable ? "prévision de l'année" : 'fiabilité faible : récolte habituelle'}
              valeur={recolte && recolte.rendement_bas_kg_ha !== null && recolte.rendement_haut_kg_ha !== null ? `${nombre(recolte.rendement_bas_kg_ha)} – ${nombre(recolte.rendement_haut_kg_ha, { unite: 'kg/ha' })}` : vide(etats[2])}>
              {!recolte && (etats[2] === 'ok' || etats[2] === 'absente') ? 'Pas de série de rendement pour les cultures adaptées.' : null}
            </Morceau>
          </dl>
        )}
        <ChampAnnee cadre={cadre} a={a} saison={attendue} className="mt-3" />
        <div className="mt-1"><Lien onClick={() => cadre.aller('semis')}>Voir quand semer, culture par culture</Lien></div>
      </Groupe>

      <Detail libelle="Voir les cultures, le sol et les risques">
      <Groupe titre="Ce qu'on peut y cultiver">
        {!choix ? <Squelette /> : adaptees.length ? (
          <ol>
            {adaptees.slice(0, 5).map((c) => <Rang key={c.culture} nom={`${libelle(c.culture)} · cycle ${c.option}`} part={c.proba_cycle_couvert_pct} couleur={NIVEAUX['adaptée'].couleur} valeur={pct(c.proba_cycle_couvert_pct)} />)}
          </ol>
        ) : <p className="text-sm text-white/60">Aucune culture pluviale classée « adaptée » dans ce département.</p>}
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
        ) : territoires ? <p className="text-sm text-white/60">Sol non disponible pour ce département.</p> : <Squelette lignes={4} />}
      </Groupe>

      <Groupe titre="Les risques">
        <Lignes>
          <Ligne libelle="Vulnérabilité" valeur={vulnerabilite?.classe_vulnerabilite ? libelle(vulnerabilite.classe_vulnerabilite) : 'non évaluée'}
            teinte={vulnerabilite?.score_vulnerabilite != null ? teinteVulnerabilite(vulnerabilite.score_vulnerabilite) : undefined} />
          <Ligne libelle="Saisons en alerte sécheresse" valeur={pct(vulnerabilite?.freq_alerte_secheresse_pct)} detail="sur 1991-2020" />
          <Ligne libelle="Séquence sèche de 15 jours" valeur={pct(vulnerabilite?.proba_sequence_seche_15j_pct)} detail="probabilité par saison" />
          <Ligne libelle={`Saison ${saison?.campagne_agricole ?? ''}`} valeur={saison?.classe_saison ? libelle(saison.classe_saison) : 'non disponible'}
            detail={saison?.anomalie_pluie_saison_pct != null ? `${nombre(saison.anomalie_pluie_saison_pct, { unite: '%', signe: true })} de pluie` : undefined} />
        </Lignes>
      </Groupe>

      </Detail>

      <div className="mt-5 flex gap-2 border-t border-white/[0.09] pt-4">
        <Bouton onClick={localiser} disabled={etat === 'recherche'} className="flex-1"><LocateFixed className="size-4" aria-hidden />{etat === 'recherche' ? 'Recherche…' : 'Me relocaliser'}</Bouton>
        <Bouton onClick={() => definirPosition(null)} className="flex-1">Revoir le pays</Bouton>
      </div>

      <MethodeModele cibles={[{ modele: 'M1', tendance: a.tendance }, { modele: 'M4' }, { modele: 'M3', moment: 'FIN_MAI', culture: recolte?.culture, volet: 'rendement' }]}
        avertissements={[...(prevSaison.data?.avertissements ?? []), ...(prevSemis.data?.avertissements ?? []), ...(prevRecolte.data?.avertissements ?? [])]}>
        <p>Sol et risques sont des valeurs du département {departement.departement} (SoilGrids, CHIRPS) : elles ne décrivent pas votre parcelle au mètre près.</p>
        <p>Le pourcentage d'une culture est la part des années (1991-2020) où la saison des pluies couvre tout son cycle.</p>
        <p>La vulnérabilité est relative entre départements et indicative.</p>
        <p>Position : {position![1].toFixed(4)}° N, {Math.abs(position![0]).toFixed(4)}° O.</p>
        <p>Les trois lignes « selon les modèles » viennent de modèles différents, de fiabilité différente : elles se lisent séparément. Semis et récolte portent sur la culture la mieux adaptée que chaque modèle couvre. Récolte : année difficile à bonne année, 8 chances sur 10, vue fin mai.</p>
      </MethodeModele>
    </div>
  )
}
