import { AlertTriangle, CheckCircle2, History, Loader2, Plus, Save, Sparkles, Trash2, Warehouse } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { TYPES_ORGANISATION } from '../auth/roles'
import { EtatVide } from '../components/ui/EtatVide'
import { Badge, EnTetePage, Note, Panneau, Segment, Squelette } from '../components/ui/base'
import { SelectNatif } from '../components/ui/Selecteurs'
import {
  useEnregistrerStocks, useGenererScenario, useReferentiels, useScenarios, useStocks, useSupprimerScenario, useValiderScenario,
} from '../hooks/donnees'
import { config } from '../config'
import { libelle, nombre, pct, tonnes } from '../lib/format'
import type { Intrant, NiveauDestination, ParametresScenario, Proposition, Scenario, Stock } from '../types/marts'

const NIVEAUX: { valeur: NiveauDestination; libelle: string }[] = [
  { valeur: 'ZONE', libelle: 'Zone' },
  { valeur: 'REGION', libelle: 'Région' },
  { valeur: 'DEPARTEMENT', libelle: 'Département' },
]

// --- Stocks déclarés -------------------------------------------------------------
function Stocks({ intrants }: { intrants: Intrant[] }) {
  const { data: stocks, isPending } = useStocks()
  const enregistrer = useEnregistrerStocks()
  const [brouillon, setBrouillon] = useState<Stock[] | null>(null)
  const lignes = brouillon ?? stocks ?? []
  const maj = (i: number, modif: Partial<Stock>) => setBrouillon(lignes.map((l, j) => (j === i ? { ...l, ...modif } : l)))

  return (
    <Panneau titre="Stocks déclarés" sousTitre="Propres à votre organisation, jamais mutualisés"
      action={brouillon && (
        <button onClick={() => enregistrer.mutate(lignes.filter((l) => (l.quantite_t ?? 0) > 0), { onSuccess: () => setBrouillon(null) })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-vert-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-vert-900">
          {enregistrer.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Enregistrer
        </button>
      )}>
      {isPending ? <Squelette className="h-24" /> : (
        <div className="space-y-2">
          {lignes.length === 0 && <p className="text-sm text-encre-douce">Aucun stock déclaré.</p>}
          {lignes.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <select className="champ flex-1 py-2" value={l.code_intrant} onChange={(e) => maj(i, { code_intrant: e.target.value })} aria-label="Intrant">
                {intrants.map((x) => <option key={x.code_intrant} value={x.code_intrant}>{x.nom_intrant}</option>)}
              </select>
              <input type="number" min="0" className="champ w-28 py-2 text-right" value={l.quantite_t ?? ''} aria-label="Quantité en tonnes"
                onChange={(e) => maj(i, { quantite_t: e.target.value === '' ? null : Number(e.target.value) })} />
              <span className="text-xs text-encre-douce">t</span>
              <button onClick={() => setBrouillon(lignes.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-encre-douce hover:bg-stone-100" aria-label="Retirer">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button onClick={() => setBrouillon([...lignes, { code_intrant: intrants[0]?.code_intrant ?? '', quantite_t: null, campagne: config.campagneParDefaut }])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-vert-700 hover:underline">
            <Plus className="size-4" /> Ajouter un intrant
          </button>
        </div>
      )}
    </Panneau>
  )
}

// --- Résultat d'un scénario -------------------------------------------------------
function Resultat({ scenario }: { scenario: Scenario }) {
  const valider = useValiderScenario()
  const [ajuste, setAjuste] = useState<Record<string, number>>({})
  const valide = scenario.statut === 'VALIDE'
  const quantite = (p: Proposition) => ajuste[p.code_territoire] ?? p.quantite_validee_t ?? p.quantite_proposee_t
  const totalAjuste = scenario.propositions.reduce((a, p) => a + (quantite(p) || 0), 0)
  // tolérance : chaque quantité proposée est arrondie à 0,1 t
  const tolerance = 0.05 * scenario.propositions.length + 0.01
  const depasseStock = totalAjuste > scenario.quantite_t + tolerance
  const depasseBesoin = scenario.propositions.filter((p) => quantite(p) > p.besoin_t + 0.05)
  const max = Math.max(...scenario.propositions.map((p) => p.besoin_t), 1)

  return (
    <Panneau
      titre={`${scenario.nom_intrant} · ${tonnes(scenario.quantite_t)} · campagne ${scenario.campagne}`}
      sousTitre={`Par ${NIVEAUX.find((n) => n.valeur === scenario.niveau_destination)?.libelle.toLowerCase()} · ${scenario.parametres.cultures.map(libelle).join(', ') || 'toutes cultures'} · poids vulnérabilité ${scenario.parametres.poids_vulnerabilite} %`}
      action={<Badge ton={valide ? 'vert' : 'soleil'}>{valide ? 'Validé' : 'Proposé'}</Badge>}
      corpsClassName="p-0">
      <div className="grid grid-cols-2 gap-px border-b border-trait bg-trait sm:grid-cols-4">
        {[
          ['Besoin total', tonnes(scenario.besoin_total_t)],
          ['Proposé', tonnes(scenario.total_propose_t)],
          ['Non réparti', tonnes(scenario.reste_non_reparti_t)],
          ['Couverture du besoin', pct((scenario.total_propose_t / scenario.besoin_total_t) * 100)],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-4 py-3">
            <div className="text-xs text-encre-douce">{k}</div>
            <div className="text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      {scenario.propositions.length === 0 ? (
        <EtatVide icone={AlertTriangle} titre="Aucun territoire ne peut recevoir cet intrant"
          texte="Aucune dose connue pour les cultures choisies : saisissez une dose ou choisissez d'autres cultures." />
      ) : (
        <ul className="max-h-[460px] divide-y divide-trait overflow-y-auto">
          {scenario.propositions.map((p) => (
            <li key={p.code_territoire} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-[180px_1fr_auto]">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{libelle(p.territoire)}</div>
                <div className="text-xs text-encre-douce">
                  {p.nb_departements > 1 ? `${p.nb_departements} dép. · ` : ''}vulnérabilité {nombre(p.vulnerabilite_moyenne)}
                </div>
              </div>
              <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                <div className="relative h-2.5 overflow-hidden rounded-full bg-stone-100" title={`Besoin ${tonnes(p.besoin_t)}`}>
                  <div className="absolute inset-y-0 left-0 rounded-full bg-stone-200" style={{ width: `${(p.besoin_t / max) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-full bg-vert-500 transition-[width] duration-500" style={{ width: `${(Math.min(quantite(p), p.besoin_t) / max) * 100}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-encre-douce">
                  besoin {tonnes(p.besoin_t)} · couvert à {pct((quantite(p) / p.besoin_t) * 100)}
                  {ajuste[p.code_territoire] !== undefined && <> · proposé {tonnes(p.quantite_proposee_t)}</>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="number" min="0" step="0.1" disabled={valide} aria-label={`Quantité pour ${p.territoire}`}
                  className={`champ w-28 py-1.5 text-right tabular-nums ${quantite(p) > p.besoin_t + 0.05 ? 'border-alerte-500' : ''}`}
                  value={quantite(p)} onChange={(e) => setAjuste({ ...ajuste, [p.code_territoire]: e.target.value === '' ? 0 : Number(e.target.value) })} />
                <span className="text-xs text-encre-douce">t</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="space-y-3 border-t border-trait p-4">
        {scenario.nb_couples_sans_dose > 0 && (
          <Note ton="soleil">{scenario.nb_couples_sans_dose} couples département × culture sont exclus faute de dose connue (« dose à saisir »).</Note>
        )}
        {depasseStock && <p className="text-sm text-alerte-700">Le total ajusté ({tonnes(totalAjuste)}) dépasse la quantité disponible.</p>}
        {depasseBesoin.length > 0 && <p className="text-sm text-alerte-700">{depasseBesoin.length} territoire(s) reçoivent plus que leur besoin.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-encre-douce">Méthode {scenario.methode} · version {scenario.version_algorithme} · gain de rendement indicatif</p>
          {!valide && (
            <button disabled={depasseStock || depasseBesoin.length > 0 || valider.isPending}
              onClick={() => valider.mutate({ id: scenario.id, quantites: Object.fromEntries(scenario.propositions.map((p) => [p.code_territoire, quantite(p)])) })}
              className="inline-flex items-center gap-2 rounded-xl bg-vert-700 px-4 py-2 text-sm font-semibold text-white hover:bg-vert-900 disabled:opacity-40">
              {valider.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Valider la répartition
            </button>
          )}
        </div>
      </footer>
    </Panneau>
  )
}

// --- Écran -------------------------------------------------------------------------
export default function AgroDistrib() {
  const { user } = useAuth()
  const { data: ref } = useReferentiels()
  const { data: stocks } = useStocks()
  const { data: scenarios, isPending: chargeScenarios } = useScenarios()
  const generer = useGenererScenario()
  const supprimer = useSupprimerScenario()
  const [selection, setSelection] = useState<number | null>(null)
  const zoneResultat = useRef<HTMLDivElement>(null)
  const [p, setP] = useState<ParametresScenario>({ code_intrant: 'NPK_15_15_15', quantite_t: 20000, campagne: config.campagneParDefaut, niveau_destination: 'ZONE', cultures: ['MIL (SOUNA)'], poids_vulnerabilite: 30 })
  const maj = <K extends keyof ParametresScenario>(k: K, v: ParametresScenario[K]) => setP((x) => ({ ...x, [k]: v }))

  const intrants = ref?.intrants ?? []
  const stock = stocks?.find((s) => s.code_intrant === p.code_intrant)?.quantite_t
  const courant = useMemo(() => scenarios?.find((s) => s.id === selection) ?? scenarios?.[0], [scenarios, selection])
  const basculerCulture = (c: string) => maj('cultures', p.cultures.includes(c) ? p.cultures.filter((x) => x !== c) : [...p.cultures, c])

  return (
    <>
      <EnTetePage titre="AgroDistrib"
        description={`Répartition des intrants de ${user?.organisation?.nom ?? 'votre organisation'}${user?.organisation ? ` (${TYPES_ORGANISATION[user.organisation.type]})` : ''} entre territoires. La solution propose, vous comparez, ajustez et validez.`} />

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Panneau titre="Paramètres de la répartition">
            <form className="space-y-4" onSubmit={(e) => {
              e.preventDefault()
              generer.mutate(p, {
                onSuccess: (s) => {
                  setSelection(s.id)
                  // sur mobile, le résultat est sous le formulaire : on y amène l'utilisateur
                  if (window.matchMedia('(max-width: 1279px)').matches) zoneResultat.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                },
              })
            }}>
              <div>
                <label className="etiquette" htmlFor="intrant">Intrant</label>
                <SelectNatif id="intrant" value={p.code_intrant} onChange={(e) => maj('code_intrant', e.target.value)}>
                  {intrants.map((i) => <option key={i.code_intrant} value={i.code_intrant}>{i.nom_intrant}</option>)}
                </SelectNatif>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="etiquette" htmlFor="qte">Quantité (t)</label>
                  <input id="qte" type="number" min="1" className="champ" value={p.quantite_t} onChange={(e) => maj('quantite_t', Number(e.target.value))} />
                </div>
                <div>
                  <label className="etiquette" htmlFor="camp">Campagne</label>
                  <input id="camp" type="number" className="champ" value={p.campagne} onChange={(e) => maj('campagne', Number(e.target.value))} />
                </div>
              </div>
              {stock !== undefined && stock !== null ? (
                <p className={`text-xs ${p.quantite_t > stock ? 'text-alerte-700' : 'text-encre-douce'}`}>
                  <Warehouse className="mr-1 inline size-3.5" />Stock déclaré : {tonnes(stock)}{p.quantite_t > stock ? ' — quantité supérieure au stock' : ''}
                </p>
              ) : <p className="text-xs text-encre-douce">Aucun stock déclaré pour cet intrant.</p>}
              <div>
                <span className="etiquette">Niveau de répartition</span>
                <Segment<NiveauDestination> options={NIVEAUX} valeur={p.niveau_destination} onChange={(v) => maj('niveau_destination', v)} libelle="Niveau de répartition" className="w-full [&>button]:flex-1" />
              </div>
              <div>
                <span className="etiquette">Cultures concernées</span>
                <div className="flex flex-wrap gap-1.5">
                  {(ref?.cultures ?? []).map((c) => (
                    <button type="button" key={c} onClick={() => basculerCulture(c)} aria-pressed={p.cultures.includes(c)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${p.cultures.includes(c) ? 'bg-vert-700 text-white ring-vert-700' : 'bg-white text-encre-douce ring-trait hover:ring-vert-500'}`}>
                      {libelle(c)}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-encre-douce">Aucune sélection = toutes les cultures avec une dose connue.</p>
              </div>
              <div>
                <label className="etiquette" htmlFor="poids">Priorité : besoin ↔ vulnérabilité</label>
                <input id="poids" type="range" min="0" max="100" step="5" value={p.poids_vulnerabilite} onChange={(e) => maj('poids_vulnerabilite', Number(e.target.value))}
                  className="w-full accent-vert-700" />
                <div className="flex justify-between text-[11px] text-encre-douce">
                  <span>Au prorata du besoin</span><span className="font-semibold text-encre">{p.poids_vulnerabilite} %</span><span>Équité (vulnérables)</span>
                </div>
              </div>
              {generer.error && <p role="alert" className="text-sm text-alerte-700">{generer.error.message}</p>}
              <button type="submit" disabled={generer.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-vert-700 px-4 py-3 text-sm font-semibold text-white hover:bg-vert-900 disabled:opacity-50">
                {generer.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Proposer une répartition
              </button>
            </form>
          </Panneau>
          <Stocks intrants={intrants} />
        </div>

        <div ref={zoneResultat} className="scroll-mt-20 space-y-4">
          {generer.isPending ? <Squelette className="h-96" /> : courant ? <Resultat key={courant.id} scenario={courant} /> : (
            <div className="carte"><EtatVide icone={Sparkles} titre="Aucune proposition pour l'instant"
              texte="Choisissez l'intrant, la quantité, le niveau et vos priorités, puis lancez une proposition." /></div>
          )}

          {!chargeScenarios && scenarios && scenarios.length > 1 && (
            <Panneau titre="Historique" action={<History className="size-4 text-encre-douce" />} corpsClassName="p-2">
              <ul>
                {scenarios.map((s) => (
                  <li key={s.id} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${s.id === courant?.id ? 'bg-vert-50' : 'hover:bg-stone-50'}`}>
                    <button onClick={() => setSelection(s.id)} className="flex flex-1 items-center gap-3 text-left">
                      <Badge ton={s.statut === 'VALIDE' ? 'vert' : 'soleil'}>{s.statut === 'VALIDE' ? 'Validé' : 'Proposé'}</Badge>
                      <span className="flex-1 truncate">{s.nom_intrant} · {tonnes(s.quantite_t)} · {s.niveau_destination.toLowerCase()}</span>
                      <span className="text-xs text-encre-douce">{new Date(s.cree_le).toLocaleDateString('fr-FR')}</span>
                    </button>
                    {s.statut !== 'VALIDE' && (
                      <button onClick={() => supprimer.mutate(s.id)} className="rounded-lg p-1.5 text-encre-douce hover:bg-stone-100" aria-label="Supprimer">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Panneau>
          )}
          <Note>Proposition indicative : aucune donnée de réponse aux engrais par territoire n'est disponible. La quantité attribuée ne dépasse jamais le besoin calculé.</Note>
        </div>
      </div>
    </>
  )
}
