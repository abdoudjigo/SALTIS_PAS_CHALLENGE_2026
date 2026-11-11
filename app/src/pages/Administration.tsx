import { Building2, Database, Users } from 'lucide-react'
import { UTILISATEURS_DEMO } from '../api/mock/comptes'
import { ROLES } from '../auth/roles'
import { config } from '../config'
import { Badge, EnTetePage, Note, Panneau } from '../components/ui/base'
import { useReferentiels } from '../hooks/donnees'

// Écran d'administration : structure prête, à brancher sur les routes /admin/* de l'API (PostgreSQL).
export default function Administration() {
  const { data: ref } = useReferentiels()
  const utilisateurs = config.useMock ? UTILISATEURS_DEMO : []

  return (
    <>
      <EnTetePage titre="Administration" description="Utilisateurs, organisations et référentiels." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panneau className="lg:col-span-2" titre="Utilisateurs" action={<Users className="size-4 text-encre-douce" />} corpsClassName="p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs text-encre-douce">
              <tr><th className="px-4 py-2.5 font-medium">Nom</th><th className="px-3 py-2.5 font-medium">Email</th><th className="px-4 py-2.5 font-medium">Profil</th></tr>
            </thead>
            <tbody className="divide-y divide-trait">
              {utilisateurs.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 font-medium">{u.nom}</td>
                  <td className="px-3 py-2.5 text-encre-douce">{u.email}</td>
                  <td className="px-4 py-2.5"><Badge ton="vert">{ROLES[u.role].libelle}</Badge> {u.organisation && <span className="text-xs text-encre-douce">{u.organisation.nom}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!utilisateurs.length && <p className="p-4 text-sm text-encre-douce">Liste à brancher sur l'API (GET /admin/utilisateurs).</p>}
        </Panneau>
        <div className="space-y-4">
          <Panneau titre="Référentiels" action={<Database className="size-4 text-encre-douce" />}>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-encre-douce">Départements</dt><dd className="text-right font-medium">{ref?.departements?.length ?? '—'}</dd>
              <dt className="text-encre-douce">Zones agroécologiques</dt><dd className="text-right font-medium">{ref?.zones?.length ?? '—'}</dd>
              <dt className="text-encre-douce">Cultures</dt><dd className="text-right font-medium">{ref?.cultures?.length ?? '—'}</dd>
              <dt className="text-encre-douce">Intrants</dt><dd className="text-right font-medium">{ref?.intrants?.length ?? '—'}</dd>
            </dl>
          </Panneau>
          <Panneau titre="Organisations" action={<Building2 className="size-4 text-encre-douce" />}>
            <p className="text-sm text-encre-douce">ONG et services de l'État. Associations de producteurs de semences : à confirmer.</p>
          </Panneau>
        </div>
      </div>
      <div className="mt-4"><Note>Création de comptes, attribution des rôles et rattachement aux organisations : à brancher sur l'API.</Note></div>
    </>
  )
}
