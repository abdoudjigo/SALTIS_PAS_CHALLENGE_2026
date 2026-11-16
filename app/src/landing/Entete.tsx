import clsx from 'clsx'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

export interface Chapitre {
  id: string
  libelle: string
}

const PAGES = [
  { to: '/a-propos', libelle: 'À propos' },
  { to: '/methode', libelle: 'Méthode' },
  { to: '/donnees', libelle: 'Données' },
  { to: '/contact', libelle: 'Contact' },
]

/**
 * En-tête de la landing : une île flottante. Elle suit le chapitre en cours (curseur qui glisse d'un lien à
 * l'autre), montre l'avancement de la lecture et se resserre dès qu'on défile.
 */
export function Entete({ chapitres, actif, onEntrer }: { chapitres: Chapitre[]; actif: string; onEntrer: () => void }) {
  const [serree, setSerree] = useState(false)
  const [menu, setMenu] = useState(false)
  const progres = useRef<HTMLSpanElement>(null)
  const liens = useRef(new Map<string, HTMLAnchorElement>())
  const [curseur, setCurseur] = useState<{ x: number; l: number } | null>(null)

  // Menu : se ferme avec Échap, au clic à côté et si l'écran repasse en grand ; la page ne défile pas dessous
  useEffect(() => {
    if (!menu) return
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    const grand = window.matchMedia('(min-width: 768px)')
    const fermer = () => grand.matches && setMenu(false)
    window.addEventListener('keydown', echap)
    grand.addEventListener('change', fermer)
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', echap)
      grand.removeEventListener('change', fermer)
      document.body.style.overflow = avant
    }
  }, [menu])

  useEffect(() => {
    const suivre = () => {
      setSerree(window.scrollY > 24)
      const total = document.documentElement.scrollHeight - window.innerHeight
      if (progres.current) progres.current.style.scale = `${total > 0 ? Math.min(window.scrollY / total, 1) : 0} 1`
    }
    suivre()
    window.addEventListener('scroll', suivre, { passive: true })
    return () => window.removeEventListener('scroll', suivre)
  }, [])

  useLayoutEffect(() => {
    const mesurer = () => {
      const el = liens.current.get(actif)
      setCurseur(el ? { x: el.offsetLeft, l: el.offsetWidth } : null)
    }
    mesurer()
    window.addEventListener('resize', mesurer)
    return () => window.removeEventListener('resize', mesurer)
  }, [actif, serree])

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className={clsx('ile pointer-events-auto relative flex items-center overflow-hidden rounded-full', serree ? 'ile-serree gap-1 py-1.5 pr-1.5 pl-2' : 'gap-2 py-2 pr-2 pl-3 sm:gap-4 sm:pl-4')}>
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Assaman & Suuf, accueil">
          <img src="/favicon.svg" alt="" className="size-8 rounded-[10px]" />
          <span className={clsx('font-titre text-lg font-semibold whitespace-nowrap text-white transition-all duration-500', serree ? 'max-w-0 opacity-0 lg:max-w-40 lg:opacity-100' : 'max-w-40')}>
            Assaman & Suuf
          </span>
        </Link>

        <nav aria-label="Chapitres" className="relative hidden items-center md:flex">
          <span aria-hidden className="ile-curseur absolute inset-y-0 left-0 rounded-full bg-white/[0.14]" style={curseur ? { translate: `${curseur.x}px 0`, width: curseur.l } : { opacity: 0, width: 0 }} />
          {chapitres.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              ref={(el) => {
                if (el) liens.current.set(c.id, el)
                else liens.current.delete(c.id)
              }}
              aria-current={actif === c.id ? 'true' : undefined}
              className={clsx('relative inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-300', actif === c.id ? 'text-white' : 'text-white/65 hover:text-white')}
            >
              {c.libelle}
            </a>
          ))}
        </nav>

        {/* Téléphone : le chapitre en cours, en clair */}
        <span className="px-1 text-sm font-medium whitespace-nowrap text-white/70 max-[430px]:hidden md:hidden">{chapitres.find((c) => c.id === actif)?.libelle}</span>

        <button type="button" onClick={onEntrer} className="group inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-soleil-500 pr-3 pl-4 text-sm font-semibold text-vert-900 transition hover:bg-soleil-100 active:scale-[0.98]">
          Entrer <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
        </button>
        <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu" className="grid size-10 shrink-0 place-items-center rounded-full text-white transition hover:bg-white/10">
          {menu ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
        </button>

        <span ref={progres} aria-hidden className="ile-progres absolute inset-x-0 bottom-0 h-[2px] bg-ciel-lueur" style={{ scale: '0 1' }} />
      </div>

      {menu && (
        <>
          <button type="button" aria-label="Fermer le menu" onClick={() => setMenu(false)} className="voile-menu pointer-events-auto fixed inset-0 -z-10 bg-encre/25 backdrop-blur-sm" />
          <nav aria-label="Menu" className="fiche menu-3d pointer-events-auto absolute top-[calc(100%+0.5rem)] left-1/2 max-h-[calc(100svh-6rem)] w-[min(92vw,22rem)] -translate-x-1/2 overflow-y-auto rounded-3xl p-2">
            <p className="px-4 pt-3 pb-1 text-2xs font-medium tracking-etiquette text-encre-douce uppercase">Chapitres</p>
            {chapitres.map((c) => (
              <a key={c.id} href={`#${c.id}`} onClick={() => setMenu(false)} aria-current={actif === c.id ? 'true' : undefined}
                className={clsx('flex min-h-11 items-center justify-between rounded-2xl px-4 text-md font-medium transition', actif === c.id ? 'bg-vert-50 text-vert-700' : 'text-encre hover:bg-vert-50')}>
                {c.libelle}
                {actif === c.id && <span className="size-1.5 rounded-full bg-vert-500" aria-hidden />}
              </a>
            ))}
            <p className="mt-1 border-t border-trait px-4 pt-3 pb-1 text-2xs font-medium tracking-etiquette text-encre-douce uppercase">Le projet</p>
            {PAGES.map((p) => (
              <Link key={p.to} to={p.to} onClick={() => setMenu(false)} className="flex min-h-11 items-center rounded-2xl px-4 text-md text-encre transition hover:bg-vert-50">{p.libelle}</Link>
            ))}
            <button type="button" onClick={() => { setMenu(false); onEntrer() }}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-vert-700 text-md font-semibold text-white transition hover:bg-vert-900">
              Entrer dans la carte <ArrowRight className="size-4" aria-hidden />
            </button>
          </nav>
        </>
      )}
    </header>
  )
}
