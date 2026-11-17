// La scène : après la connexion, une seule carte plein écran. Chaque fonctionnalité du dock change la carte
// (caméra, lumière, volumes, arcs) et ouvre son panneau. Deux profils : agriculteur, ONG et services de l'État.
import { BarChart3, CalendarDays, ClipboardList, CloudSun, LogOut, MapPinned, Scale, ShieldAlert, Sprout, TriangleAlert, Truck } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useReferentiels } from '../hooks/donnees'
import { ACCUEIL, useMeta } from '../lib/meta'
import type { Survol, VueCarte } from '../scene/Carte'
import { cadrer, type Cadre, type Fonctionnalite, type Infobulle, type Sortie } from '../scene/cadre'
import { Dock } from '../scene/Dock'
import { hauteurCran, type Cran } from '../scene/crans'
import { Fenetre, LARGEUR_FENETRE_PX } from '../scene/Fenetre'
import { useContours, useContoursZones } from '../scene/fonds'
import type { LonLat } from '../scene/geo'
import AlerteRecolte from '../scene/modes/AlerteRecolte'
import BesoinsPays from '../scene/modes/BesoinsPays'
import Campagne from '../scene/modes/Campagne'
import Parcelle from '../scene/modes/Parcelle'
import QuandSemer from '../scene/modes/QuandSemer'
import Repartir from '../scene/modes/Repartir'
import Saison from '../scene/modes/Saison'
import Semer from '../scene/modes/Semer'
import Surface from '../scene/modes/Surface'
import Vulnerabilite from '../scene/modes/Vulnerabilite'
import type { Utilisateur } from '../types/auth'
import { anneeAVenir } from '../types/previsions'

// La carte (Mapbox, ~500 Ko compressés) se télécharge dès l'ouverture de la scène, en même temps que les
// données : sans cela, son chargement n'aurait commencé qu'après leur arrivée
const chargerCarte = () => import('../scene/Carte')
const Carte = lazy(chargerCarte)
void chargerCarte()

const F = {
  parcelle: { id: 'parcelle', titre: 'Ma parcelle', phrase: 'Se localiser : le sol, les risques, les cultures et la campagne de son champ.', icone: MapPinned, composant: Parcelle },
  // Un bouton par modèle d'IA (ml/MODELES.md), et deux boutons qui en combinent plusieurs : « Ma parcelle », « Préparer la campagne »
  saison: { id: 'saison', titre: 'La saison qui vient', phrase: 'La pluie de l’année choisie : sèche, normale ou humide, et combien.', icone: CloudSun, composant: Saison },
  semis: { id: 'semis', titre: 'Quand semer', phrase: 'La décade de semis la moins risquée, culture par culture.', icone: CalendarDays, composant: QuandSemer },
  alerte: { id: 'alerte', titre: 'Alerte récolte', phrase: 'Les départements où la récolte risque de chuter.', icone: TriangleAlert, composant: AlerteRecolte },
  campagne: { id: 'campagne', titre: 'Préparer la campagne', phrase: 'Pluie attendue, risque pour la récolte, vulnérabilité : où regarder d’abord.', icone: ClipboardList, composant: Campagne },
  semer: { id: 'semer', titre: 'Quelle culture', phrase: 'Les cultures adaptées à son département, leurs cycles et la récolte attendue.', icone: Sprout, composant: Semer },
  surface: { id: 'surface', titre: 'Mes besoins', phrase: 'Sa culture, sa surface, son année : ce qu’il faut, et ce qu’on peut en attendre.', icone: Scale, composant: Surface },
  vulnerabilite: { id: 'vulnerabilite', titre: 'Vulnérabilité', phrase: 'Les départements où une mauvaise saison pèse le plus.', icone: ShieldAlert, composant: Vulnerabilite },
  besoins: { id: 'besoins', titre: 'Besoins du pays', phrase: 'Semences et engrais nécessaires, département par département.', icone: BarChart3, composant: BesoinsPays },
  repartir: { id: 'repartir', titre: 'Répartir un stock', phrase: 'Du dépôt aux départements : la carte trace la proposition.', icone: Truck, composant: Repartir },
} satisfies Record<string, Fonctionnalite>

