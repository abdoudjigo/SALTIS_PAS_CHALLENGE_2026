// Bandeau des sources de données : elles défilent lentement, le survol met en pause.
// Chaque source s'affiche en signature typographique (sigle + organisme). Pour afficher un vrai logo, déposer
// son fichier dans public/logos/ (ex. public/logos/nasa-power.svg) et renseigner `logo` ci-dessous ;
// les logos officiels sont des marques : n'en ajouter qu'avec l'accord de l'organisme.
import clsx from 'clsx'

interface Source {
  sigle: string
  organisme: string
  apport: string
  logo?: string
}

const SOURCES: Source[] = [
  { sigle: 'CHIRPS', organisme: 'Climate Hazards Center · UC Santa Barbara', apport: 'Pluie' },
  { sigle: 'NASA POWER', organisme: 'NASA', apport: 'Climat' },
  { sigle: 'NOAA', organisme: 'National Oceanic and Atmospheric Administration', apport: 'Océans' },
  { sigle: 'SoilGrids', organisme: 'ISRIC · World Soil Information', apport: 'Sols' },
  { sigle: 'DAPSA', organisme: "Ministère de l'Agriculture du Sénégal", apport: 'Rendements' },
  { sigle: 'FEWS NET', organisme: 'Famine Early Warning Systems Network', apport: 'Rendements' },
  { sigle: 'HarvestStat', organisme: 'Statistiques de récoltes', apport: 'Rendements' },
  { sigle: 'FAOSTAT', organisme: "Organisation des Nations unies pour l'alimentation et l'agriculture", apport: 'Rendements' },
  { sigle: 'GADM', organisme: 'Contours administratifs, version 4.1', apport: 'Territoires' },
  { sigle: 'OpenStreetMap', organisme: 'Fond de carte, avec Mapbox', apport: 'Carte' },
]

function Signature({ s }: { s: Source }) {
  return (
    <li className="flex shrink-0 items-center gap-4 px-8 sm:px-10">
      {s.logo ? (
        <img src={s.logo} alt={s.sigle} className="h-9 w-auto opacity-80 grayscale transition group-hover:opacity-100 group-hover:grayscale-0" />
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
  return (
    <section className={clsx('sources', className)} aria-labelledby="titre-sources">
      <p id="titre-sources" className="text-2xs font-medium tracking-etiquette text-encre-douce uppercase">Les données qui nourrissent nos modèles</p>
      <div className="sources-fenetre group mt-6">
        {/* Deux copies de la liste : le défilement boucle sans saut. La seconde est masquée aux lecteurs d'écran. */}
        <ul className="sources-ruban">
          {SOURCES.map((s) => <Signature key={s.sigle} s={s} />)}
        </ul>
        <ul className="sources-ruban" aria-hidden>
          {SOURCES.map((s) => <Signature key={s.sigle} s={s} />)}
        </ul>
      </div>
    </section>
  )
}
