import { ArrowRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CarteSenegal } from '../components/map/CarteSenegal'
import { valeurTexte } from '../components/map/valeurTexte'
import { Erreur } from '../components/ui/EtatVide'
import { BadgeRisque, EnTetePage, Note, Panneau, Segment, Squelette } from '../components/ui/base'
import { SelecteurAnnee } from '../components/ui/Selecteurs'
import { useCarte, useReferentiels } from '../hooks/donnees'
import { useTerritoire } from '../hooks/territoire'
import { INDICATEURS_CARTE, type ChampCarte } from '../lib/echelles'
import { jourEnDate, libelle, mm, nombre, pct } from '../lib/format'

const OPTIONS = (Object.keys(INDICATEURS_CARTE) as ChampCarte[]).map((valeur) => ({ valeur, libelle: INDICATEURS_CARTE[valeur].libelle.replace(' (relative)', '') }))

function Ligne({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-trait/70 py-2 text-sm last:border-0">
      <dt className="text-encre-douce">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  )
}

export default function CarteAgroclimat() {
  const { data: ref } = useReferentiels()
  const { code, choisir } = useTerritoire()
  const [campagne, setCampagne] = useState<number | null>(null)
  const [champ, setChamp] = useState<ChampCarte>('anomalie_pluie_saison_pct')
  const annee = campagne ?? ref?.campagnes?.at(-1)
  const { data: lignes, isPending, isFetching, error, refetch } = useCarte(annee)
  const indicateur = INDICATEURS_CARTE[champ]

  const choisie = lignes?.find((l) => l.code_departement === code)
  const classement = useMemo(() => {
    if (!lignes || indicateur.echelle.type !== 'continue') return []
    return [...lignes].filter((l) => typeof l[champ] === 'number').sort((a, b) => (a[champ] as number) - (b[champ] as number))
  }, [lignes, champ, indicateur])

  return (
    <>
      <EnTetePage
        titre="Carte agroclimatique"
        description="Bilan de la saison des pluies par département. Cliquez sur un département pour le détail."
        actions={<SelecteurAnnee annees={ref?.campagnes} valeur={annee} onChange={setCampagne} />}
      />
      <div className="mb-3 overflow-x-auto">
        <Segment options={OPTIONS} valeur={champ} onChange={setChamp} libelle="Indicateur affiché" />
      </div>

      {error ? <Erreur erreur={error} reessayer={refetch} /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className={`transition-opacity ${isFetching && !isPending ? 'opacity-70' : ''}`}>
            {isPending ? <Squelette className="h-[460px]" /> : (
              <CarteSenegal lignes={lignes} departements={ref?.departements} champ={champ} indicateur={indicateur}
                selection={code} onSelect={choisir} hauteur="h-[420px] sm:h-[520px]" />
            )}
            {champ === 'score_vulnerabilite' && (
              <div className="mt-3"><Note>Score relatif : il compare les départements entre eux (100 = le plus vulnérable). Non calculé pour Dakar, Guédiawaye et Pikine.</Note></div>
            )}
          </div>

          <div className="space-y-4">
            <Panneau titre={choisie?.departement ?? 'Département'} sousTitre={choisie ? `${choisie.region} · ${libelle(choisie.zone_agroecologique)} · ${annee}` : undefined}
              action={<Link to="/suivi" className="inline-flex items-center gap-1 text-xs font-medium text-vert-700 hover:underline">Décades <ArrowRight className="size-3.5" /></Link>}>
              {!choisie ? <Squelette className="h-56" /> : (
                <dl>
                  <Ligne k="Pluie de la saison" v={mm(choisie.pluie_saison_mm)} />
                  <Ligne k="Normale 1991-2020" v={mm(choisie.pluie_saison_normale_mm)} />
                  <Ligne k="Écart" v={nombre(choisie.anomalie_pluie_saison_pct, { unite: '%', signe: true })} />
                  <Ligne k="Classe (relative au département)" v={choisie.classe_saison} />
                  <Ligne k="Risque" v={<BadgeRisque risque={choisie.risque_saison} />} />
                  <Ligne k="Début · fin" v={`${jourEnDate(choisie.debut_saison_jour)} · ${jourEnDate(choisie.fin_saison_jour)}`} />
                  <Ligne k="Plus longue séquence sèche" v={nombre(choisie.plus_longue_sequence_seche_j, { unite: 'j' })} />
                  <Ligne k="Jours > 40 °C" v={nombre(choisie.nb_jours_tmax_sup_40)} />
                  <Ligne k="Anomalie de végétation (NDVI)" v={choisie.anomalie_ndvi_pct === null ? 'avant 2000 : absent' : pct(choisie.anomalie_ndvi_pct)} />
                </dl>
              )}
            </Panneau>

            {classement.length > 0 && (
              <Panneau titre="Classement" sousTitre={`${indicateur.libelle}, du plus bas au plus haut`} corpsClassName="max-h-72 overflow-y-auto p-2">
                <ol>
                  {classement.map((l, i) => (
                    <li key={l.code_departement}>
                      <button onClick={() => choisir(l.code_departement)}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-vert-50 ${l.code_departement === code ? 'bg-vert-50 font-semibold' : ''}`}>
                        <span className="w-5 text-right text-xs text-encre-douce tabular-nums">{i + 1}</span>
                        <span className="size-2.5 rounded-full" style={{ background: indicateur.echelle.couleur(l[champ]) }} />
                        <span className="flex-1 truncate">{l.departement}</span>
                        <span className="tabular-nums">{valeurTexte(l[champ], indicateur)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </Panneau>
            )}
          </div>
        </div>
      )}
    </>
  )
}
