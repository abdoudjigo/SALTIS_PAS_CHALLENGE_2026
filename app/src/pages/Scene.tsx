// La scène : après la connexion, une seule carte plein écran. Chaque fonctionnalité du dock change la carte
// (caméra, lumière, volumes, arcs) et ouvre son panneau. Deux profils : agriculteur, ONG et services de l'État.
import { BarChart3, CalendarDays, ClipboardList, CloudSun, Droplets, FileDown, LogOut, MapPinned, Scale, Sparkles, Sprout, TriangleAlert, Truck } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentType, type Ref } from 'react'
import { useAuth } from '../auth/AuthContext'
import { config } from '../config'
import { useReferentiels } from '../hooks/donnees'
import { usePrechargerDepartement } from '../hooks/precharger'
import { ACCUEIL, useMeta } from '../lib/meta'
import type { Survol, VueCarte } from '../scene/carte/Carte'
import { cadrer, questionDe, questionOng, type AccesExport, type Cadre, type Fonctionnalite, type Infobulle, type ModeOng, type PropsMode, type Sortie } from '../scene/cadre'
import { CLE_DOSSIER, DossierContext, lireDossier, type DossierOng } from '../scene/ong/dossier'
import { definirCarte, registre } from '../scene/ong/registreExport'
import { AvisOng } from '../scene/ong/AvisOng'
import { Dock } from '../scene/interface/Dock'
import { hauteurCran, type Cran } from '../scene/carte/crans'
import { Fenetre, LARGEUR_FENETRE_PX } from '../scene/interface/Fenetre'
import { GardeCarte } from '../scene/carte/GardeCarte'
import { ChoixDepartement } from '../scene/interface/ChoixDepartement'
import { EtatReseau } from '../scene/interface/EtatReseau'
import { VersionDonnees } from '../scene/interface/VersionDonnees'
import { useContours, useContoursZones } from '../scene/carte/fonds'
import type { LonLat } from '../scene/carte/geo'
import type { Utilisateur } from '../types/auth'
import { anneeAVenir } from '../types/previsions'
import { suivre } from '../lib/mesure'
import { BandeauAccueil, BoutonAccueil } from '../scene/voix/BandeauAccueil'
import { lireEcran, type ResumeEcran } from '../scene/voix/accueil'

// La carte (Mapbox, ~500 Ko compressés) se télécharge dès l'ouverture de la scène, en même temps que les
// données : sans cela, son chargement n'aurait commencé qu'après leur arrivée
const chargerCarte = () => import('../scene/carte/Carte')
const Carte = lazy(chargerCarte)
void chargerCarte()

// Chaque fonctionnalité est un morceau à part : un profil ne télécharge que les siennes, préchargées dès que la
// scène est posée (le premier changement de fonctionnalité n'attend donc pas le réseau)
type ChargeurMode = () => Promise<{ default: ComponentType<PropsMode> }>
const chargeurs = new Map<ComponentType<PropsMode>, ChargeurMode>()
function mode(charger: ChargeurMode) {
  const composant = lazy(charger) as unknown as ComponentType<PropsMode>
  chargeurs.set(composant, charger)
  return composant
}
const Parcelle = mode(() => import('../scene/modes/Parcelle'))
const Saison = mode(() => import('../scene/modes/Saison'))
const QuandSemer = mode(() => import('../scene/modes/QuandSemer'))
const Semer = mode(() => import('../scene/modes/Semer'))
const Surface = mode(() => import('../scene/modes/Surface'))
const ContreSaison = mode(() => import('../scene/modes/ContreSaison'))
const AlerteRecolte = mode(() => import('../scene/modes/AlerteRecolte'))
const Campagne = mode(() => import('../scene/modes/Campagne'))
const BesoinsPays = mode(() => import('../scene/modes/BesoinsPays'))
const Repartir = mode(() => import('../scene/modes/Repartir'))
const Potentiel = mode(() => import('../scene/modes/Potentiel'))
const Exporter = mode(() => import('../scene/modes/Exporter'))

