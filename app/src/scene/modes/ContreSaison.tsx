// Agriculteur — « Puis-je cultiver en saison sèche ? » : l'eau disponible en saison sèche près de ses terres
// (carte des opportunités, docs/carte-opportunites.md) et ce qu'elle permet : les cultures irriguées du
// département, l'eau qu'il leur faut en heures de pompage. Repérage indicatif, pas une étude de faisabilité.
// La carte montre tout le pays : bleu (eau mobilisable), sinon jaune ou vert selon la saison des pluies.
import { Fragment, useMemo } from 'react'
import { useBesoins, useChoixCultures, useOpportunite, useOpportunites } from '../../hooks/donnees'
import { libelle, nombre, pct } from '../../lib/format'
import type { CarteOpportunite, CategorieEau } from '../../types/marts'
import { cadrer, usePublier, type PropsMode, type Sortie } from '../cadre'
import { NIVEAUX, NON_DISPONIBLE, SOLEIL_500, VERT_500 } from '../couleurs'
import { culture as cult } from '../lecture'
import { FIN_WO } from '../wolof'
import { heuresPompage, laCulture } from '../conseil'
import { AFaire, Categories, Cle, Cles, Detail, Groupe, Lien, Ligne, Lignes, LigneFiabilite, Methode, Reponse, Squelette, type Action } from '../ui'

const COULEURS: Record<NonNullable<CarteOpportunite['couleur_carte']>, string> = {
  bleu: NIVEAUX['irrigation requise'].couleur,
  jaune: SOLEIL_500,
  vert: VERT_500,
}
const LEGENDE = [
  { couleur: COULEURS.bleu, libelle: 'Eau pour la contre-saison' },
  { couleur: COULEURS.jaune, libelle: 'Saison des pluies courte' },
  { couleur: COULEURS.vert, libelle: 'Saison des pluies longue' },
  { couleur: NON_DISPONIBLE, libelle: 'Non évaluée' },
]

const TITRES: Record<CategorieEau, string> = {
  'eau de surface peu exploitée': 'Oui : de l’eau reste disponible près de vos terres en saison sèche',
  'nappe accessible': 'Oui, avec un puits ou un petit forage',
  'eau de surface déjà exploitée': 'L’eau est déjà très utilisée ici : la place est limitée',
  "pas d'eau mobilisable identifiée": 'Pas d’eau repérée pour la contre-saison ici',
  'non évaluée': 'Données sur l’eau en cours d’intégration',
}
const RESUMES: Record<CategorieEau, string> = {
  'eau de surface peu exploitée': 'Oui, eau de surface libre',
  'nappe accessible': 'Oui, par forage',
  'eau de surface déjà exploitée': 'Eau déjà très utilisée',
  "pas d'eau mobilisable identifiée": 'Pas d’eau repérée',
  'non évaluée': 'Données eau en cours',
}
const OUI: CategorieEau[] = ['eau de surface peu exploitée', 'nappe accessible']
const VERIFIER = 'Avant d’investir, vérifiez sur place le foncier, le sel du sol et l’accès à l’eau.'
const FORAGE = 'Un forage à 1 L/s, pompé 10 h par jour, donne environ 36 m³ : de quoi arroser un demi-hectare de maraîchage.'

