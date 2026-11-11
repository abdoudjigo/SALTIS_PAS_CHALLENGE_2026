import { Droplets, Search, Sprout } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EtatVide, Erreur } from '../components/ui/EtatVide'
import { Badge, BadgeAdequation, EnTetePage, Note, Segment, Squelette } from '../components/ui/base'
import { SelecteurDepartement } from '../components/ui/Selecteurs'
import { useChoixCultures } from '../hooks/donnees'
import { useTerritoire } from '../hooks/territoire'
import { libelle, nombre, pct } from '../lib/format'
import type { LigneChoixCulture, NiveauAdequation } from '../types/marts'

type Filtre = 'toutes' | NiveauAdequation
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'toutes', libelle: 'Toutes' },
  { valeur: 'adaptée', libelle: 'Adaptées' },
  { valeur: 'à risque', libelle: 'À risque' },
  { valeur: 'irrigation requise', libelle: 'Irriguées' },
]
const CYCLE: Record<string, string> = { courte: 'court', moyenne: 'moyen', longue: 'long' }
const ORDRE: (NiveauAdequation | null)[] = ['adaptée', 'à risque', 'déconseillée', 'irrigation requise', 'non évaluée (culture pluriannuelle)']

function Barre({ valeur }: { valeur: number | null }) {
  const couleur = valeur === null ? 'bg-stone-200' : valeur >= 80 ? 'bg-vert-500' : valeur > 50 ? 'bg-soleil-500' : 'bg-alerte-500'
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full transition-[width] duration-500 ${couleur}`} style={{ width: `${valeur ?? 0}%` }} />
    </div>
  )
}

function OptionLigne({ o }: { o: LigneChoixCulture }) {
  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <span className={`w-28 shrink-0 truncate ${o.rang_option === 1 ? 'font-semibold' : ''}`} title={o.option}>
        {o.type_option === 'CYCLE' ? `Cycle ${CYCLE[o.option] ?? o.option}` : o.option}
      </span>
      <span className="w-12 shrink-0 text-xs text-encre-douce tabular-nums">{nombre(o.cycle_jours)} j</span>
      <Barre valeur={o.proba_cycle_couvert_pct} />
      <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums">{pct(o.proba_cycle_couvert_pct)}</span>
    </li>
  )
}

function CarteCulture({ culture, options }: { culture: string; options: LigneChoixCulture[] }) {
  const cycles = options.filter((o) => o.type_option === 'CYCLE')
  const varietes = options.filter((o) => o.type_option === 'VARIETE')
  const meilleur = [...cycles].sort((a, b) => ORDRE.indexOf(a.niveau_adequation) - ORDRE.indexOf(b.niveau_adequation))[0]
  const eau = cycles.find((c) => c.option === 'moyenne')?.proba_besoin_eau_couvert_pct
  const irriguee = meilleur?.niveau_adequation === 'irrigation requise'
  const pluriannuelle = meilleur?.niveau_adequation?.startsWith('non évaluée')

  return (
    <article className="carte flex flex-col p-4 animate-apparition">
      <header className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-semibold">{libelle(culture)}</h3>
        <BadgeAdequation niveau={meilleur?.niveau_adequation} />
      </header>
      {pluriannuelle ? (
        <p className="text-sm text-encre-douce">Culture de 9 à 12 mois : la durée de la saison des pluies n'est pas le bon critère.</p>
      ) : (
        <>
          <p className="mb-1 text-[11px] font-medium tracking-wide text-encre-douce uppercase">Années où la saison couvre le cycle</p>
          <ul>{cycles.map((o) => <OptionLigne key={o.option} o={o} />)}</ul>
          {varietes.length > 0 && (
            <>
              <p className="mt-3 mb-1 text-[11px] font-medium tracking-wide text-encre-douce uppercase">Variétés documentées</p>
              <ul>{varietes.map((o) => <OptionLigne key={o.option} o={o} />)}</ul>
              {varietes.map((v) => (
                <p key={v.option} className="mt-1 text-xs text-encre-douce">
                  {v.option} : tolérance sécheresse {v.tolerance_secheresse ?? '—'}, semences {v.disponibilite_semences ?? '—'}.
                </p>
              ))}
            </>
          )}
          <footer className="mt-auto flex flex-wrap gap-2 pt-3">
            {irriguee ? <Badge ton="pluie"><Droplets className="size-3" /> dépend de l'accès à l'eau</Badge>
              : eau !== null && eau !== undefined && <Badge ton="pluie"><Droplets className="size-3" /> besoin en eau couvert {pct(eau)} des années</Badge>}
          </footer>
        </>
      )}
    </article>
  )
}

export default function ChoixCultures() {
  const { code, departement } = useTerritoire()
  const { data, isPending, error, refetch } = useChoixCultures(code)
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [recherche, setRecherche] = useState('')

  const cultures = useMemo(() => {
    const groupes = new Map<string, LigneChoixCulture[]>()
    ;(data ?? []).forEach((o) => groupes.set(o.culture, [...(groupes.get(o.culture) ?? []), o]))
    const meilleureProba = (opts: LigneChoixCulture[]) => Math.max(-1, ...opts.map((o) => o.proba_cycle_couvert_pct ?? -1))
    return [...groupes.entries()]
      .filter(([c, opts]) => (filtre === 'toutes' || opts.some((o) => o.type_option === 'CYCLE' && o.niveau_adequation === filtre))
        && c.toLowerCase().includes(recherche.toLowerCase()))
      .sort((a, b) => meilleureProba(b[1]) - meilleureProba(a[1]))
  }, [data, filtre, recherche])

  return (
    <>
      <EnTetePage
        titre="Cultures et variétés"
        description={`Quelles cultures, et quel cycle, la saison des pluies de ${departement?.departement ?? 'votre département'} permet-elle ? Probabilités calculées sur 1991-2020.`}
        actions={<SelecteurDepartement />}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="overflow-x-auto"><Segment options={FILTRES} valeur={filtre} onChange={setFiltre} libelle="Filtrer" /></div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-encre-douce" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une culture" className="champ pl-9" aria-label="Rechercher une culture" />
        </div>
      </div>

      {error ? <Erreur erreur={error} reessayer={refetch} /> : isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Squelette key={i} className="h-56" />)}</div>
      ) : cultures.length === 0 ? (
        <EtatVide icone={Sprout} titre="Aucune culture ne correspond" texte="Changez le filtre ou la recherche." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cultures.map(([c, opts]) => <CarteCulture key={c} culture={c} options={opts} />)}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <Note>Comparez les options sur la part des années où la saison couvre le cycle. Le score des cycles court et long reprend la part « eau » du cycle moyen.</Note>
        <Note ton="soleil">Le mil ressort « déconseillé » dans le nord, où il est pourtant cultivé : calibration en cours avec les techniciens.</Note>
      </div>
    </>
  )
}