const F = {
  parcelle: { id: 'parcelle', titre: 'Ma parcelle', question: questionDe('parcelle'), phrase: 'Se localiser : le sol, les risques, les cultures et la campagne de son champ.', icone: MapPinned, composant: Parcelle },
  // Un bouton par modèle d'IA (ml/MODELES.md), et deux boutons qui en combinent plusieurs : « Ma parcelle », « Préparer la campagne »
  saison: { id: 'saison', titre: 'La saison qui vient', question: questionDe('saison'), phrase: 'La pluie de l’année choisie : sèche, normale ou humide, et combien.', icone: CloudSun, composant: Saison },
  semis: { id: 'semis', titre: 'Quand semer', question: questionDe('semis'), phrase: 'La période de semis la moins risquée, culture par culture.', icone: CalendarDays, composant: QuandSemer },
  alerte: { id: 'alerte', titre: 'Alerte récolte', question: questionOng('alerte'), phrase: 'Les départements où la récolte risque de chuter.', icone: TriangleAlert, composant: AlerteRecolte },
  // La vulnérabilité n'est plus une étape : sa carte et son classement sont la vue « vulnérabilité » de l'étape 1
  campagne: { id: 'campagne', titre: 'Où agir en priorité', question: questionOng('campagne'), phrase: 'Cadre harmonisé, alerte récolte, saison, vulnérabilité : où regarder d’abord.', icone: ClipboardList, composant: Campagne },
  semer: { id: 'semer', titre: 'Quelle culture', question: questionDe('semer'), phrase: 'Les cultures adaptées à son département, leurs cycles et la récolte attendue.', icone: Sprout, composant: Semer },
  surface: { id: 'surface', titre: 'Mes besoins', question: questionDe('surface'), phrase: 'Sa culture, sa surface, son année : ce qu’il faut, et ce qu’on peut en attendre.', icone: Scale, composant: Surface },
  contreSaison: { id: 'contreSaison', titre: 'Contre-saison', question: questionDe('contreSaison'), phrase: 'L’eau disponible en saison sèche près de vos terres, et ce qu’elle permet.', icone: Droplets, composant: ContreSaison },
  besoins: { id: 'besoins', titre: 'Besoins et budget', question: questionOng('besoins'), phrase: 'Semences et engrais nécessaires, en sacs, en tonnes et en francs CFA.', icone: BarChart3, composant: BesoinsPays },
  repartir: { id: 'repartir', titre: 'Répartir et livrer', question: questionOng('repartir'), phrase: 'Trois scénarios de répartition du stock, et la date limite de livraison.', icone: Truck, composant: Repartir },
  potentiel: { id: 'potentiel', titre: 'Fort potentiel', question: questionOng('potentiel'), phrase: 'Contre-saison et gain de rendement : des repérages indicatifs.', icone: Sparkles, composant: Potentiel },
  exporter: { id: 'exporter', titre: 'Exporter le dossier', question: questionOng('exporter'), phrase: 'Le dossier de la campagne, à partager.', icone: FileDown, composant: Exporter },
} satisfies Record<string, Fonctionnalite>

function fonctionnalitesDe(user: Utilisateur): { profil: string; liste: Fonctionnalite[] } {
  if (user.role === 'PRODUCTEUR') return { profil: 'Agriculteur', liste: [F.parcelle, F.saison, F.semer, F.semis, F.surface, F.contreSaison] }
  // Les 7 étapes de l'ONG, dans l'ordre du bouton « Suivant » (PARCOURS_ONG)
  return { profil: "ONG et services de l'État", liste: [F.campagne, { ...F.saison, question: questionOng('saison') }, F.alerte, F.besoins, F.repartir, F.potentiel, F.exporter] }
}

