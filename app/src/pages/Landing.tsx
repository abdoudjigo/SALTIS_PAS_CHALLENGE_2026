import { ArrowDown } from 'lucide-react'
import { useEffect, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router'
import { EnTetePublic } from '../vitrine/EnTetePublic'
import { PiedDePage } from '../vitrine/PiedDePage'

const delai = (s: number) => ({ '--delai': `${s}s` }) as CSSProperties

const REPERES = [
  {
    nombre: '45',
    unite: 'départements',
    texte: 'Chaque saison des pluies depuis 1981, comparée à la normale du département.',
  },
  {
    nombre: '36',
    unite: 'décades par an',
    texte: 'Tous les dix jours, la pluie tombée face à la pluie attendue : la saison est-elle en avance ou en retard ?',
  },
  {
    nombre: '12',
    unite: 'cultures',
    texte: "Pour chacune, le cycle court, moyen ou long qui a le plus de chances d'aller au bout de la saison.",
  },
  {
    nombre: '6',
    unite: 'zones agroécologiques',
    texte: "Des doses d'engrais et de semis par zone, pour estimer les besoins et orienter les intrants des ONG et des services de l'État.",
  },
]

const BOUTON = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition duration-300 active:scale-[0.98]'
const BOUTON_PLEIN = `${BOUTON} bg-soleil-500 text-nuit-900 hover:bg-soleil-100`
const BOUTON_VERRE = `${BOUTON} border border-white/30 bg-nuit-900/40 text-white hover:border-white/60 hover:bg-white/10`

export default function Landing() {
  const { hash } = useLocation()

  // Arrivée depuis une autre page sur « /#decouvrir »
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView()
  }, [hash])

  return (
    <main className="relative">
      <section className="pointer-events-none relative flex min-h-svh flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10 lg:px-[6vw]">
        <EnTetePublic className="vitrine-entree pointer-events-auto" />

        <div className="pointer-events-auto mt-auto max-w-[36rem] pb-[calc(var(--sol)*0.75+1.5rem)] md:my-auto md:pb-[calc(var(--sol)*0.7)]">
          <p className="vitrine-entree text-xs font-medium tracking-[0.22em] text-brume uppercase" style={delai(0.1)}>
            Assaman, le ciel <span className="mx-2 text-soleil-500">·</span> Suuf, la terre
          </p>
          <h1 className="vitrine-entree mt-4 font-titre text-[clamp(2.1rem,min(7.6vw,10.5svh),4.5rem)] leading-[1.04] font-medium tracking-tight text-balance" style={delai(0.2)}>
            Le <span className="text-[#a9d0f2]">ciel</span> et la <span className="text-soleil-500">terre</span>, enfin réunis pour chaque champ du Sénégal.
          </h1>
          <p className="vitrine-entree vitrine-detail mt-5 max-w-md text-base leading-relaxed text-white/80 sm:text-lg" style={delai(0.35)}>
            La pluie de chaque département, suivie tous les dix jours, pour décider quoi semer et où porter les intrants.
          </p>
          <div className="vitrine-entree mt-8 flex flex-wrap gap-3" style={delai(0.5)}>
            <a href="#decouvrir" className={BOUTON_PLEIN}>
              Découvrir <ArrowDown className="size-4" aria-hidden />
            </a>
            <Link to="/connexion" className={BOUTON_VERRE}>Se connecter</Link>
          </div>
        </div>
      </section>

      <section id="decouvrir" className="relative scroll-mt-0 bg-linear-to-b from-[#1a0e07] via-[#120c12] to-nuit-900 px-5 pt-20 pb-20 sm:px-10 lg:px-[6vw] lg:pt-32">
        <h2 className="max-w-3xl font-titre text-[clamp(1.9rem,5.2vw,3.4rem)] leading-[1.08] font-medium tracking-tight text-balance">
          De la pluie qui tombe à la décision qu'on prend.
        </h2>

        <ol className="mt-14 grid gap-x-16 gap-y-12 md:grid-cols-2 lg:mt-24">
          {REPERES.map((r, i) => (
            <li key={r.unite} className={i % 2 === 1 ? 'md:mt-20' : undefined}>
              <div className="flex items-baseline gap-3 border-b border-white/15 pb-3">
                <span className="font-titre text-6xl leading-none font-medium text-soleil-500 sm:text-7xl">{r.nombre}</span>
                <span className="text-sm tracking-wide text-brume uppercase">{r.unite}</span>
              </div>
              <p className="mt-4 max-w-sm text-lg leading-relaxed text-white/85">{r.texte}</p>
            </li>
          ))}
        </ol>

        <div className="mt-20 max-w-2xl border-l-2 border-terre-500 pl-5 lg:mt-32 lg:ml-[18%]">
          <h3 className="font-titre text-2xl font-medium sm:text-3xl">Nous écrivons aussi ce que nous ne savons pas.</h3>
          <p className="mt-3 leading-relaxed text-white/75">
            Une valeur absente s'affiche « non disponible », jamais zéro. Une dose qui n'a pas été validée porte la mention
            « à confirmer avec l'ISRA ». La vulnérabilité d'un département est relative et indicative, et c'est écrit à côté du chiffre.
          </p>
        </div>

        <div className="mt-20 flex flex-wrap items-center gap-3 lg:mt-28">
          <Link to="/inscription" className={BOUTON_PLEIN}>Créer un compte producteur</Link>
          <Link to="/connexion" className={BOUTON_VERRE}>Se connecter</Link>
        </div>
      </section>
      <PiedDePage />
    </main>
  )
}
