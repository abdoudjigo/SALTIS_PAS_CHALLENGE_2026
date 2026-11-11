import { useMemo } from 'react'
import { CarteSenegal } from '../components/map/CarteSenegal'
import { Erreur } from '../components/ui/EtatVide'
import { Badge, EnTetePage, Note, Panneau, Squelette } from '../components/ui/base'
import { useReferentiels, useVulnerabilite } from '../hooks/donnees'
import { useTerritoire } from '../hooks/territoire'
import { INDICATEURS_CARTE } from '../lib/echelles'
import { mm, nombre, pct, type Ton } from '../lib/format'

const TON_CLASSE: Record<string, Ton> = {
  'très élevée (relatif)': 'alerte', 'élevée (relatif)': 'terre', 'moyenne (relatif)': 'soleil', 'faible (relatif)': 'vert', 'très faible (relatif)': 'vert',
}

function Jauge({ libelle, valeur, poids }: { libelle: string; valeur: number | null; poids: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-encre-douce">{libelle} <span className="opacity-60">({poids})</span></span>
        <span className="font-semibold tabular-nums">{valeur === null ? 'non calculé' : `${nombre(valeur)}/100`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-alerte-500 transition-[width] duration-500" style={{ width: `${valeur ?? 0}%` }} />
      </div>
    </div>
  )
}

export default function Vulnerabilite() {
  const { data: ref } = useReferentiels()
  const { code, choisir } = useTerritoire()
  const { data, isPending, error, refetch } = useVulnerabilite()
  const choisi = data?.find((d) => d.code_departement === code)
  const classement = useMemo(() => [...(data ?? [])].sort((a, b) => (a.rang_vulnerabilite ?? 99) - (b.rang_vulnerabilite ?? 99)), [data])

  if (error) return <Erreur erreur={error} reessayer={refetch} />

  return (
    <>
      <EnTetePage titre="Vulnérabilité des départements"
        description="Score relatif et indicatif (méthode v1) : 60 % aléa sécheresse (1991-2020) et 40 % sensibilité des rendements (1991-2015). 100 = le plus vulnérable." />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {isPending ? <Squelette className="h-[480px]" /> : (
          <CarteSenegal lignes={data} departements={ref?.departements} champ="score_vulnerabilite" indicateur={INDICATEURS_CARTE.score_vulnerabilite}
            selection={code} onSelect={choisir} hauteur="h-[420px] sm:h-[480px]" />
        )}

        <Panneau titre={choisi?.departement ?? 'Département'}
          sousTitre={choisi ? (choisi.rang_vulnerabilite ? `Rang ${choisi.rang_vulnerabilite} sur 42 départements notés` : 'Non noté') : undefined}
          action={choisi?.classe_vulnerabilite && <Badge ton={TON_CLASSE[choisi.classe_vulnerabilite]}>{choisi.classe_vulnerabilite}</Badge>}>
          {!choisi ? <Squelette className="h-64" /> : (
            <div className="space-y-4">
              <div className="text-3xl font-semibold tracking-tight">{choisi.score_vulnerabilite === null ? '—' : `${nombre(choisi.score_vulnerabilite)}/100`}</div>
              <Jauge libelle="Aléa sécheresse" poids="60 %" valeur={choisi.score_alea_secheresse} />
              <Jauge libelle="Sensibilité des rendements" poids="40 %" valeur={choisi.score_sensibilite_rendement} />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-trait pt-3 text-xs">
                <dt className="text-encre-douce">Alertes sécheresse</dt><dd className="text-right font-medium">{pct(choisi.freq_alerte_secheresse_pct)} des saisons</dd>
                <dt className="text-encre-douce">Variabilité de la pluie</dt><dd className="text-right font-medium">{pct(choisi.variabilite_pluie_cv_pct)}</dd>
                <dt className="text-encre-douce">Pluie d'une année sèche</dt><dd className="text-right font-medium">{mm(choisi.pluie_saison_annee_seche_mm)}</dd>
                <dt className="text-encre-douce">Variabilité des rendements</dt><dd className="text-right font-medium">{pct(choisi.variabilite_rendement_pct)}</dd>
                <dt className="text-encre-douce">Tendance des rendements</dt><dd className="text-right font-medium">{nombre(choisi.tendance_rendement_pct_an, { decimales: 1, unite: '%/an', signe: true })}</dd>
              </dl>
              <div className="rounded-xl bg-stone-50 p-3 text-xs">
                <p className="mb-1.5 font-medium text-encre-douce">Hors score</p>
                <dl className="grid grid-cols-2 gap-y-1">
                  <dt className="text-encre-douce">Probabilité de saison sèche</dt><dd className="text-right">{pct(choisi.proba_saison_seche_pct)}</dd>
                  <dt className="text-encre-douce">Séquence sèche de 15 j</dt><dd className="text-right">{pct(choisi.proba_sequence_seche_15j_pct)}</dd>
                  <dt className="text-encre-douce">Alertes excès de pluie</dt><dd className="text-right">{pct(choisi.freq_alerte_exces_pct)}</dd>
                </dl>
              </div>
              {choisi.confiance_rendement === 'faible' && (
                <Note ton="soleil">Trop peu de données de rendement : le score n'est pas calculé, seul l'aléa sécheresse est affiché.</Note>
              )}
            </div>
          )}
        </Panneau>
      </div>

      <Panneau className="mt-4" titre="Classement" corpsClassName="p-0">
        {isPending ? <div className="p-5"><Squelette className="h-64" /></div> : (
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="sticky top-0 bg-stone-50 text-left text-xs text-encre-douce">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Rang</th><th className="px-3 py-2.5 font-medium">Département</th>
                  <th className="px-3 py-2.5 font-medium">Région</th><th className="px-3 py-2.5 text-right font-medium">Score</th>
                  <th className="px-3 py-2.5 text-right font-medium">Aléa</th><th className="px-3 py-2.5 text-right font-medium">Sensibilité</th>
                  <th className="px-4 py-2.5 font-medium">Classe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trait">
                {classement.map((d) => (
                  <tr key={d.code_departement} onClick={() => choisir(d.code_departement)}
                    className={`cursor-pointer transition hover:bg-vert-50/50 ${d.code_departement === code ? 'bg-vert-50' : ''}`}>
                    <td className="px-4 py-2 tabular-nums text-encre-douce">{d.rang_vulnerabilite ?? '—'}</td>
                    <td className="px-3 py-2 font-medium">{d.departement}</td>
                    <td className="px-3 py-2 text-encre-douce">{d.region}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{nombre(d.score_vulnerabilite)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nombre(d.score_alea_secheresse)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nombre(d.score_sensibilite_rendement)}</td>
                    <td className="px-4 py-2">{d.classe_vulnerabilite ? <Badge ton={TON_CLASSE[d.classe_vulnerabilite]}>{d.classe_vulnerabilite}</Badge> : <span className="text-xs text-encre-douce">non noté</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panneau>
      <div className="mt-3"><Note>À valider par les techniciens : la Vallée du fleuve, en grande partie irriguée, et des départements en partie urbains peuvent ressortir en tête.</Note></div>
    </>
  )
}