function fonctionnalitesDe(user: Utilisateur): { profil: string; liste: Fonctionnalite[] } {
  if (user.role === 'PRODUCTEUR') return { profil: 'Agriculteur', liste: [F.parcelle, F.saison, F.semis, F.semer, F.surface] }
  return { profil: "ONG et services de l'État", liste: [F.campagne, F.saison, F.alerte, F.vulnerabilite, F.besoins, F.repartir] }
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

  const { profil, liste } = useMemo(() => fonctionnalitesDe(user!), [user])
  const [idMode, setIdMode] = useState(liste[0].id)
  const actif = liste.find((f) => f.id === idMode) ?? liste[0]
  const [selection, setSelection] = useState<string | null>(null)
  const [position, setPosition] = useState<LonLat | null>(null)
  // L'année choisie vaut pour toutes les fonctionnalités ; au départ, la campagne à venir
  const [anneeChoisie, setAnnee] = useState<number | null>(null)
  const [sortie, setSortie] = useState<Sortie>({ vue: {} })
  const bulle = useRef<PoigneeBulle>(null)
  const racine = useRef<HTMLDivElement>(null)

  const large = ecran.l >= 768
  const [cran, setCran] = useState<Cran>(1)
  const marge = useMemo(
    // La carte se cadre dans la place laissée libre par la fenêtre (à droite) ou par le tiroir (en bas)
    () => (large ? { top: 70, bottom: 50, left: 70, right: LARGEUR_FENETRE_PX + 48 } : { top: 124, left: 10, right: 10, bottom: hauteurCran(cran === 2 ? 1 : cran, ecran.h) + 8 }),
    [large, ecran.h, cran],
  )
  const ouvrir = useCallback((id: string) => {
    setIdMode(id)
    setCran(1)
  }, [])
  const aller = ouvrir
  const cadre = useMemo<Cadre | null>(
    () => (ref && contours && user ? { ref, contours, user, selection, choisir: setSelection, position, definirPosition: setPosition, annee: anneeChoisie ?? anneeAVenir(ref.campagnes), choisirAnnee: setAnnee, aller, marge, cultureDemandee: null } : null),
    [ref, contours, user, selection, position, anneeChoisie, aller, marge],
  )
  const vue = useMemo<VueCarte | null>(() => (cadre ? { ambiance: 'jour', camera: cadrer.pays(cadre), ...sortie.vue } : null), [cadre, sortie.vue])

  return (
    <div ref={racine} className="scene relative h-dvh overflow-hidden bg-encre-nuit text-white">
      {vue && cadre ? (
        <Suspense fallback={null}>
          <Carte vue={vue} contours={contours} contoursZones={contoursZones} departements={ref?.departements} depart={{ centre: [-32, 18], zoom: 1.6 }}
            onDepartement={setSelection} onPoint={sortie.surPoint} onSurvol={(s) => bulle.current?.montrer(s)}
            onManipulation={(enCours) => racine.current?.classList.toggle('scene-manip', enCours)} />
        </Suspense>
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
            <p className="text-2xs text-white/60">{profil}</p>
          </div>
          <button type="button" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter" className="grid size-11 place-items-center rounded-lg text-white/70 transition hover:text-white">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <Dock fonctionnalites={liste} actif={actif.id} onChoisir={ouvrir} />


      {large && sortie.legende && <div className="verre-scene absolute bottom-8 left-24 z-10 rounded-lg px-3.5 py-3">{sortie.legende}</div>}

      {/* La fonctionnalité s'ouvre dans une fenêtre flottante (pop-up), un tiroir sur téléphone */}
      {cadre && (
        <Fenetre cle={actif.id} titre={actif.titre} icone={actif.icone} resume={sortie.resume} aEcouter={sortie.aEcouter} aEcouterWo={sortie.aEcouterWo} large={large} hauteurEcran={ecran.h} cran={cran} onCran={setCran} legende={sortie.legende}>
          <actif.composant key={actif.id} cadre={cadre} publier={setSortie} />
        </Fenetre>
      )}
    </div>
  )
}