function useEcran() {
  const [taille, setTaille] = useState(() => ({ l: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    // Un redimensionnement émet des dizaines d'événements : on attend qu'il se pose, pour ne recadrer la carte qu'une fois
    let minuteur = 0
    const suivre = () => {
      clearTimeout(minuteur)
      minuteur = window.setTimeout(() => setTaille((t) => (t.l === window.innerWidth && t.h === window.innerHeight ? t : { l: window.innerWidth, h: window.innerHeight })), 120)
    }
    window.addEventListener('resize', suivre)
    return () => {
      clearTimeout(minuteur)
      window.removeEventListener('resize', suivre)
    }
  }, [])
  return taille
}

// Délai maximal d'une mise en vue pour l'export : au-delà, l'attente est rejetée
const DELAI_ACTIVER_MS = 20000

interface PoigneeBulle {
  montrer: (survol: Survol | null) => void
}

/** Infobulle qui suit le pointeur, sans redessiner le reste de la scène. */
function Bulle({ ref, infobulle }: { ref: Ref<PoigneeBulle>; infobulle: Sortie['infobulle'] }) {
  const [survol, setSurvol] = useState<Survol | null>(null)
  useImperativeHandle(ref, () => ({ montrer: setSurvol }), [])
  const contenu: Infobulle | null = survol && infobulle ? infobulle(survol.code) : null
  if (!survol || !contenu) return null
  return (
    <div className="verre-scene pointer-events-none absolute z-30 max-w-64 rounded-lg px-3 py-2" style={{ left: Math.max(8, Math.min(survol.x + 16, window.innerWidth - (window.innerWidth >= 768 ? LARGEUR_FENETRE_PX + 32 : 0) - 264)), top: Math.max(8, survol.y + 16) }} role="status">
      <p className="text-sm font-medium text-white">{contenu.titre}</p>
      {contenu.lignes.map((l) => <p key={l} className="text-xs leading-relaxed text-white/80">{l}</p>)}
    </div>
  )
}

export default function Scene() {
  useMeta({ titrePage: 'Carte', description: ACCUEIL.description })
  const { user, logout } = useAuth()
  const ecran = useEcran()
  const { data: ref, error } = useReferentiels()
  const { data: contours } = useContours()
  const { data: contoursZones } = useContoursZones()

  const profilAccueil = user?.role === 'PRODUCTEUR' ? 'agriculteur' : 'organisation'
  const { profil, liste } = useMemo(() => {
    const f = fonctionnalitesDe(user!)
    // La première fonctionnalité se télécharge en même temps que les données, pas après
    void chargeurs.get(f.liste[0].composant)?.()
    return f
  }, [user])
  const [idMode, setIdMode] = useState(liste[0].id)
  const actif = liste.find((f) => f.id === idMode) ?? liste[0]
  const [selection, setSelection] = useState<string | null>(null)
  const [position, setPosition] = useState<LonLat | null>(null)
  // L'année choisie vaut pour toutes les fonctionnalités ; au départ, la campagne à venir
  const [anneeChoisie, setAnnee] = useState<number | null>(null)
  // La culture choisie suit d'un écran à l'autre (« Que semer ? », « Quand semer ? », « Combien m'en faut-il ? »)
  const [culture, setCulture] = useState<string | null>(null)
  // Sans carte (pas de WebGL), pas de légende : elle décrirait une carte absente
  const [sansCarte, setSansCarte] = useState(false)
  // Une seule mesure « carte indisponible » par visite (React monte deux fois les composants en développement)
  const carteSignalee = useRef(false)
  const signalerSansCarte = useCallback(() => {
    setSansCarte(true)
    if (!carteSignalee.current) {
      carteSignalee.current = true
      suivre('carte_indisponible', { raison: 'webgl_ou_erreur' })
    }
  }, [])
  const [sortie, setSortie] = useState<Sortie>({ vue: {} })
  // L'écran qui a publié la sortie : juste après un changement d'onglet, la sortie est encore celle de l'ancien
  const [ecranSortie, setEcranSortie] = useState<string | null>(null)
  // Les choix de l'ONG, gardés pour la session de l'onglet, propres à l'utilisateur (vidés à la déconnexion)
  const cleDossier = `${CLE_DOSSIER}.${user?.id ?? 'anonyme'}`
  const [dossier, setDossier] = useState<DossierOng>(() => lireDossier(cleDossier))
  const majDossier = useCallback((modif: Partial<DossierOng>) => setDossier((d) => ({ ...d, ...modif })), [])
  const valeurDossier = useMemo(() => ({ dossier, majDossier }), [dossier, majDossier])
  useEffect(() => {
    try {
      sessionStorage.setItem(cleDossier, JSON.stringify(dossier))
    } catch {
      /* stockage indisponible : le dossier reste en mémoire */
    }
  }, [dossier, cleDossier])
  const bulle = useRef<PoigneeBulle>(null)
  const racine = useRef<HTMLDivElement>(null)

  const large = ecran.l >= 768
  const [cran, setCran] = useState<Cran>(1)
  // Le tableau de bord de l'ONG occupe le bas de la carte : la carte se cadre au-dessus (hauteur du panneau ouvert)
  const avecTableau = Boolean(sortie.tableauDeBord)
  const marge = useMemo(
    // La carte se cadre dans la place laissée libre par la fenêtre (à droite) ou par le tiroir (en bas)
    () => (large ? { top: 70, bottom: avecTableau ? 290 : 50, left: 70, right: LARGEUR_FENETRE_PX + 48 } : { top: 124, left: 10, right: 10, bottom: hauteurCran(cran === 2 ? 1 : cran, ecran.h) + 8 }),
    [large, ecran.h, cran, avecTableau],
  )
  const ouvrir = useCallback((id: string) => {
    setIdMode(id)
    setCran(1)
    suivre('ecran_ouvert', { ecran: id, profil: user?.role ?? 'inconnu' })
  }, [user?.role])
  // L'année choisie : on ne mesure que son type (passée, prévision océan, tendance), jamais rien de personnel
  const choisirAnnee = useCallback((a: number | null) => {
    setAnnee(a)
    if (a !== null && ref) {
      const aVenir = anneeAVenir(ref.campagnes)
      suivre('annee_choisie', { type: a < aVenir ? 'passee' : a === aVenir ? 'ocean' : 'tendance' })
    }
  }, [ref])
  const aller = ouvrir
  const exporter = useMemo<AccesExport>(() => ({
    carte: () => registre.carte,
    etapes: () => ({ ...registre.etapes }),
    activer: (id) => new Promise<void>((fini, echec) => {
      ouvrir(id)
      let poseur = 0
      let limite = 0
      let carteSuivie: typeof registre.carte = null
      const posee = () => terminer()
      const perdue = () => terminer(new Error('La carte a disparu pendant la mise en vue.'))
      function terminer(erreur?: Error) {
        clearTimeout(poseur)
        clearTimeout(limite)
        carteSuivie?.off('idle', posee)
        registre.surPerte.delete(perdue)
        if (erreur) echec(erreur)
        else fini()
      }
      registre.surPerte.add(perdue)
      limite = window.setTimeout(() => terminer(new Error(`Mise en vue de l'étape « ${id} » trop longue.`)), DELAI_ACTIVER_MS)
      // Laisse l'étape publier sa vue, puis attend que la carte ait fini de bouger et de dessiner
      poseur = window.setTimeout(() => {
        carteSuivie = registre.carte
        if (!carteSuivie) return terminer(new Error('Carte indisponible (pas encore chargée, ou pas de WebGL).'))
        carteSuivie.once('idle', posee)
        carteSuivie.triggerRepaint()
      }, 400)
    }),
  }), [ouvrir])
  const cadre = useMemo<Cadre | null>(
    () => (ref && contours && user ? { ref, contours, user, selection, choisir: setSelection, position, definirPosition: setPosition, annee: anneeChoisie ?? anneeAVenir(ref.campagnes), choisirAnnee, culture, choisirCulture: setCulture, aller, marge, exporter } : null),
    [ref, contours, user, selection, position, anneeChoisie, choisirAnnee, culture, aller, marge, exporter],
  )
  // La sortie de l'étape ouverte, gardée pour l'export
  const publier = useCallback((s: Sortie) => {
    setSortie(s)
    setEcranSortie(idMode)
    if (s.etape) registre.etapes[idMode as ModeOng] = s.etape
  }, [idMode])
  // Les autres fonctionnalités du profil se téléchargent pendant que la première s'affiche
  useEffect(() => {
    const minuteur = window.setTimeout(() => liste.forEach((f) => void chargeurs.get(f.composant)?.()), 1200)
    return () => clearTimeout(minuteur)
  }, [liste])
  usePrechargerDepartement(selection ?? user?.code_departement ?? null, cadre?.annee, culture, user?.role === 'PRODUCTEUR' && cadre !== null, cadre?.ref.campagnes)
  // Le même élément tant que la fonctionnalité et le cadre ne changent pas : quand la fonctionnalité publie sa
  // sortie, la scène se redessine (carte, légende, résumé) sans redessiner la fonctionnalité elle-même
  const Composant = actif.composant
  const contenu = useMemo(() => cadre && (
    <DossierContext.Provider value={valeurDossier}>
      <Suspense fallback={null}>
        <Composant key={actif.id} cadre={cadre} publier={publier} />
      </Suspense>
    </DossierContext.Provider>
  ), [Composant, actif.id, cadre, publier, valeurDossier])
  // La voix lit seule le résumé de l'écran ouvert (texte des mascottes), une fois que cet écran l'a publié
  const resumeAccueil = useMemo<ResumeEcran | null>(
    () => (ecranSortie === actif.id && lireEcran(profilAccueil, actif.id, liste[0].id)
      ? { ecran: actif.id, fr: sortie.aEcouter, wo: sortie.aEcouterWo, lieu: profilAccueil === 'organisation' ? 'pays' : selection }
      : null),
    [ecranSortie, actif.id, liste, sortie.aEcouter, sortie.aEcouterWo, profilAccueil, selection],
  )
  const vue = useMemo<VueCarte | null>(() => (cadre ? { ambiance: 'jour', camera: cadrer.pays(cadre), ...sortie.vue } : null), [cadre, sortie.vue])

  return (
    <div ref={racine} className="scene relative h-dvh overflow-hidden bg-encre-nuit text-white">
      {vue && cadre ? (
        <GardeCarte large={large} onEchec={signalerSansCarte}
          // « Ma parcelle » a sa propre liste (le département y suit la position du champ)
          choix={actif.id === 'parcelle' ? undefined : <ChoixDepartement departements={cadre.ref.departements} valeur={selection} onChoisir={setSelection} />}>
        <Suspense fallback={null}>
          <Carte vue={vue} contours={contours} contoursZones={contoursZones} departements={ref?.departements} depart={{ centre: [-32, 18], zoom: 1.6 }}
            onDepartement={setSelection} onPoint={sortie.surPoint} onSurvol={(s) => bulle.current?.montrer(s)}
            onManipulation={(enCours) => racine.current?.classList.toggle('scene-manip', enCours)} onCarte={definirCarte} />
        </Suspense>
        </GardeCarte>
      ) : (
        <div className="grid h-full place-items-center px-6 text-center">
          <p className={error ? 'text-soleil-500' : 'animate-pulse text-white/70'}>
            {error ? `Les données ne répondent pas : ${error.message}` : 'La carte se prépare…'}
          </p>
        </div>
      )}
      <Bulle ref={bulle} infobulle={sortie.infobulle} />

      {/* Marque et profil */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-4 md:pt-4">
        <div className="verre-scene pointer-events-auto flex items-center gap-3 rounded-xl py-1 pr-1 pl-1.5">
          <img src="/favicon.svg" alt="" className="size-9 rounded-lg" />
          <div className="leading-tight">
            <p className="font-titre text-md font-semibold text-white">Assaman & Suuf</p>
            <p className="text-2xs text-white/60">{profil}
              {config.donneesDemo && <span className="ml-1.5 rounded-full border border-white/20 px-1.5 whitespace-nowrap text-white/70" title="Données de démonstration synthétiques : elles illustrent la plateforme et ne servent pas à décider.">Démo · données synthétiques</span>}
            </p>
          </div>
          <BoutonAccueil profil={profilAccueil} />
          <button type="button" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter" className="grid size-11 place-items-center rounded-lg text-white/70 transition hover:text-white">
            <LogOut className="size-4" />
          </button>
        </div>
        {/* Avis ONG : en haut au milieu sur ordinateur, à droite sur téléphone */}
        {user && user.role !== 'PRODUCTEUR' && <div className="pointer-events-auto md:absolute md:top-4 md:left-1/2 md:-translate-x-1/2"><AvisOng annee={cadre?.annee ?? null} etape={actif.titre} /></div>}
      </header>

      {/* Message vocal d'accueil et ses sous-titres : sous l'en-tête, dans la place laissée par la fenêtre */}
      <BandeauAccueil profil={profilAccueil} resume={resumeAccueil}
        className="absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+7.25rem)] z-40 md:inset-x-auto md:z-30 md:top-24 md:left-24 md:w-[min(32rem,calc(100vw-336px-10rem))]" />

      <Dock fonctionnalites={liste} actif={actif.id} onChoisir={ouvrir} reponse={sortie.resume} />


      {/* Bas de la carte, entre le dock et la fenêtre : la légende, puis le tableau de bord de l'écran (ONG) */}
      {large && (sortie.tableauDeBord || (!sansCarte && sortie.legende)) && (
        <div className="pointer-events-none absolute bottom-6 left-24 z-10 flex flex-col items-start gap-2" style={{ right: LARGEUR_FENETRE_PX + 40 }}>
          {!sansCarte && sortie.legende && <div className="verre-scene pointer-events-auto rounded-lg px-3.5 py-3">{sortie.legende}</div>}
          {sortie.tableauDeBord && <div className="w-full max-w-[64rem]">{sortie.tableauDeBord}</div>}
        </div>
      )}

      {/* La fonctionnalité s'ouvre dans une fenêtre flottante (pop-up), un tiroir sur téléphone */}
      {cadre && (
        <Fenetre cle={actif.id} titre={actif.titre} icone={actif.icone} resume={sortie.resume} aEcouter={sortie.aEcouter} aEcouterWo={sortie.aEcouterWo} ecouteEnTete={false} large={large} hauteurEcran={ecran.h} cran={cran} onCran={setCran} legende={sansCarte ? undefined : sortie.legende}>
          <EtatReseau />
          {contenu}
          <VersionDonnees />
        </Fenetre>
      )}
    </div>
  )
}
