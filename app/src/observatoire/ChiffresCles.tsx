// Quatre chiffres clés : production, superficie, rendement, puis rang (ou part nationale) ; au pays, le rendement
// national FAOSTAT (série distincte). Valeur manquante : « Non disponible · dernière donnée : {année} ».
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { Ref } from 'react'
import { nombre } from '../lib/format'
import { pctTexte, texteIncomplet, useCompteur } from './outils'
import type { IndicateurZone, IndicateursObs, MetaObs } from './types'

function Compteur({ valeur, unite }: { valeur: number; unite: string }) {
  const v = useCompteur(valeur)
  return (
    <>
      {/* Le nombre qui défile est masqué aux lecteurs d'écran : ils lisent la valeur finale */}
      <span aria-hidden>{nombre(v, { unite })}</span>
      <span className="sr-only">{nombre(valeur, { unite })}</span>
    </>
  )
}

function Variation({ v, libelle, prudence }: { v: number | null; libelle: string; prudence?: string | null }) {
  if (v === null) return <p className="text-sm obs-doux">{libelle} : non disponible</p>
  const hausse = v >= 0
  const Icone = hausse ? ArrowUpRight : ArrowDownRight
  return (
    <p className={`flex flex-wrap items-center gap-1 text-sm font-medium ${hausse ? 'obs-bleu' : 'obs-or'}`}>
      <Icone className="size-4" aria-hidden />
      {pctTexte(v, 1)} {libelle}
      {prudence && <span className="w-full text-xs font-normal obs-doux">{prudence}</span>}
    </p>
  )
}

function Carte({ titre, children, source, badge }: { titre: string; children: React.ReactNode; source: string | null; badge?: string | null }) {
  return (
    <div className="obs-carte obs-entree flex flex-col gap-2 p-4 sm:p-5 lg:col-span-3" title={source ? `Source : ${source}` : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{titre}</h3>
        {badge && <span className="obs-badge">{badge}</span>}
      </div>
      {children}
      {source && <p className="mt-auto text-xs obs-doux">Source : {source}</p>}
    </div>
  )
}

function Valeur({ i, annee }: { i: IndicateurZone | undefined; annee: number }) {
  if (!i || i.valeur === null) {
    const derniere = i?.derniere_annee_disponible
    return (
      <div>
        <p className="text-2xl font-semibold obs-doux">Non disponible{derniere ? ` · dernière donnée : ${derniere}` : ''}</p>
        {i?.note && <p className="mt-1 text-xs obs-doux">{i.note}</p>}
        {!derniere && <p className="mt-1 text-xs obs-doux">Aucune donnée jusqu'en {annee}.</p>}
      </div>
    )
  }
  return <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--obs-marine)' }}><Compteur valeur={i.valeur} unite={i.unite} /></p>
}

export function ChiffresCles({ reponse, meta, refBloc, sansTotal }: {
  reponse: IndicateursObs | null | undefined
  meta: MetaObs | undefined
  refBloc: Ref<HTMLElement>
  /** Culture sans total pour la zone (sésame au pays) : message au lieu des chiffres */
  sansTotal: string | null
}) {
  if (sansTotal) {
    return <section ref={refBloc} aria-label="Chiffres clés" className="obs-carte p-5 text-sm obs-doux">{sansTotal}</section>
  }
  if (reponse === null) {
    return <section ref={refBloc} aria-label="Chiffres clés" className="obs-carte p-5 text-sm obs-doux">Pas de donnée pour cette culture dans cette zone.</section>
  }
  if (!reponse) return <section ref={refBloc} aria-label="Chiffres clés" aria-busy className="h-40 animate-pulse rounded-2xl obs-fond" />

  const de = (k: string) => reponse.indicateurs.find((x) => x.indicateur === k)
  const prod = de('production')
  const surf = de('surface')
  const rdt = de('rendement')
  const prudence = (i?: IndicateurZone) => (i?.comparable_n1 === false ? 'Comparaison indicative : couverture ou définition différente d’une année à l’autre.' : null)
  const source = (i?: IndicateurZone) => i?.source ?? meta?.source ?? null
  const fao = reponse.rendement_faostat

  return (
    <section ref={refBloc} aria-label="Chiffres clés" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
      <Carte titre="Production" source={source(prod)} badge={prod && texteIncomplet(prod)}>
        <Valeur i={prod} annee={reponse.annee} />
        {prod?.valeur !== null && <Variation v={prod?.variation_n1_pct ?? null} libelle={`par rapport à ${reponse.annee - 1}`} prudence={prudence(prod)} />}
      </Carte>
      <Carte titre="Superficie" source={source(surf)} badge={surf && texteIncomplet(surf)}>
        <Valeur i={surf} annee={reponse.annee} />
        {surf?.valeur !== null && surf?.type_superficie && <p className="text-sm obs-doux">Superficie {surf.type_superficie}</p>}
      </Carte>
      <Carte titre="Rendement" source={source(rdt)} badge={rdt && texteIncomplet(rdt)}>
        <Valeur i={rdt} annee={reponse.annee} />
        {rdt?.valeur !== null && (
          <Variation v={rdt?.ecart_moyenne_10_ans_pct ?? null} libelle={`par rapport à la moyenne des ${rdt?.nb_annees_moyenne ?? 10} années précédentes`} />
        )}
      </Carte>
      {reponse.niveau === 'PAYS' ? (
        <Carte titre="Rendement national FAOSTAT" source={fao ? 'FAOSTAT (série distincte des sommes de départements)' : 'FAOSTAT'}>
          {fao && fao.rendement_kg_ha !== null
            ? <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--obs-marine)' }}><Compteur valeur={fao.rendement_kg_ha} unite="kg/ha" /></p>
            : <p className="text-2xl font-semibold obs-doux">Non disponible</p>}
          {fao && fao.rendement_kg_ha !== null && <Variation v={fao.variation_n1_pct} libelle={`par rapport à ${reponse.annee - 1}`} />}
          <p className="text-xs obs-doux">Jamais additionné ni mélangé aux sommes des départements.</p>
        </Carte>
      ) : (
        <Carte titre={reponse.niveau === 'REGION' ? 'Rang parmi les régions' : 'Rang parmi les départements'} source={source(prod)}>
          {prod?.rang !== null && prod?.rang !== undefined && prod.nb_classes !== null
            ? <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--obs-marine)' }}>{prod.rang === 1 ? '1er' : `${prod.rang}e`}<span className="text-lg obs-doux"> sur {prod.nb_classes}</span></p>
            : <p className="text-2xl font-semibold obs-doux">Non disponible</p>}
          <p className="text-sm obs-doux">
            Production ; part nationale : {prod?.part_nationale_pct !== null && prod?.part_nationale_pct !== undefined ? nombre(prod.part_nationale_pct, { decimales: 1, unite: '%' }) : 'non disponible'}
          </p>
        </Carte>
      )}
    </section>
  )
}
