import { CloudOff, CloudRain, Sun, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EtatVide, Erreur } from '../components/ui/EtatVide'
import { EnTetePage, Indicateur, Note, Panneau, Segment, Squelette } from '../components/ui/base'
import { SelecteurAnnee, SelecteurDepartement } from '../components/ui/Selecteurs'
import { useReferentiels, useSuivi } from '../hooks/donnees'
import { useTerritoire } from '../hooks/territoire'
import { mm, nombre } from '../lib/format'
import type { LigneSuivi } from '../types/marts'

const court = (libelle: string) => libelle?.replace('septembre', 'sept.').replace('octobre', 'oct.').replace('juillet', 'juil.').replace('aout', 'août')

function InfoBulle({ active, payload }: { active?: boolean; payload?: { payload: LigneSuivi }[] }) {
  if (!active || !payload?.length) return null
  const l = payload[0].payload
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-trait">
      <div className="mb-1 font-semibold">{l.libelle_decade.replace('aout', 'août')}</div>
      <div>Observé : {mm(l.pluie_mm)}</div>
      <div>Normale : {mm(l.pluie_normale_mm)}</div>
      <div className="text-encre-douce">1 année sur 5 : {mm(l.pluie_1_annee_sur_5_mm)} · 4 sur 5 : {mm(l.pluie_4_annees_sur_5_mm)}</div>
      {l.cumul_depuis_juin_mm !== null && <div className="mt-1">Cumul : {mm(l.cumul_depuis_juin_mm)} (normale {mm(l.cumul_normale_depuis_juin_mm)})</div>}
    </div>
  )
}

export default function SuiviDecadaire() {
  const { data: ref } = useReferentiels()
  const { code, departement } = useTerritoire()
  const [annee, setAnnee] = useState<number | null>(null)
  const [vue, setVue] = useState<'decades' | 'cumul'>('decades')
  const a = annee ?? ref?.campagnes?.at(-1)
  const { data, isPending, isFetching, error, refetch } = useSuivi(code, a)

  const saison = useMemo(() => (data ?? []).filter((l) => l.est_decade_saison).map((l) => ({
    ...l, fourchette: [l.pluie_1_annee_sur_5_mm, l.pluie_4_annees_sur_5_mm], court: court(l.libelle_decade),
  })), [data])
  const fin = saison.at(-1)
  const nbSeches = saison.filter((l) => l.decade_seche).length
  const plusArrosee = saison.reduce<LigneSuivi | undefined>((m, l) => ((l.pluie_mm ?? 0) > (m?.pluie_mm ?? -1) ? l : m), undefined)

  return (
    <>
      <EnTetePage
        titre="Suivi décadaire de la pluie"
        description="Pluie de chaque décade (10 jours) de juin à octobre, comparée à la normale 1991-2020 et à la fourchette habituelle."
        actions={<><SelecteurDepartement /><SelecteurAnnee annees={ref?.campagnes} valeur={a} onChange={setAnnee} libelleAria="Année" /></>}
      />

      {error ? <Erreur erreur={error} reessayer={refetch} /> : !isPending && !data?.length ? (
        <EtatVide icone={CloudOff} titre={`Pas de suivi décadaire pour ${departement?.departement ?? 'ce département'}`}
          texte="La pluie décadaire n'est pas disponible pour ce département (Guédiawaye). Le bilan de saison reste consultable sur la carte." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {isPending || !fin ? [0, 1, 2, 3].map((i) => <Squelette key={i} className="h-[104px]" />) : (
              <>
                <Indicateur icone={CloudRain} libelle="Cumul juin-octobre" valeur={mm(fin.cumul_depuis_juin_mm)} detail={`Normale : ${mm(fin.cumul_normale_depuis_juin_mm)}`} />
                <Indicateur icone={(fin.ecart_cumul_normale_mm ?? 0) < 0 ? TrendingDown : TrendingUp} libelle="Écart du cumul"
                  valeur={nombre(fin.ecart_cumul_normale_mm, { unite: 'mm', signe: true })} ton={(fin.ecart_cumul_normale_mm ?? 0) < 0 ? 'alerte' : 'pluie'} />
                <Indicateur icone={Sun} libelle="Décades sèches (< 10 mm)" valeur={`${nbSeches} / 15`} ton={nbSeches > 4 ? 'alerte' : undefined} />
                <Indicateur libelle="Décade la plus arrosée" valeur={mm(plusArrosee?.pluie_mm)}
                  detail={plusArrosee?.libelle_decade.replace('aout', 'août')} />
              </>
            )}
          </div>

          <Panneau className="mt-4" titre={vue === 'decades' ? 'Pluie par décade' : 'Cumul depuis le 1er juin'}
            sousTitre={vue === 'decades' ? 'Barres : observé · zone : fourchette 1 année sur 5 à 4 années sur 5 · trait : normale' : 'Observé et normale cumulés'}
            action={<Segment options={[{ valeur: 'decades', libelle: 'Décades' }, { valeur: 'cumul', libelle: 'Cumul' }]} valeur={vue} onChange={setVue} libelle="Vue" />}>
            {isPending ? <Squelette className="h-80" /> : (
              <div className={`h-80 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
                <ResponsiveContainer>
                  <ComposedChart data={saison} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#ece8de" />
                    <XAxis dataKey="court" tickLine={false} axisLine={false} fontSize={10} interval={vue === 'decades' ? 1 : 2} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} unit=" mm" width={64} />
                    <Tooltip content={<InfoBulle />} cursor={{ fill: '#f2efe6' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-encre-douce">{v}</span>} />
                    {vue === 'decades' ? (
                      <>
                        <Area dataKey="fourchette" name="Fourchette habituelle" fill="#dcecf8" stroke="none" isAnimationActive={false} />
                        <Bar dataKey="pluie_mm" name="Observé" fill="#2d7fc1" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                        <Line dataKey="pluie_normale_mm" name="Normale" stroke="#1d2a22" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                      </>
                    ) : (
                      <>
                        <Line dataKey="cumul_normale_depuis_juin_mm" name="Normale cumulée" stroke="#1d2a22" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                        <Line dataKey="cumul_depuis_juin_mm" name="Observé cumulé" stroke="#2d7fc1" strokeWidth={2.5} dot={{ r: 2.5 }} isAnimationActive={false} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panneau>
          <div className="mt-3">
            <Note>Le bilan officiel d'une saison est sur la carte agroclimatique : il est calculé autrement et peut différer de quelques millimètres du cumul des décades.</Note>
          </div>
        </>
      )}
    </>
  )
}
