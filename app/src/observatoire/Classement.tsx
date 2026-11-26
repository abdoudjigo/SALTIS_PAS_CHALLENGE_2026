// Classement des départements : barres horizontales, 10 premiers puis tous ; progression sur 10 ans.
// Survoler ou parcourir une ligne au clavier allume le département sur la carte ; la choisir filtre la page.
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useState, type Ref } from 'react'
import { nombre } from '../lib/format'
import { COULEURS, dateTexte, pctTexte } from './outils'
import { LIBELLES, type ClassementObs, type Indicateur, type MetaObs } from './types'

export function Classement({ lignes, meta, indicateur, unite, annee, zone, choisir, allumer, refBloc }: {
  lignes: ClassementObs[] | null | undefined
  meta: MetaObs | undefined
  indicateur: Indicateur
  unite: string
  annee: number
  zone: string
  choisir: (code: string) => void
  allumer: (code: string | null) => void
  refBloc: Ref<HTMLElement>
}) {
  const [tout, setTout] = useState(false)
  const liste = lignes ?? []
  const max = Math.max(1, ...liste.map((l) => l.valeur))
  const visibles = tout ? liste : liste.slice(0, 10)

  return (
    <section ref={refBloc} aria-labelledby="obs-titre-classement" className="obs-carte obs-entree space-y-3 p-5">
      <h2 id="obs-titre-classement" className="text-xl font-semibold">Classement : {LIBELLES[indicateur].toLocaleLowerCase('fr-FR')} {annee}</h2>
      {lignes === undefined ? <div aria-busy className="h-64 animate-pulse rounded-xl obs-fond" />
        : liste.length === 0 ? <p className="text-sm obs-doux">Aucun département n'a de donnée pour cette année.</p>
        : (
          <ol className="space-y-1" onMouseLeave={() => allumer(null)}>
            {visibles.map((l) => {
              const p = l.progression_10_ans_pct
              const Fleche = p !== null && p < 0 ? ArrowDownRight : ArrowUpRight
              const progression = p === null
                ? `progression sur 10 ans non disponible`
                : `${pctTexte(p)} depuis ${l.annee_comparaison}${l.rupture_type_superficie ? ' (définition de la superficie changée en 2016)' : ''}`
              return (
                <li key={l.code_departement}>
                  <button type="button" onClick={() => choisir(l.code_departement)} onMouseEnter={() => allumer(l.code_departement)}
                    onFocus={() => allumer(l.code_departement)} onBlur={() => allumer(null)} aria-pressed={zone === l.code_departement}
                    aria-label={`${l.rang}. ${l.departement} : ${nombre(l.valeur, { unite })}${l.est_complet === false ? ', incomplet' : ''} ; ${progression}`}
                    className="grid w-full grid-cols-[1.75rem_minmax(0,8rem)_1fr] items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-[#F3F6F9] sm:grid-cols-[1.75rem_9rem_1fr_7.5rem]">
                    <span className="tabular-nums obs-doux">{l.rang}</span>
                    <span className="truncate font-medium" style={{ color: zone === l.code_departement ? COULEURS.orTexte : COULEURS.marine }}>{l.departement}</span>
                    <span className="flex items-center gap-2">
                      <span className="h-3 flex-1 rounded-full obs-fond">
                        <span className="obs-barre block h-3 rounded-full" style={{ transform: `scaleX(${l.valeur / max})`, background: COULEURS.bleu }} />
                      </span>
                      <span className="w-24 shrink-0 text-right tabular-nums">{nombre(l.valeur, { unite })}</span>
                    </span>
                    <span className={`col-start-3 flex items-center gap-1 text-xs sm:col-start-auto ${p === null ? 'obs-doux' : p < 0 ? 'obs-or' : 'obs-bleu'}`}>
                      {p !== null && <Fleche className="size-3.5" aria-hidden />}
                      {p === null ? '10 ans : n. d.' : `${pctTexte(p)} / 10 ans${l.rupture_type_superficie ? '*' : ''}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      {liste.length > 10 && (
        <button type="button" className="obs-bouton" aria-expanded={tout} onClick={() => setTout((t) => !t)}>
          {tout ? 'Voir les 10 premiers' : `Voir les ${liste.length} départements classés`}
        </button>
      )}
      {liste.some((l) => l.rupture_type_superficie) && (
        <p className="text-xs obs-doux">* La comparaison traverse 2016 : superficie récoltée avant, semée après.</p>
      )}
      <p className="text-xs obs-doux">
        Seuls les départements avec une valeur sont classés. Source : {[...new Set(liste.map((l) => l.source).filter(Boolean))].join(' ; ') || 'non disponible'}.
        {' '}Table {meta?.source ?? 'non disponible'}, données du {dateTexte(meta?.genere_le)}.
      </p>
    </section>
  )
}