export default function ContreSaison({ cadre, publier }: PropsMode) {
  const code = cadre.selection ?? cadre.user.code_departement
  const departement = cadre.ref.departements.find((d) => d.code_departement === code)
  const { data: opportunite, isPending } = useOpportunite(code)
  const { data: toutes } = useOpportunites()
  const { data: choix } = useChoixCultures(code)
  const { data: besoins } = useBesoins(code ? { code_departement: code } : {}, Boolean(code))

  // Absente (404 : mart pas encore construit) : comme « non évaluée »
  const categorie: CategorieEau = opportunite?.categorie_eau ?? 'non évaluée'
  const oui = OUI.includes(categorie)
  const titre = TITRES[categorie]
  // Le conseil de l'API, tel quel ; pas en « non évaluée » : il parle alors de la saison des pluies, pas de l'eau
  const phrase = opportunite && categorie !== 'non évaluée' ? opportunite.conseil_agriculteur : undefined

  // Les cultures « irrigation requise » du département, et l'eau qu'il leur faut par hectare (référence de la zone)
  const irriguees = useMemo(() => [...new Set((choix ?? []).filter((c) => c.niveau_adequation === 'irrigation requise').map((c) => c.culture))]
    .sort((x, y) => libelle(x).localeCompare(libelle(y), 'fr')), [choix])
  const volumes = useMemo(() => new Map((besoins ?? []).filter((b) => b.code_departement === code && b.culture).map((b) => [b.culture!, b.volume_irrigation_m3_ha])), [besoins, code])
  const cible = cadre.culture && irriguees.includes(cadre.culture) ? cadre.culture : irriguees[0] ?? null
  const volume = cible ? volumes.get(cible) ?? null : null
  const eauCible = cible
    ? `Eau nécessaire pour 1 ha ${cult.du(libelle(cible))} : ${volume === null ? 'non disponible' : `${nombre(volume, { unite: 'm³' })}, soit ${heuresPompage(volume)} de pompage à 1 L/s`}.`
    : null

  const semerSurface = (c: string) => {
    cadre.choisirCulture(c)
    cadre.aller('surface')
  }
  const actions: Action[] = !opportunite ? [] : oui ? [
    ...(irriguees.length ? [{
      texte: <>Cultures possibles en contre-saison : {irriguees.map((c, i) => <Fragment key={c}>{i > 0 && ', '}<Lien compact onClick={() => semerSurface(c)}>{libelle(c)}</Lien></Fragment>)}.</>,
    }] : []),
    ...(eauCible ? [{ texte: eauCible }] : []),
    { texte: VERIFIER },
  ] : categorie === 'eau de surface déjà exploitée' ? [{ texte: VERIFIER }]
    : categorie === "pas d'eau mobilisable identifiée" ? [{ texte: 'Concentrez-vous sur l’hivernage.', vers: { mode: 'semer', libelle: 'Que semer ?' } }] : []

  const resume = !departement ? 'Choisissez un département' : isPending ? departement.departement : RESUMES[categorie]

  // L'essentiel, pour l'oreille : la réponse, que faire, la vérification sur place
  const aEcouter = useMemo<string[]>(() => {
    if (!departement) return ['Touchez un département sur la carte pour savoir si l’eau y permet la contre-saison.']
    if (isPending) return []
    const phrases = [`À ${departement.departement} : ${titre}.`, ...(phrase ? [phrase] : [])]
    if (oui && irriguees.length) phrases.push(`Cultures possibles en contre-saison : ${irriguees.map((c) => libelle(c)).join(', ')}.`)
    if (oui && eauCible) phrases.push(eauCible)
    if (categorie === "pas d'eau mobilisable identifiée") phrases.push('Concentrez-vous sur l’hivernage.')
    if (oui || categorie === 'eau de surface déjà exploitée') phrases.push(VERIFIER)
    phrases.push('Repérage indicatif, pas une étude de faisabilité.')
    return phrases
  }, [departement, isPending, titre, phrase, oui, irriguees, eauCible, categorie])
  // Aucune phrase wolof sur l'eau n'est encore traduite : seule la réserve commune est lue
  const aEcouterWo = useMemo<string[] | undefined>(() => (departement && !isPending ? [FIN_WO] : undefined), [departement, isPending])

  const sortie = useMemo<Sortie>(() => {
    const lignes = new Map((toutes ?? []).map((o) => [o.code_departement, o]))
    const nbBleus = (toutes ?? []).filter((o) => o.couleur_carte === 'bleu').length
    return {
      aEcouter,
      aEcouterWo,
      resume,
      vue: {
        ambiance: 'jour', camera: code ? cadrer.departement(cadre, code, { inclinaison: 28 }) : cadrer.pays(cadre, { inclinaison: 28 }), zones: null, relief: false, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [],
        departements: new Map(cadre.ref.departements.map((d) => {
          const o = lignes.get(d.code_departement)
          return [d.code_departement, { couleur: o?.couleur_carte ? COULEURS[o.couleur_carte] : NON_DISPONIBLE }]
        })),
      },
      legende: <Categories titre="Eau en saison sèche" entrees={LEGENDE} />,
      infobulle: (c) => {
        const o = lignes.get(c)
        const nom = cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c
        if (!o) return { titre: nom, lignes: ['Non évaluée'] }
        return {
          titre: nom,
          lignes: [
            `Eau en saison sèche : ${o.categorie_eau}`,
            ...(o.couleur_carte === 'bleu' && o.rang_opportunite_eau !== null ? [`Opportunité eau : ${o.rang_opportunite_eau}${o.rang_opportunite_eau === 1 ? 'er' : 'e'} sur ${nbBleus}`] : []),
            `Saison des pluies : ${o.classe_saison_pluie}`,
          ],
        }
      },
    }
  }, [toutes, code, cadre, aEcouter, aEcouterWo, resume])
  usePublier(publier, sortie)

  if (!departement) return <Reponse titre="Choisissez un département" phrase="Touchez un département sur la carte pour voir l’eau disponible en saison sèche." />

  const o = opportunite
  return (
    <div>
      <Reponse vivant cle={`${code}-${categorie}`} titre={isPending ? `À ${departement.departement}` : titre} phrase={phrase} />
      {isPending && <Squelette lignes={2} />}

      <AFaire aller={cadre.aller} actions={actions} />

      {o && categorie === 'eau de surface peu exploitée' && (
        <Cles>
          <Cle valeur={nombre(o.surface_proche_eau_inexploitee_ha)} unite="ha" libelle="cultivables encore libres à moins de 2 km de l’eau" teinte={COULEURS.bleu} />
          <Cle valeur={nombre(o.part_proche_eau_exploitee_pct)} unite="%" libelle="déjà cultivés en saison sèche" />
          <Cle valeur={nombre(o.surface_eau_permanente_ha)} unite="ha" libelle="d’eau présente au moins 10 mois sur 12" />
        </Cles>
      )}
      {o && categorie === 'nappe accessible' && (
        <>
          <Cles>
            <Cle valeur={o.profondeur_classe_dominante ?? '—'} libelle="profondeur de la nappe" teinte={COULEURS.bleu} />
            <Cle valeur={o.productivite_classe_dominante ?? '—'} libelle="débit attendu d’un forage" />
            <Cle valeur={nombre(o.part_nappe_accessible_pct)} unite="%" libelle="du département où la nappe est accessible" />
          </Cles>
          <p className="mt-3 text-xs leading-relaxed text-white/70">{FORAGE}</p>
        </>
      )}

      <LigneFiabilite parties={['Repérage indicatif, pas une étude de faisabilité', 'sources JRC, BGS, FAO']} />

      {o && categorie !== 'non évaluée' && (
        <Detail>
          <Groupe titre="L’eau du département en saison sèche">
            <Lignes>
              <Ligne libelle="Eau permanente (10 mois sur 12)" valeur={nombre(o.surface_eau_permanente_ha, { unite: 'ha' })} detail="JRC" />
              <Ligne libelle="Terres cultivables à moins de 2 km" valeur={nombre(o.surface_proche_eau_cultivable_ha, { unite: 'ha' })} />
              <Ligne libelle="Dont nues en saison sèche" valeur={nombre(o.surface_proche_eau_inexploitee_ha, { unite: 'ha' })} />
              <Ligne libelle="Déjà cultivées en saison sèche" valeur={pct(o.part_proche_eau_exploitee_pct)} detail="MODIS" />
              <Ligne libelle="Profondeur de la nappe" valeur={o.profondeur_classe_dominante ?? 'non disponible'} detail="BGS" />
              <Ligne libelle="Débit attendu d’un forage" valeur={o.productivite_classe_dominante ?? 'non disponible'} detail="BGS" />
              <Ligne libelle="Nappe accessible (25 m, 1 L/s)" valeur={pct(o.part_nappe_accessible_pct)} detail="du département" />
              <Ligne libelle="Surface équipée pour l’irrigation" valeur={nombre(o.surface_equipee_irrigation_ha, { unite: 'ha' })} detail="FAO, vers 2005" />
            </Lignes>
          </Groupe>
          {irriguees.length > 0 && (
            <Groupe titre="Eau d’irrigation pour 1 ha · estimation, non mesurée">
              <Lignes>
                {irriguees.map((c) => {
                  const v = volumes.get(c) ?? null
                  return <Ligne key={c} libelle={libelle(c)} valeur={nombre(v, { unite: 'm³' })} detail={v === null ? undefined : `${heuresPompage(v)} à 1 L/s`} />
                })}
              </Lignes>
            </Groupe>
          )}
        </Detail>
      )}

      <Methode>
        <p>Les nappes viennent d’une carte continentale (BGS, 1:20 millions) : un ordre de grandeur par département, pas l’emplacement d’un forage.</p>
        <p>Les surfaces irriguées de la FAO datent d’environ 2005 ; la végétation de saison sèche (MODIS 2021-2024), plus récente, décide de « déjà exploitée ».</p>
        <p>L’eau de surface (JRC) s’arrête en 2021 : les retenues récentes peuvent manquer.</p>
        <p>Les hectares sont bruts : une terre nue près de l’eau peut être une réserve, un parcours ou un terrain litigieux.</p>
        <p>Ces données n’ont pas d’année : le choix de l’année n’apparaît pas ici.</p>
        {oui && cible && <p>Heures de pompage : volume de la zone pour {laCulture(cible)} divisé par 3,6 m³ par heure (1 L/s), arrondi à 50.</p>}
      </Methode>
    </div>
  )
}
