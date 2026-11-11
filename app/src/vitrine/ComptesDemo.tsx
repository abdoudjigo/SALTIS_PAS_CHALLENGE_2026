import { ArrowRight } from 'lucide-react'
import { MOT_DE_PASSE_DEMO, UTILISATEURS_DEMO } from '../api/mock/comptes'
import { ROLES } from '../auth/roles'
import { useReferentiels } from '../hooks/donnees'
import type { Utilisateur } from '../types/auth'

/** Comptes de démonstration : un clic suffit pour entrer avec un profil. */
export function ComptesDemo({ occupe, onEntrer }: { occupe: boolean; onEntrer: (email: string, password: string) => void }) {
  const { data: ref } = useReferentiels()

  const profil = (u: Utilisateur) => {
    if (u.organisation) return u.organisation.nom
    const departement = ref?.departements.find((d) => d.code_departement === u.code_departement)?.departement
    return departement ? `${ROLES[u.role].libelle} · ${departement}` : ROLES[u.role].libelle
  }

  return (
    <section aria-labelledby="titre-demo" className="mt-7 border-t border-white/12 pt-6">
      <h2 id="titre-demo" className="font-titre text-xl font-medium">Entrer comme…</h2>
      <p className="mt-1 text-sm text-white/55">Comptes de démonstration, sans mot de passe à saisir.</p>
      <ul className="mt-4 grid gap-2">
        {UTILISATEURS_DEMO.map((u) => (
          <li key={u.email}>
            <button type="button" disabled={occupe} onClick={() => onEntrer(u.email, MOT_DE_PASSE_DEMO)}
              className="group flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-2 text-left transition hover:border-soleil-500/70 hover:bg-white/[0.08] disabled:opacity-50">
              <span className="min-w-0">
                <span className="block truncate font-medium">{u.nom}</span>
                <span className="block truncate text-sm text-white/55">{profil(u)}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-soleil-500" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
