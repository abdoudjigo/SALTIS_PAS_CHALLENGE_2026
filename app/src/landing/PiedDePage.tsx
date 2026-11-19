// Pied de page de la landing : la terre sous le ciel. Marque et mission, liens, puis les sources
// et crédits (obligatoires) dans un bloc à part, et la mention d'honnêteté du prototype.
import { Link } from 'react-router'

const RUBRIQUES: { titre: string; liens: { libelle: string; to: string; ancre?: boolean }[] }[] = [
  {
    titre: 'Plateforme',
    liens: [
      { libelle: 'Les 6 zones', to: '/#zones', ancre: true },
      { libelle: 'Le récit : ciel, terre, décision', to: '/#ciel', ancre: true },
      { libelle: 'Entrer dans la carte', to: '/#entrer', ancre: true },
    ],
  },
  {
    titre: 'Le projet',
    liens: [
      { libelle: 'À propos', to: '/a-propos' },
      { libelle: 'Méthode et fiabilité', to: '/methode' },
      { libelle: 'Données et sources', to: '/donnees' },
      { libelle: 'Contact', to: '/contact' },
    ],
  },
  {
    titre: 'Informations',
    liens: [{ libelle: 'Mentions légales et confidentialité', to: '/mentions-legales' }],
  },
]

const SOURCES: [string, string][] = [
  ['Pluie', 'CHIRPS'],
  ['Climat', 'NASA POWER'],
  ['Sols', 'SoilGrids (ISRIC)'],
  ['Rendements et superficies', 'DAPSA, via HarvestStat et FEWS NET ; FAOSTAT'],
  ['Températures des océans', 'NOAA'],
  ['Contours des départements', 'GADM, version 4.1, https://gadm.org'],
  ['Fond de carte', 'Mapbox, OpenStreetMap'],
  ['Vent du globe', 'décor (prévisions GFS), pas une donnée du projet'],
]

function Linkedin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13M7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0"/>
    </svg>
  )
}

const EQUIPE: [string, string][] = [
  ['Abdoulaye Djigo', 'https://www.linkedin.com/in/abdoulaye-djigo-9898241b6/'],
  ['Aby Faye', 'https://www.linkedin.com/in/aby-f-1399b8269/'],
  ['Ibrahima Niasse Diouf', 'https://www.linkedin.com/in/ibrahima-niasse-diouf-b8b837310/'],
  ['Ndeye Khady Mbaye', 'https://www.linkedin.com/in/ndeye-khady-mbaye/'],
]

const LIEN = 'inline-flex min-h-11 items-center text-sm text-white/70 underline-offset-4 transition hover:text-white hover:underline'
const ETIQUETTE = 'text-2xs font-medium tracking-etiquette text-soleil-500 uppercase'

export function PiedDePage() {
  return (
    <footer className="pointer-events-auto relative bg-vert-900 text-white">
      {/* L'horizon : deux lignes de terre, comme sur l'emblème, font la transition depuis la page claire */}
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-full block h-16 w-full sm:h-24" aria-hidden>
        <path d="M0 70c240-58 480-58 720 0s480 58 720 0v50H0z" className="fill-terre-500" />
        <path d="M0 96c240-44 480-44 720 0s480 44 720 0v24H0z" className="fill-vert-900" />
      </svg>

      <div className="mx-auto max-w-6xl px-5 pt-14 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-8 lg:pt-20">
        <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[1.25fr_2fr]">
          <div className="max-w-sm">
            <p className="flex items-center gap-3 font-titre text-2xl font-semibold"><img src="/favicon.svg" alt="" className="size-10 rounded-xl" />Assaman & Suuf</p>
            <p className="mt-4 text-md leading-relaxed text-white/70">
              La pluie, le sol et les cultures des 45 départements du Sénégal, pour décider quoi semer et où porter les intrants.
            </p>
            <p className="mt-6 text-sm text-white/55">Équipe AKAI · SALTIS PAS Challenge 2026</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {RUBRIQUES.map((r) => (
              <nav key={r.titre} aria-label={r.titre}>
                <h2 className={ETIQUETTE}>{r.titre}</h2>
                <ul className="mt-2">
                  {r.liens.map((l) => (
                    <li key={l.to}>{l.ancre ? <a href={l.to} className={LIEN}>{l.libelle}</a> : <Link to={l.to} className={LIEN}>{l.libelle}</Link>}</li>
                  ))}
                </ul>
              </nav>
            ))}
            <nav aria-label="L'équipe sur LinkedIn">
              <h2 className={ETIQUETTE}>L'équipe</h2>
              <ul className="mt-2">
                {EQUIPE.map(([nom, url]) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer" className={`${LIEN} gap-2`}>
                      <Linkedin className="size-4 shrink-0" aria-hidden />{nom}<span className="sr-only"> (LinkedIn, nouvel onglet)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <section aria-labelledby="sources" className="mt-14 border-t border-white/12 pt-8">
          <h2 id="sources" className={ETIQUETTE}>Sources et crédits</h2>
          <dl className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCES.map(([quoi, source]) => (
              <div key={quoi} className="flex flex-col border-l border-white/15 pl-3.5">
                <dt className="text-xs text-white/50">{quoi}</dt>
                <dd className="text-sm text-white/85">{source}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/12 pt-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p><strong className="font-medium text-white/80">Estimations indicatives, pas des garanties.</strong> Doses et recommandations à valider avec l'ISRA et les conseillers agricoles.</p>
          <p className="shrink-0">© 2026 AKAI</p>
        </div>
      </div>
    </footer>
  )
}
