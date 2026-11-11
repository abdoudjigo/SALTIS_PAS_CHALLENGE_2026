import { Download, PackageOpen } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EtatVide, Erreur } from '../components/ui/EtatVide'
import { Badge, EnTetePage, Indicateur, Note, Panneau, Segment, Squelette, StatutDose } from '../components/ui/base'
import { SelecteurDepartement } from '../components/ui/Selecteurs'
import { useBesoins } from '../hooks/donnees'
import { useTerritoire } from '../hooks/territoire'
import { libelle, nombre, tonnes, VIDE } from '../lib/format'
import type { ColonneBesoin, LigneBesoin, StatutDose as TypeStatut } from '../types/marts'

type Jeu = 'produits' | 'elements'
type Portee = 'departement' | 'national'

// Produits et éléments décrivent la même fertilisation : on ne les affiche jamais ensemble dans un total.
const JEUX: Record<Jeu, [ColonneBesoin, string][]> = {
  produits: [['besoin_npk_15_15_15_t', 'NPK 15-15-15'], ['besoin_uree_t', 'Urée'], ['besoin_dap_t', 'DAP'], ['besoin_fumier_t', 'Fumier']],
  elements: [['besoin_azote_n_t', 'Azote N'], ['besoin_phosphate_p2o5_t', 'Phosphore P₂O₅'], ['besoin_potasse_k2o_t', 'Potasse K₂O']],
}
const TOUTES_COLONNES: ColonneBesoin[] = [...JEUX.produits, ...JEUX.elements].map(([c]) => c)

/** Ligne affichée : un département × culture, ou un total national par culture */
type LigneAffichee = Record<ColonneBesoin, number | null> & {
  culture: string
  superficie_reference_ha: number | null
  // détail départemental
  statut_validation_engrais?: TypeStatut | null
  reference_anterieure_2015?: boolean | null
  annees_reference?: string | null
  libelle_besoin_engrais?: string | null
  libelle_semences?: string | null
  // agrégat national
  nb_departements?: number
  nb_sans_dose?: number
  nb_semences_non_applicables?: number
}

// Somme qui ne transforme jamais un NULL en 0 : null si aucune valeur connue
function somme<T>(lignes: T[], valeur: (l: T) => number | null | undefined): number | null {
  const connues = lignes.map(valeur).filter((v): v is number => v !== null && v !== undefined)
  return connues.length ? connues.reduce((a, b) => a + b, 0) : null
}

function CelluleBesoin({ valeur, libelleVide }: { valeur: number | null; libelleVide?: string }) {
  if (valeur === null) return <span className="text-xs text-encre-douce italic">{libelleVide ?? 'dose à saisir'}</span>
  return <span className="tabular-nums">{tonnes(valeur)}</span>
}

function exporterCsv(lignes: LigneAffichee[], colonnes: [ColonneBesoin, string][], nom: string) {
  const entete: (keyof LigneAffichee)[] = ['culture', 'superficie_reference_ha', ...colonnes.map(([c]) => c), 'besoin_semences_retenu_t']
  const csv = [entete.join(';'), ...lignes.map((l) => entete.map((c) => l[c] ?? '').join(';'))].join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  Object.assign(document.createElement('a'), { href: url, download: nom }).click()
  URL.revokeObjectURL(url)
}

function versAffichee(l: LigneBesoin & { culture: string }): LigneAffichee {
  return l
}

function totalNational(culture: string, ls: LigneBesoin[]): LigneAffichee {
  const besoins = Object.fromEntries(TOUTES_COLONNES.map((c) => [c, somme(ls, (l) => l[c])])) as Record<ColonneBesoin, number | null>
  return {
    ...besoins,
    culture,
    superficie_reference_ha: somme(ls, (l) => l.superficie_reference_ha),
    besoin_semences_retenu_t: somme(ls, (l) => l.besoin_semences_retenu_t),
    nb_departements: ls.length,
    nb_sans_dose: ls.filter((l) => l.statut_validation_engrais === 'A_COMPLETER').length,
    nb_semences_non_applicables: ls.filter((l) => l.besoin_semences_applicable === false).length,
  }
}

