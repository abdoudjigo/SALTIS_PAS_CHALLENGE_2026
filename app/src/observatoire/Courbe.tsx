// Courbe longue 1981 → dernière année : somme des départements (DAPSA), rendement national FAOSTAT (série à part),
// chiffres officiels (losanges or) et référence SSA du rendement (pointillé fin, étiquetée).
// Règles : null = trou (jamais 0, jamais relié) ; rupture 2016 (superficie récoltée → semée) visible ;
// ligne verticale « Nos données par département s'arrêtent en 2021 ». Aucune prévision.
import type { Ref } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { nombre } from '../lib/format'
import { COULEURS, dateTexte, texteIncomplet, useMouvementReduit, valeurTexte } from './outils'
import { LIBELLES, type Indicateur, type MetaObs, type PointOfficiel, type SerieObs } from './types'

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })

interface Ligne {
  annee: number
  continu?: number | null
  avant?: number | null
  apres?: number | null
  faostat?: number | null
  off1?: number | null
  off2?: number | null
}

function Losange(props: { cx?: number; cy?: number; value?: unknown; index?: number }) {
  const { cx, cy, value } = props
  if (cx === undefined || cy === undefined || value === null || value === undefined) return <g />
  return <path d={`M${cx} ${cy - 7}L${cx + 7} ${cy}L${cx} ${cy + 7}L${cx - 7} ${cy}Z`} fill={COULEURS.or} stroke="#fff" strokeWidth={1.5} />
}

