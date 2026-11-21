// Courbe sobre : la pluie tombée depuis le 1er juin face à la normale, décade par décade (suivi décadaire).
// Chargée à part (recharts) : elle ne pèse que lorsqu'on ouvre le détail d'une année passée.
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { nombre } from '../../lib/format'
import type { LigneSuivi } from '../../types/marts'
import { debutDecade } from '../regles/fiabilite'

export default function CourbeCumul({ lignes, description }: { lignes: LigneSuivi[]; description: string }) {
  const points = lignes
    .filter((l) => l.est_decade_saison && l.cumul_depuis_juin_mm !== null)
    .sort((a, b) => a.numero_decade_annee - b.numero_decade_annee)
    .map((l) => ({ date: debutDecade(l.numero_decade_annee, true), tombee: l.cumul_depuis_juin_mm, normale: l.cumul_normale_depuis_juin_mm }))
  return (
    <div className="h-44" role="img" aria-label={description}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
          <CartesianGrid stroke="rgb(255 255 255 / 0.08)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'rgb(255 255 255 / 0.6)', fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
          <YAxis tick={{ fill: 'rgb(255 255 255 / 0.6)', fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip contentStyle={{ background: 'var(--color-encre-nuit)', border: '1px solid rgb(255 255 255 / 0.15)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'rgb(255 255 255 / 0.7)' }} formatter={(v, nom) => [v === null || v === undefined ? 'non disponible' : `${nombre(Number(v))} mm`, nom === 'tombee' ? 'Tombée' : 'Normale']} />
          <Line type="monotone" dataKey="normale" stroke="var(--color-brume)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="tombee" stroke="var(--color-ciel-vif)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
