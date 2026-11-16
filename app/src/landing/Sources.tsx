// Bandeau des sources de données : elles défilent lentement, le survol met en pause.
// Chaque source affiche son logo (public/logos/, tirés de les_logos/ à la racine : fond blanc retiré, recadrés,
// 120 px de haut). Sans logo, le sigle sert de signature.
import clsx from 'clsx'
import { useEffect, useRef } from 'react'

interface Source {
  sigle: string
  organisme: string
  apport: string
  logo?: string
  /** taille du fichier en pixels : la place du logo est réservée avant son chargement (pas de décalage) */
  l?: number
  h?: number
}

/** Vitesse du défilement, en pixels par seconde, quelle que soit la largeur du bandeau */
const VITESSE_PX_S = 60

const SOURCES: Source[] = [
  { sigle: 'CHIRPS', organisme: 'Climate Hazards Center · UC Santa Barbara', apport: 'Pluie', logo: '/logos/chirps.webp', l: 104, h: 120 },
  { sigle: 'NASA POWER', organisme: 'NASA', apport: 'Climat', logo: '/logos/nasa.webp', l: 147, h: 120 },
  { sigle: 'NOAA', organisme: 'National Oceanic and Atmospheric Administration', apport: 'Océans', logo: '/logos/noaa.webp', l: 120, h: 120 },
  { sigle: 'SoilGrids', organisme: 'ISRIC · World Soil Information', apport: 'Sols', logo: '/logos/soilgrids.webp', l: 121, h: 120 },
  { sigle: 'DAPSA', organisme: "Ministère de l'Agriculture du Sénégal", apport: 'Rendements', logo: '/logos/dapsa.webp', l: 119, h: 120 },
  { sigle: 'FEWS NET', organisme: 'Famine Early Warning Systems Network', apport: 'Rendements', logo: '/logos/fewsnet.webp', l: 177, h: 120 },
  { sigle: 'HarvestStat', organisme: 'Statistiques de récoltes', apport: 'Rendements', logo: '/logos/harvest.webp', l: 115, h: 120 },
  { sigle: 'FAOSTAT', organisme: "Organisation des Nations unies pour l'alimentation et l'agriculture", apport: 'Rendements', logo: '/logos/faostat.webp', l: 120, h: 120 },
  { sigle: 'GADM', organisme: 'Contours administratifs, version 4.1', apport: 'Territoires', logo: '/logos/gadm.webp', l: 114, h: 98 },
  { sigle: 'OpenStreetMap', organisme: 'Fond de carte, avec Mapbox', apport: 'Carte', logo: '/logos/openstreetmap.webp', l: 214, h: 120 },
]

function Signature({ s }: { s: Source }) {
  return (
    <li className="flex shrink-0 items-center gap-4 px-8 sm:px-10">
      {s.logo ? (
        <span className="logo-3d grid h-16 shrink-0 place-items-center rounded-2xl bg-white px-3">
          <img src={s.logo} alt={s.sigle} width={s.l} height={s.h} loading="lazy" decoding="async" draggable={false} className="h-12 w-auto max-w-32 object-contain" />
        </span>
      ) : (
        <span className="font-titre text-2xl font-semibold tracking-tight whitespace-nowrap text-encre/80">{s.sigle}</span>
      )}
      <span className="max-w-44 text-2xs leading-snug text-encre-douce">
        <span className="block font-medium tracking-etiquette text-pluie-700 uppercase">{s.apport}</span>
        {s.organisme}
      </span>
    </li>
  )
}

export function Sources({ className }: { className?: string }) {
  const piste = useRef<HTMLDivElement>(null)
  // Durée d'un tour = largeur d'une copie / vitesse. Recalculée si la largeur change (police chargée, autre écran)
  useEffect(() => {
    const el = piste.current
    if (!el) return
    let duree = 0
    const regler = () => {
      const d = Math.round(el.scrollWidth / 2 / VITESSE_PX_S)
      if (d < 1 || d === duree) return
      duree = d
      el.style.setProperty('--duree', `${d}s`)
    }
    regler()
    const observateur = new ResizeObserver(regler)
    observateur.observe(el)
    return () => observateur.disconnect()
  }, [])

  return (
    <section className={clsx('sources', className)} aria-labelledby="titre-sources">
      <p id="titre-sources" className="text-2xs font-medium tracking-etiquette text-encre-douce uppercase">Sources des données</p>
      <div className="sources-fenetre group mt-6">
        {/* Deux copies de la liste sur une même piste : le défilement boucle sans saut. La seconde est masquée aux lecteurs d'écran. */}
        <div ref={piste} className="sources-piste">
          <ul className="sources-ruban">
            {SOURCES.map((s) => <Signature key={s.sigle} s={s} />)}
          </ul>
          <ul className="sources-ruban" aria-hidden>
            {SOURCES.map((s) => <Signature key={s.sigle} s={s} />)}
          </ul>
        </div>
      </div>
    </section>
  )
}