function Bulle({ annee, serie, faostat, officiels }: { annee: number; serie: SerieObs; faostat: Map<number, number | null>; officiels: PointOfficiel[] }) {
  const p = serie.points.find((x) => x.annee === annee)
  const fao = faostat.get(annee)
  const offs = officiels.filter((o) => o.annee === annee)
  const incomplet = p && texteIncomplet(p)
  return (
    <div className="max-w-xs rounded-xl border bg-white p-3 text-xs shadow-lg" style={{ borderColor: 'var(--obs-trait)' }}>
      <p className="text-sm font-semibold" style={{ color: COULEURS.marine }}>{annee}</p>
      {p && (
        <p className="mt-1">
          Somme des départements : <strong>{valeurTexte(p.valeur, serie.indicateur, serie.unite)}</strong>
          {incomplet && <span className="obs-or"> · {incomplet}</span>}
          {p.type_superficie && <span className="obs-doux"> · superficie {p.type_superficie}</span>}
          <span className="block obs-doux">Source : {p.source ?? 'non disponible'}{p.note ? ` · ${p.note}` : ''}</span>
        </p>
      )}
      {fao !== undefined && (
        <p className="mt-1">Rendement national FAOSTAT : <strong>{valeurTexte(fao, 'rendement', 'kg/ha')}</strong><span className="block obs-doux">Source : FAOSTAT (série distincte)</span></p>
      )}
      {offs.length > 0 && (
        <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--obs-trait)' }}>
          <p className="font-semibold obs-or">Chiffre officiel LPSAE/SSA</p>
          {offs.length > 1 && <p className="obs-or">Les documents se contredisent : les {offs.length} valeurs sont affichées.</p>}
          {offs.map((o) => (
            <p key={`${o.document}${o.page}`} className="mt-0.5">
              <strong>{nombre(o.valeur, { unite: o.unite ?? '' })}</strong> · {o.document}, p. {o.page}
              {o.note && <span className="block obs-doux">{o.note}</span>}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export function Courbe({ serie, meta, indicateur, changerIndicateur, derniereAnnee, refBloc, sansTotal }: {
  serie: SerieObs | null | undefined
  meta: MetaObs | undefined
  indicateur: Indicateur
  changerIndicateur: (i: Indicateur) => void
  /** dernière année proposée par /filtres (FAOSTAT compris) */
  derniereAnnee: number
  refBloc: Ref<HTMLElement>
  sansTotal: string | null
}) {
  const reduit = useMouvementReduit()
  const rupture = serie?.rupture_type_superficie ?? null
  const coupe = indicateur !== 'production' && rupture !== null
  const faostat = new Map((serie?.serie_faostat ?? []).map((f) => [f.annee, f.rendement_kg_ha]))
  // Points officiels traçables : même unité que la série et année connue ; les autres sont listés sous la courbe
  const officiels = (serie?.points_officiels ?? []).filter((o) => o.annee !== null && o.unite === serie?.unite)
  const horsCourbe = (serie?.points_officiels ?? []).filter((o) => !officiels.includes(o))
  const debut = serie?.points[0]?.annee ?? 1981
  const ref = serie?.reference_rendement ?? null

  const lignes: Ligne[] = []
  for (let a = debut; a <= derniereAnnee; a++) {
    const v = serie?.points.find((p) => p.annee === a)?.valeur ?? null
    const offs = officiels.filter((o) => o.annee === a)
    lignes.push({
      annee: a,
      ...(coupe ? { avant: a < rupture! ? v : null, apres: a >= rupture! ? v : null } : { continu: v }),
      faostat: faostat.get(a) ?? null,
      off1: offs[0]?.valeur ?? null,
      off2: offs[1]?.valeur ?? null,
    })
  }
  const sources = [...new Set((serie?.points ?? []).map((p) => p.source).filter(Boolean))]
  const anim = { isAnimationActive: !reduit, animationDuration: 300 }
  const titre = serie ? `${LIBELLES[indicateur]} (${serie.unite}), ${serie.zone}, ${debut} → ${derniereAnnee}` : LIBELLES[indicateur]

  return (
    <section ref={refBloc} aria-labelledby="obs-titre-courbe" className="obs-carte obs-entree space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="obs-titre-courbe" className="text-xl font-semibold">{titre}</h2>
        <div role="group" aria-label="Indicateur de la courbe, de la carte et du classement" className="flex gap-1.5">
          {(['production', 'surface', 'rendement'] as Indicateur[]).map((i) => (
            <button key={i} type="button" className="obs-bouton" aria-pressed={i === indicateur} onClick={() => changerIndicateur(i)}>{LIBELLES[i]}</button>
          ))}
        </div>
      </div>

      {sansTotal ? <p className="text-sm obs-doux">{sansTotal}</p>
        : serie === null ? <p className="text-sm obs-doux">Pas de donnée pour cette culture dans cette zone.</p>
        : !serie ? <div aria-busy className="h-80 animate-pulse rounded-xl obs-fond" />
        : (
          <>
            <div className="h-80" role="img" aria-label={`Courbe : ${titre}. Le tableau des valeurs est disponible sous la courbe.`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lignes} margin={{ top: 28, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid stroke="#E3E9EF" vertical={false} />
                  <XAxis dataKey="annee" type="number" domain={[debut, derniereAnnee]} tick={{ fontSize: 11, fill: COULEURS.gris }} tickCount={9} allowDecimals={false} />
                  <YAxis tick={{ fontSize: 11, fill: COULEURS.gris }} tickFormatter={(v: number) => compact.format(v)} width={48} />
                  <Tooltip content={({ active, label }) => (active && typeof label === 'number' ? <Bulle annee={label} serie={serie} faostat={faostat} officiels={officiels} /> : null)} />
                  {coupe && rupture !== null && (
                    <ReferenceLine x={rupture - 0.5} stroke={COULEURS.gris} strokeWidth={1}
                      label={{ value: `${rupture} : superficie semée`, position: 'insideTopLeft', fontSize: 10, fill: COULEURS.gris }} />
                  )}
                  <ReferenceLine x={serie.derniere_annee_departements + 0.5} stroke={COULEURS.marine} strokeWidth={1.5}
                    label={{ value: serie.mention_arret, position: 'top', fontSize: 11, fill: COULEURS.marine }} />
                  {ref && (
                    <ReferenceLine y={ref.valeur} stroke={COULEURS.or} strokeDasharray="2 3" strokeWidth={1}
                      label={{ value: 'référence indiquée par la SSA, origine non précisée', position: 'insideBottomLeft', fontSize: 10, fill: COULEURS.orTexte }} />
                  )}
                  {coupe ? (
                    <>
                      <Line dataKey="avant" name="Somme des départements (superficie récoltée)" stroke={COULEURS.marine} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} {...anim} />
                      <Line dataKey="apres" name="Somme des départements (superficie semée)" stroke={COULEURS.bleu} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} {...anim} />
                    </>
                  ) : (
                    <Line dataKey="continu" name="Somme des départements" stroke={COULEURS.marine} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} {...anim} />
                  )}
                  {faostat.size > 0 && (
                    <Line dataKey="faostat" name="Rendement national FAOSTAT" stroke={COULEURS.gris} strokeWidth={1.5} dot={{ r: 1.5 }} connectNulls={false} {...anim} />
                  )}
                  {officiels.length > 0 && <Line dataKey="off1" name="Chiffre officiel" stroke="none" dot={<Losange />} activeDot={false} isAnimationActive={false} />}
                  {officiels.length > 0 && <Line dataKey="off2" name="Chiffre officiel (autre document)" stroke="none" dot={<Losange />} activeDot={false} isAnimationActive={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Légende en texte */}
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs" aria-label="Légende">
              <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-5" style={{ background: COULEURS.marine }} />Somme des départements (DAPSA){coupe ? ', superficie récoltée' : ''}</li>
              {coupe && <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-5" style={{ background: COULEURS.bleu }} />Depuis {rupture} : superficie semée, rendement non comparable à la période d'avant</li>}
              {faostat.size > 0 && <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-5" style={{ background: COULEURS.gris }} />Rendement national FAOSTAT (série distincte, jamais mélangée)</li>}
              {officiels.length > 0 && <li className="flex items-center gap-1.5"><span aria-hidden style={{ color: COULEURS.or }}>◆</span>Chiffre officiel LPSAE/SSA (survol : document et page)</li>}
              {ref && <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block w-5 border-t border-dotted" style={{ borderColor: COULEURS.or }} />{nombre(ref.valeur, { unite: ref.unite ?? '' })} : référence indiquée par la SSA, origine non précisée</li>}
              <li className="obs-doux">Trou dans la courbe = année non disponible (jamais remplacée par 0).</li>
            </ul>

            {(ref || horsCourbe.length > 0) && (
              <ul className="space-y-1 text-xs obs-doux">
                {ref && <li>Ligne de référence : {ref.document}, p. {ref.page}. {ref.note}</li>}
                {horsCourbe.map((o) => (
                  <li key={`${o.indicateur}${o.document}${o.page}${o.valeur}`}>
                    Valeur citée : {nombre(o.valeur, { unite: o.unite ?? '' })}{o.annee ? ` (${o.annee})` : ' (année non précisée)'} · {o.document}, p. {o.page}{o.note ? ` · ${o.note}` : ''}
                  </li>
                ))}
              </ul>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer font-medium" style={{ color: COULEURS.bleu }}>Voir les valeurs en tableau</summary>
              <div className="mt-2 max-h-72 overflow-auto">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">{titre}</caption>
                  <thead><tr><th scope="col" className="py-1">Année</th><th scope="col">Somme des départements</th><th scope="col">Couverture</th>{faostat.size > 0 && <th scope="col">FAOSTAT</th>}</tr></thead>
                  <tbody>
                    {lignes.map((l) => {
                      const p = serie.points.find((x) => x.annee === l.annee)
                      return (
                        <tr key={l.annee} className="border-t" style={{ borderColor: 'var(--obs-trait)' }}>
                          <th scope="row" className="py-1 font-normal">{l.annee}</th>
                          <td>{valeurTexte(p?.valeur ?? null, serie.indicateur, serie.unite)}</td>
                          <td>{p ? (texteIncomplet(p) ?? 'complet') : 'non disponible'}</td>
                          {faostat.size > 0 && <td>{valeurTexte(l.faostat ?? null, 'rendement', 'kg/ha')}</td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </details>

            <p className="text-xs obs-doux">
              Source : {sources.length ? sources.join(' ; ') : 'non disponible'}{faostat.size > 0 ? ' ; FAOSTAT' : ''}{officiels.length ? ' ; LPSAE 2025-2029 et SSA 2025-2034' : ''}.
              {' '}Table {meta?.source ?? 'non disponible'}, données du {dateTexte(meta?.genere_le)}.
            </p>
          </>
        )}
    </section>
  )
}
