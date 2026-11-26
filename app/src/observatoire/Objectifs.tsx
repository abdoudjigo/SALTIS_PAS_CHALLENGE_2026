// Objectifs de l'État (SSA 2025-2034, LPSAE 2025-2029) : jauges « référence → cible », avec document et page.
// Seuls les objectifs servis par l'API sont montrés ; deux documents en désaccord : les deux valeurs.
import type { Ref } from 'react'
import { nombre } from '../lib/format'
import type { MetaObs, ObjectifObs, ObjectifsObs } from './types'
import { dateTexte } from './outils'

const SANS_OBJECTIF = "Pas d'objectif chiffré dans la SSA 2025-2034"

const page = (o: ObjectifObs) => `${o.document}, p. ${o.page}`
const val = (v: number, unite: string | null) => nombre(v, { decimales: 1, unite: unite ?? '' })

function Jauge({ o }: { o: ObjectifObs }) {
  const ref = o.valeur_reference!
  const cible = o.cible!
  // Échelle : 0 à 100 pour un pourcentage, sinon 0 à la cible
  const max = o.unite === '%' ? 100 : cible
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`
  const libelle = `${o.libelle} : référence ${val(ref, o.unite)}${o.annee_reference ? ` (${o.annee_reference})` : ''}, cible ${val(cible, o.unite)}${o.annee_cible ? ` en ${o.annee_cible}` : ''}`
  return (
    <li className="space-y-2">
      <p className="text-sm font-semibold" style={{ color: 'var(--obs-marine)' }}>{o.libelle}</p>
      <div role="img" aria-label={libelle} className="relative h-3 rounded-full obs-fond">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pos(ref), background: 'var(--obs-bleu)' }} />
        <div className="absolute -inset-y-1 w-1 rounded" style={{ left: `calc(${pos(cible)} - 2px)`, background: 'var(--obs-or)' }} />
      </div>
      <p className="flex flex-wrap justify-between gap-x-3 text-sm">
        <span className="obs-bleu">Référence : {val(ref, o.unite)}{o.annee_reference ? ` (${o.annee_reference})` : ' (année non précisée)'}</span>
        <span className="obs-or font-semibold">Cible : {val(cible, o.unite)}{o.annee_cible ? ` en ${o.annee_cible}` : ' (échéance non précisée)'}</span>
      </p>
      <p className="text-xs obs-doux">{page(o)}{o.note ? ` · ${o.note}` : ''}</p>
    </li>
  )
}

export function Objectifs({ reponse, meta, culture, refBloc }: {
  reponse: ObjectifsObs | null | undefined
  meta: MetaObs | undefined
  /** nom de la culture choisie, tel que servi par l'API (« MIL (SOUNA) ») */
  culture: string
  refBloc: Ref<HTMLElement>
}) {
  if (reponse === undefined) return <section ref={refBloc} aria-busy aria-label="Objectifs de l'État" className="obs-carte h-48 animate-pulse" />
  const objectifs = reponse?.objectifs ?? []
  const controle = objectifs.find((o) => o.indicateur === 'evaluation_mi_parcours' && o.annee_cible)
  const chiffres = objectifs.filter((o) => !o.indicateur.startsWith('evaluation_'))
  const jauges = chiffres.filter((o) => o.valeur_reference !== null && o.cible !== null)
  const autres = chiffres.filter((o) => !jauges.includes(o) && o.cible !== null)

  // Désaccords : même indicateur et même périmètre, valeurs différentes selon le document
  const groupes = new Map<string, ObjectifObs[]>()
  for (const o of jauges) groupes.set(`${o.indicateur}|${o.culture}`, [...(groupes.get(`${o.indicateur}|${o.culture}`) ?? []), o])

  return (
    <section ref={refBloc} aria-labelledby="obs-titre-objectifs" className="obs-carte obs-entree space-y-4 p-5">
      <h2 id="obs-titre-objectifs" className="text-xl font-semibold">Objectifs de l'État</h2>
      {chiffres.length === 0 ? (
        <p className="text-sm obs-doux">{reponse?.message ?? SANS_OBJECTIF}</p>
      ) : (
        <>
          <ul className="space-y-5">
            {[...groupes.values()].map((g) => (
              <li key={`${g[0].indicateur}|${g[0].culture}`} className="list-none">
                {g.length > 1 && <p className="mb-1 text-xs font-semibold obs-or">Les documents se contredisent : les {g.length} valeurs sont affichées.</p>}
                {g[0].cultures_concernees.includes(culture) && <span className="obs-badge mb-1">Concerne la culture choisie</span>}
                <ul className="space-y-4">{g.map((o) => <Jauge key={page(o)} o={o} />)}</ul>
              </li>
            ))}
          </ul>
          {autres.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold">Autres cibles chiffrées</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {autres.map((o) => (
                  <li key={`${o.indicateur}|${o.culture}|${o.document}`}>
                    {o.libelle}{o.culture && o.portee !== 'national' ? ` (${o.culture.toLocaleLowerCase('fr-FR')})` : ''} : {val(o.cible!, o.unite)}
                    {o.annee_cible ? ` en ${o.annee_cible}` : ''} <span className="obs-doux">· {page(o)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {controle && (
        <p className="rounded-xl p-3 text-sm obs-fond">
          Prochain point de contrôle : revue à mi-parcours en {controle.annee_cible} <span className="obs-doux">({page(controle)})</span>
        </p>
      )}
      <p className="text-xs obs-doux">Source : {meta?.source ?? 'non disponible'} · données du {dateTexte(meta?.genere_le)}</p>
    </section>
  )
}