export default function Besoins() {
  const { code, departement } = useTerritoire()
  const [portee, setPortee] = useState<Portee>('departement')
  const [jeu, setJeu] = useState<Jeu>('produits')
  const { data, isPending, error, refetch } = useBesoins(portee === 'departement' && code ? { code_departement: code } : {})
  const colonnes = JEUX[jeu]

  const lignes = useMemo<LigneAffichee[]>(() => {
    const avecCulture = (data ?? []).filter((l): l is LigneBesoin & { culture: string } => l.culture !== null)
    const parSuperficie = (a: LigneAffichee, b: LigneAffichee) => (b.superficie_reference_ha ?? 0) - (a.superficie_reference_ha ?? 0)
    if (portee === 'departement') return avecCulture.map(versAffichee).sort(parSuperficie)
    const parCulture = new Map<string, LigneBesoin[]>()
    avecCulture.forEach((l) => parCulture.set(l.culture, [...(parCulture.get(l.culture) ?? []), l]))
    return [...parCulture.entries()].map(([c, ls]) => totalNational(c, ls)).sort(parSuperficie)
  }, [data, portee])

  const message = data?.find((l) => !l.culture)?.message_departement
  const total = (col: keyof LigneAffichee) => somme(lignes, (l) => l[col] as number | null)
  const nbSansDose = lignes.filter((l) => (portee === 'departement' ? l.statut_validation_engrais === 'A_COMPLETER' : l.nb_sans_dose === l.nb_departements)).length

  return (
    <>
      <EnTetePage
        titre="Besoins en intrants"
        description="Besoins de référence calculés sur les superficies des dernières campagnes connues : ce ne sont pas des prévisions."
        actions={
          <>
            <Segment<Portee> options={[{ valeur: 'departement', libelle: 'Département' }, { valeur: 'national', libelle: 'National' }]} valeur={portee} onChange={setPortee} libelle="Portée" />
            {portee === 'departement' && <SelecteurDepartement />}
          </>
        }
      />

      {error ? <Erreur erreur={error} reessayer={refetch} /> : message ? (
        <EtatVide icone={PackageOpen} titre={`${departement?.departement} : ${message}`} texte="Aucune culture de référence n'est recensée dans ce département." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {isPending ? [0, 1, 2, 3].map((i) => <Squelette key={i} className="h-[104px]" />) : (
              <>
                <Indicateur libelle="Superficie de référence" valeur={nombre(total('superficie_reference_ha'), { unite: 'ha' })} detail={`${lignes.length} cultures`} />
                <Indicateur libelle={jeu === 'produits' ? 'NPK 15-15-15' : 'Azote (N)'} valeur={tonnes(total(colonnes[0][0]))} detail="cultures avec dose seulement" />
                <Indicateur libelle="Semences (retenues)" valeur={tonnes(total('besoin_semences_retenu_t'))} detail="riz pluvial de Casamance exclu" />
                <Indicateur libelle="Cultures sans dose" valeur={`${nbSansDose} / ${lignes.length}`} ton={nbSansDose ? 'alerte' : 'vert'} detail="en attente des doses ISRA" />
              </>
            )}
          </div>

          <Panneau className="mt-4" titre={portee === 'departement' ? `Détail par culture · ${departement?.departement ?? ''}` : 'Total national par culture'}
            action={
              <div className="flex items-center gap-2">
                <Segment<Jeu> options={[{ valeur: 'produits', libelle: 'Produits' }, { valeur: 'elements', libelle: 'Éléments' }]} valeur={jeu} onChange={setJeu} libelle="Type de besoin" />
                <button onClick={() => exporterCsv(lignes, colonnes, `besoins_${portee === 'departement' ? code : 'national'}.csv`)}
                  className="hidden rounded-xl p-2 text-encre-douce hover:bg-stone-100 sm:block" title="Exporter en CSV">
                  <Download className="size-4" /><span className="sr-only">Exporter en CSV</span>
                </button>
              </div>
            }
            corpsClassName="p-0">
            {isPending ? <div className="p-5"><Squelette className="h-64" /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-stone-50 text-left text-xs text-encre-douce">
                    <tr>
                      <th className="sticky left-0 bg-stone-50 px-4 py-2.5 font-medium">Culture</th>
                      <th className="px-3 py-2.5 text-right font-medium">Superficie</th>
                      {colonnes.map(([c, l]) => <th key={c} className="px-3 py-2.5 text-right font-medium">{l}</th>)}
                      <th className="px-3 py-2.5 text-right font-medium">Semences</th>
                      <th className="px-4 py-2.5 font-medium">{portee === 'departement' ? 'Statut des doses' : 'Couverture'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-trait">
                    {lignes.map((l) => (
                      <tr key={l.culture} className="hover:bg-vert-50/40">
                        <td className="sticky left-0 bg-white px-4 py-2.5 font-medium">
                          {libelle(l.culture)}
                          {l.reference_anterieure_2015 && <Badge ton="soleil" className="ml-2" title={`Années de référence : ${l.annees_reference}`}>réf. ancienne</Badge>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{nombre(l.superficie_reference_ha, { unite: 'ha' })}</td>
                        {colonnes.map(([c]) => (
                          <td key={c} className="px-3 py-2.5 text-right">
                            <CelluleBesoin valeur={l[c]} libelleVide={l.libelle_besoin_engrais === 'superficie de référence nulle' ? 'superficie nulle' : undefined} />
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right">
                          <CelluleBesoin valeur={l.besoin_semences_retenu_t} libelleVide={l.libelle_semences === 'non applicable (riz pluvial)' ? 'non applicable (riz pluvial)' : undefined} />
                        </td>
                        <td className="px-4 py-2.5">
                          {portee === 'departement' ? (
                            <div className="flex flex-wrap gap-1"><StatutDose statut={l.statut_validation_engrais ?? null} /></div>
                          ) : (
                            <span className="text-xs text-encre-douce">
                              {l.nb_departements} dép.{l.nb_sans_dose ? ` · ${l.nb_sans_dose} sans dose` : ''}{l.nb_semences_non_applicables ? ` · ${l.nb_semences_non_applicables} riz pluvial` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-trait bg-stone-50 font-semibold">
                    <tr>
                      <td className="sticky left-0 bg-stone-50 px-4 py-2.5">Total (doses connues)</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{nombre(total('superficie_reference_ha'), { unite: 'ha' })}</td>
                      {colonnes.map(([c]) => <td key={c} className="px-3 py-2.5 text-right tabular-nums">{total(c) === null ? VIDE : tonnes(total(c))}</td>)}
                      <td className="px-3 py-2.5 text-right tabular-nums">{total('besoin_semences_retenu_t') === null ? VIDE : tonnes(total('besoin_semences_retenu_t'))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panneau>

          <div className="mt-4 space-y-2">
            <Note>Aucune dose n'est encore validée par un spécialiste. « Dose à saisir » signifie que le besoin n'est pas calculé (il n'est pas nul). Les totaux ne comptent que les cultures avec une dose.</Note>
          </div>
        </>
      )}
    </>
  )
}
