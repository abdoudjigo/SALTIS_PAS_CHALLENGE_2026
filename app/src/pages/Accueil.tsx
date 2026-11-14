import { ArrowRight, CalendarRange, CloudRain, Droplets, ShieldAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../auth/AuthContext'
import { peutAcceder } from '../auth/roles'
import { NAVIGATION } from '../components/layout/navigation'
import { Erreur } from '../components/ui/EtatVide'
import { BadgeRisque, EnTetePage, Indicateur, Panneau, Squelette } from '../components/ui/base'
import { SelecteurDepartement } from '../components/ui/Selecteurs'
import { useHistorique } from '../hooks/donnees'
import { useTerritoire } from '../hooks/territoire'
import { jourEnDate, mm, nombre, pct } from '../lib/format'
import type { LigneCarte } from '../types/marts'

function InfoBulle({ active, payload }: { active?: boolean; payload?: { payload: LigneCarte }[] }) {
  if (!active || !payload?.length) return null
  const l = payload[0].payload
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-trait">
      <div className="font-semibold">Campagne {l.campagne_agricole}</div>
      <div>{mm(l.pluie_saison_mm)} · {pct(l.anomalie_pluie_saison_pct)} / normale</div>
      <div className="text-encre-douce">Saison {l.classe_saison}</div>
    </div>
  )
}

const couleurBarre = (anomalie: number | null) =>
  anomalie === null ? '#c9c4b8' : anomalie < -10 ? '#b7793f' : anomalie > 10 ? '#2d7fc1' : '#9fbfa8'

export default function Accueil() {
  const { user } = useAuth()
  const { departement, code } = useTerritoire()
  const { data: historique, isPending, error, refetch } = useHistorique(code)

  const derniere = historique?.at(-1)
  const recents = useMemo(() => historique?.slice(-25) ?? [], [historique])
  const modules = NAVIGATION.filter((n) => n.to !== '/' && n.to !== '/tableau-de-bord' && n.to !== '/admin' && peutAcceder(user, n.acces))
  const prenom = user?.nom?.split(' ')[0]

  return (
    <>
      <EnTetePage
        titre={`Bonjour ${prenom ?? ''}`.trim()}
        description={departement ? `Situation du département de ${departement.departement} (${departement.region}, zone ${departement.zone_agroecologique.toLowerCase()}).` : undefined}
        actions={<SelecteurDepartement />}
      />

      {error ? <Erreur erreur={error} reessayer={refetch} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {isPending || !derniere ? [0, 1, 2, 3].map((i) => <Squelette key={i} className="h-[104px]" />) : (
              <>
                <Indicateur icone={CloudRain} libelle={`Pluie ${derniere.campagne_agricole}`} valeur={mm(derniere.pluie_saison_mm)}
                  detail={`Normale : ${mm(derniere.pluie_saison_normale_mm)}`} />
                <Indicateur icone={Droplets} libelle="Écart à la normale" valeur={nombre(derniere.anomalie_pluie_saison_pct, { unite: '%', signe: true })}
                  ton={(derniere.anomalie_pluie_saison_pct ?? 0) < -15 ? 'alerte' : (derniere.anomalie_pluie_saison_pct ?? 0) > 15 ? 'pluie' : undefined}
                  detail={<>Saison {derniere.classe_saison} · <BadgeRisque risque={derniere.risque_saison} /></>} />
                <Indicateur icone={CalendarRange} libelle="Saison des pluies" valeur={`${nombre(derniere.duree_saison_j)} j`}
                  detail={`du ${jourEnDate(derniere.debut_saison_jour)} au ${jourEnDate(derniere.fin_saison_jour)}`} />
                <Indicateur icone={ShieldAlert} libelle="Vulnérabilité (relative)" valeur={derniere.score_vulnerabilite === null ? 'Non notée' : `${nombre(derniere.score_vulnerabilite)}/100`}
                  detail={derniere.classe_vulnerabilite ?? 'Données de rendement insuffisantes'} />
              </>
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Panneau className="lg:col-span-2" titre="Pluie des 25 dernières saisons" sousTitre="Cumul juin-octobre en mm, comparé à la normale 1991-2020">
              {isPending ? <Squelette className="h-72" /> : (
                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={recents} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#ece8de" />
                      <XAxis dataKey="campagne_agricole" tickLine={false} axisLine={false} fontSize={11} interval={3} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} width={52} tickFormatter={(v) => nombre(v)} />
                      <Tooltip content={<InfoBulle />} cursor={{ fill: '#f2efe6' }} />
                      <ReferenceLine y={derniere?.pluie_saison_normale_mm ?? undefined} stroke="#1d2a22" strokeDasharray="4 4"
                        label={{ value: 'normale', position: 'insideTopRight', fontSize: 11, fill: '#5b6a60' }} />
                      <Bar dataKey="pluie_saison_mm" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        {recents.map((l) => (
                          <Cell key={l.campagne_agricole} fill={couleurBarre(l.anomalie_pluie_saison_pct)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panneau>

            <Panneau titre="Accès rapide" corpsClassName="p-2">
              <ul>
                {modules.map((m) => (
                  <li key={m.to}>
                    <Link to={m.to} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-vert-50">
                      <span className="grid size-9 place-items-center rounded-xl bg-vert-50 text-vert-700 group-hover:bg-white">
                        <m.icone className="size-[18px]" />
                      </span>
                      <span className="flex-1 text-sm font-medium">{m.libelle}</span>
                      <ArrowRight className="size-4 text-encre-douce transition group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panneau>
          </div>
        </>
      )}
    </>
  )
}
