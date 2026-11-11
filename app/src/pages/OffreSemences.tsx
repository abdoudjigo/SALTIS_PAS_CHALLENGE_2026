// Associations de producteurs de semences (option B de docs/etat-modelisation.md, cible à confirmer) :
// elles déclarent leur offre de variétés et voient où ces variétés sont adaptées. Pas de scénario de répartition.
import { Loader2, Plus, Save, Trash2, Wheat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { EtatVide, Erreur } from '../components/ui/EtatVide'
import { Badge, BadgeAdequation, EnTetePage, Note, Panneau, Squelette } from '../components/ui/base'
import { SelectNatif } from '../components/ui/Selecteurs'
import { config } from '../config'
import { useAdequationVarietes, useEnregistrerOffreSemences, useOffreSemences, useReferentiels } from '../hooks/donnees'
import { libelle, nombre, pct, tonnes } from '../lib/format'
import type { LigneChoixCulture, NiveauAdequation, OffreSemence } from '../types/marts'

const ORDRE: NiveauAdequation[] = ['adaptée', 'à risque', 'déconseillée', 'irrigation requise']

function Offre() {
  const { data: ref } = useReferentiels()
  const { data: offre, isPending } = useOffreSemences()
  const enregistrer = useEnregistrerOffreSemences()
  const [brouillon, setBrouillon] = useState<OffreSemence[] | null>(null)
  const lignes = brouillon ?? offre ?? []
  const varietes = ref?.varietes ?? []
  const maj = (i: number, modif: Partial<OffreSemence>) => setBrouillon(lignes.map((l, j) => (j === i ? { ...l, ...modif } : l)))
  const total = lignes.reduce((a, l) => a + (l.quantite_t ?? 0), 0)

  return (
    <Panneau titre="Semences disponibles" sousTitre={`Campagne ${config.campagneParDefaut} · ${tonnes(total)} déclarées`}
      action={brouillon && (
        <button onClick={() => enregistrer.mutate(lignes.filter((l) => (l.quantite_t ?? 0) > 0), { onSuccess: () => setBrouillon(null) })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-vert-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-vert-900">
          {enregistrer.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Enregistrer
        </button>
      )}>
      {isPending ? <Squelette className="h-24" /> : (
        <div className="space-y-2">
          {lignes.length === 0 && <p className="text-sm text-encre-douce">Aucune semence déclarée.</p>}
          {lignes.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <SelectNatif className="flex-1" aria-label="Variété" value={l.variete}
                onChange={(e) => {
                  const v = varietes.find((x) => x.variete === e.target.value)
                  if (v) maj(i, { variete: v.variete, culture: v.culture })
                }}>
                {varietes.map((v) => <option key={v.variete} value={v.variete}>{v.variete} — {libelle(v.culture)}</option>)}
              </SelectNatif>
              <input type="number" min="0" step="0.1" className="champ w-24 py-2 text-right" aria-label="Quantité en tonnes"
                value={l.quantite_t ?? ''} onChange={(e) => maj(i, { quantite_t: e.target.value === '' ? null : Number(e.target.value) })} />
              <span className="text-xs text-encre-douce">t</span>
              <button onClick={() => setBrouillon(lignes.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-encre-douce hover:bg-stone-100" aria-label="Retirer">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {varietes.length > 0 && (
            <button onClick={() => setBrouillon([...lignes, { variete: varietes[0].variete, culture: varietes[0].culture, quantite_t: null, campagne: config.campagneParDefaut, zones_couvertes: [] }])}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-vert-700 hover:underline">
              <Plus className="size-4" /> Ajouter une variété
            </button>
          )}
        </div>
      )}
    </Panneau>
  )
}

function Adequation({ lignes }: { lignes: LigneChoixCulture[] }) {
  const parVariete = useMemo(() => {
    const m = new Map<string, LigneChoixCulture[]>()
    lignes.forEach((l) => m.set(l.option, [...(m.get(l.option) ?? []), l]))
    return [...m.entries()]
  }, [lignes])

  return (
    <div className="space-y-4">
      {parVariete.map(([variete, ls]) => {
        const v = ls[0]
        const adaptes = ls.filter((l) => l.niveau_adequation === 'adaptée')
        const parZone = new Map<string, LigneChoixCulture[]>()
        adaptes.forEach((l) => parZone.set(l.zone_agroecologique, [...(parZone.get(l.zone_agroecologique) ?? []), l]))
        const decompte = ORDRE.map((n) => [n, ls.filter((l) => l.niveau_adequation === n).length] as const).filter(([, k]) => k > 0)
        return (
          <Panneau key={variete} titre={variete}
            sousTitre={`${libelle(v.culture)} · cycle ${nombre(v.cycle_jours)} j · tolérance sécheresse ${v.tolerance_secheresse ?? '—'}`}
            action={<div className="flex flex-wrap justify-end gap-1">{decompte.map(([n, k]) => <span key={n} className="inline-flex items-center gap-1"><BadgeAdequation niveau={n} /><span className="text-xs text-encre-douce">{k}</span></span>)}</div>}>
            {v.niveau_adequation === 'irrigation requise' ? (
              <p className="text-sm text-encre-douce">Variété irriguée : son adéquation dépend de l'accès à l'eau, pas de la saison des pluies.</p>
            ) : adaptes.length === 0 ? (
              <p className="text-sm text-encre-douce">Adaptée dans aucun département (part des années où la saison couvre le cycle inférieure à 80 %).</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-encre-douce">Départements où la saison couvre le cycle au moins 80 % des années (1991-2020) :</p>
                <ul className="space-y-2">
                  {[...parZone.entries()].map(([zone, deps]) => (
                    <li key={zone}>
                      <div className="text-xs font-medium tracking-wide text-encre-douce uppercase">{libelle(zone)}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {deps.sort((a, b) => b.proba_cycle_couvert_pct! - a.proba_cycle_couvert_pct!).map((d) => (
                          <Badge key={d.code_departement} ton="vert">{d.departement} · {pct(d.proba_cycle_couvert_pct)}</Badge>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panneau>
        )
      })}
    </div>
  )
}

export default function OffreSemences() {
  const { user } = useAuth()
  const { data, isPending, error, refetch } = useAdequationVarietes()

  return (
    <>
      <EnTetePage titre="Offre de semences"
        description={`Variétés disponibles chez ${user?.organisation?.nom ?? 'votre association'} et départements où elles sont adaptées à la saison des pluies.`} />
      <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <div className="space-y-4">
          <Offre />
          <Note>Votre offre sera rapprochée des besoins en semences des départements. Les variétés évaluées sont celles dont le cycle est documenté ; le mil souna (cycle inconnu) peut être déclaré mais n'a pas encore d'adéquation.</Note>
        </div>
        {error ? <Erreur erreur={error} reessayer={refetch} /> : isPending ? <Squelette className="h-96" /> : data?.length ? (
          <Adequation lignes={data} />
        ) : (
          <div className="carte"><EtatVide icone={Wheat} titre="Aucune variété évaluée" /></div>
        )}
      </div>
    </>
  )
}
