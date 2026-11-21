// ONG, étape 6 — « Où sont les zones à fort potentiel ? » : deux listes classées, tirées de données existantes.
// - Contre-saison : départements « bleus » de la carte des opportunités (/opportunites), par rang d'opportunité eau.
// - Gain de rendement : potentiel_gain_kg_ha de mart_territoires_agrodistrib, seulement là où il est évalué et la
//   culture « adaptée » (valeur de zone, non additive). Ce sont des repérages indicatifs.
// La carte reprend les couleurs de la carte des opportunités (couleurs.ts).
import { useMemo } from 'react'
import { useOpportunites, useTerritoires } from '../../hooks/donnees'
import { libelle, nombre } from '../../lib/format'
import { cadrer, questionOng, usePublier, type PropsMode, type Sortie } from '../cadre'
import { COULEURS_OPPORTUNITE, LEGENDE_OPPORTUNITES, NON_DISPONIBLE } from '../carte/couleurs'
import { aLire, puceCulture, type LigneCheck } from '../interface/fiche'
import { FicheReponse } from '../interface/FicheReponse'
import { Categories, Groupe, Methode, Rang, Squelette } from '../interface/ui'

const RAPPEL = 'Repérages indicatifs, à vérifier sur le terrain'

export default function Potentiel({ cadre, publier }: PropsMode) {
  const { data: opportunites, isPending: chargeOpp } = useOpportunites()
  const { data: territoires } = useTerritoires()
  const code = cadre.selection
  const cultures = useMemo(() => [...new Set(territoires?.map((t) => t.culture))].sort(), [territoires])
  const culture = cadre.culture && cultures.includes(cadre.culture) ? cadre.culture : null

  const eau = useMemo(() => (opportunites ?? []).filter((o) => o.couleur_carte === 'bleu').sort((x, y) => {
    // Rang croissant ; un rang absent passe après les rangs connus
    const [a, b] = [x.rang_opportunite_eau, y.rang_opportunite_eau]
    return a === null && b === null ? 0 : a === null ? 1 : b === null ? -1 : a - b
  }), [opportunites])
  const gains = useMemo(() => (territoires ?? [])
    .filter((t) => t.potentiel_evalue && t.meilleur_niveau_adequation === 'adaptée' && t.potentiel_gain_kg_ha !== null && (!culture || t.culture === culture))
    .sort((x, y) => y.potentiel_gain_kg_ha! - x.potentiel_gain_kg_ha!), [territoires, culture])
  const oppDep = opportunites?.find((o) => o.code_departement === code)
  const gainDep = gains.find((g) => g.code_departement === code)
  const nomDep = code ? cadre.ref.departements.find((d) => d.code_departement === code)?.departement : undefined
  const pourCulture = culture ? ` (${libelle(culture).toLowerCase()})` : ''

  const titre = nomDep ?? (opportunites === null ? 'Fort potentiel : contre-saison non disponible' : opportunites ? `${eau.length} départements avec de l’eau pour la contre-saison` : 'Zones à fort potentiel')
  const lignes: LigneCheck[] = nomDep ? [
    !oppDep ? { etat: 'info', texte: 'Contre-saison : non disponible ici' }
      : oppDep.couleur_carte === 'bleu' ? { etat: 'info', texte: `Contre-saison : **${oppDep.potentiel_contre_saison_ha === null ? 'surface non disponible' : `${nombre(oppDep.potentiel_contre_saison_ha)} ha`}**, ${oppDep.categorie_eau}` }
        : { etat: 'info', texte: `Contre-saison : ${oppDep.categorie_eau}` },
    gainDep ? { etat: 'info', texte: `Gain de rendement : **+${nombre(gainDep.potentiel_gain_kg_ha)} kg/ha** (${libelle(gainDep.culture).toLowerCase()})` } : { etat: 'info', texte: `Gain de rendement${pourCulture} : non repéré ici` },
    { etat: 'info', texte: RAPPEL },
  ] : [
    eau[0] ? { etat: 'info', texte: `Contre-saison : d’abord **${eau[0].departement}**${eau[0].potentiel_contre_saison_ha === null ? '' : `, ${nombre(eau[0].potentiel_contre_saison_ha)} ha`}` } : { etat: 'info', texte: 'Contre-saison : non disponible' },
    gains[0] ? { etat: 'info', texte: `Gain de rendement : d’abord **${gains[0].departement}** (${libelle(gains[0].culture).toLowerCase()}), +${nombre(gains[0].potentiel_gain_kg_ha)} kg/ha` } : { etat: 'info', texte: `Gain de rendement${pourCulture} : non disponible` },
    { etat: 'info', texte: RAPPEL },
  ]
  const cleLignes = lignes.map((l) => l.texte).join('|')

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(opportunites?.map((o) => [o.code_departement, o]))
    return {
      aEcouter: aLire(titre, lignes),
      resume: titre,
      vue: {
        ambiance: 'jour', camera: cadrer.pays(cadre, { inclinaison: 35, cap: 0 }), zones: null, relief: false, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [],
        departements: opportunites ? new Map(cadre.ref.departements.map((d) => {
          const o = parCode.get(d.code_departement)
          return [d.code_departement, { couleur: o?.couleur_carte ? COULEURS_OPPORTUNITE[o.couleur_carte] : NON_DISPONIBLE }]
        })) : null,
      },
      legende: opportunites ? <Categories titre="Carte des opportunités" entrees={LEGENDE_OPPORTUNITES} /> : undefined,
      infobulle: (c) => {
        const o = parCode.get(c)
        const g = gains.find((x) => x.code_departement === c)
        const nom = cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c
        return { titre: nom, lignes: [
          o ? `Eau : ${o.categorie_eau}${o.couleur_carte === 'bleu' && o.potentiel_contre_saison_ha !== null ? `, ${nombre(o.potentiel_contre_saison_ha)} ha` : ''}` : 'Eau : non disponible',
          g ? `Gain de rendement : +${nombre(g.potentiel_gain_kg_ha)} kg/ha (${libelle(g.culture).toLowerCase()})` : 'Gain de rendement : non repéré',
        ] }
      },
      etape: {
        titre, question: questionOng('potentiel'), lignes, legende: { titre: 'Carte des opportunités', entrees: LEGENDE_OPPORTUNITES },
        tableau: { colonnes: ['Rang', 'Contre-saison', 'Hectares', 'Gain de rendement', 'kg/ha'], lignes: Array.from({ length: Math.min(10, Math.max(eau.length, gains.length)) }, (_, i) => [
          String(i + 1), eau[i]?.departement ?? '—', eau[i]?.potentiel_contre_saison_ha == null ? '—' : nombre(eau[i].potentiel_contre_saison_ha),
          gains[i] ? `${gains[i].departement} · ${libelle(gains[i].culture).toLowerCase()}` : '—', gains[i] ? `+${nombre(gains[i].potentiel_gain_kg_ha)}` : '—']) },
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lignes` est résumé par `cleLignes`
  }, [opportunites, gains, eau, code, cadre, titre, cleLignes])
  usePublier(publier, sortie)

  const maxHa = eau[0]?.potentiel_contre_saison_ha ?? 0
  const maxGain = gains[0]?.potentiel_gain_kg_ha ?? 0

  return (
    <FicheReponse cadre={cadre} mode="potentiel" cle={`${code}-${culture}`} titre={titre} lignes={lignes} aEcouter={sortie.aEcouter}
      teinte={nomDep ? undefined : COULEURS_OPPORTUNITE.bleu}
      puces={[puceCulture(cadre, cultures, culture, 'Toutes')]}
      etat={<>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">Deux repérages côte à côte, jamais additionnés : l'eau disponible en saison sèche, et l'écart entre rendement atteignable et rendement moyen.</p>
        {(chargeOpp || !territoires) && <Squelette lignes={3} />}
      </>}
      detail={<>
        <Groupe titre="Contre-saison : eau mobilisable" complement={opportunites === null ? 'non disponible' : `${eau.length} départements`}>
          {opportunites === null ? <p className="text-xs text-white/60">La carte des opportunités n'est pas encore construite : non disponible.</p> : (
            <ol>{eau.map((o) => <Rang key={o.code_departement} rang={o.rang_opportunite_eau ?? undefined} nom={`${o.departement} · ${o.categorie_eau}`} part={maxHa && o.potentiel_contre_saison_ha !== null ? (100 * o.potentiel_contre_saison_ha) / maxHa : null}
              couleur={COULEURS_OPPORTUNITE.bleu} valeur={o.potentiel_contre_saison_ha === null ? 'non disponible' : `${nombre(o.potentiel_contre_saison_ha)} ha`} actif={o.code_departement === code} onClick={() => cadre.choisir(o.code_departement)} />)}</ol>
          )}
        </Groupe>
        <Groupe titre={`Gain de rendement${pourCulture} : culture « adaptée »`} complement={`${gains.length} couples département × culture`}>
          <ol>{gains.slice(0, 30).map((g, i) => <Rang key={`${g.code_departement}-${g.culture}`} rang={i + 1} nom={`${g.departement} · ${libelle(g.culture).toLowerCase()}`} part={maxGain ? (100 * g.potentiel_gain_kg_ha!) / maxGain : null}
            couleur={COULEURS_OPPORTUNITE.vert} valeur={`+${nombre(g.potentiel_gain_kg_ha)} kg/ha`} actif={g.code_departement === code} onClick={() => cadre.choisir(g.code_departement)} />)}</ol>
          {gains.length > 30 && <p className="mt-2 text-2xs text-white/60">Et {gains.length - 30} autres.</p>}
        </Groupe>
        <Methode>
          <p>Contre-saison : départements « bleus » de la carte des opportunités (eau de surface peu exploitée ou nappe accessible), classés par rang d'opportunité eau ; surface en hectares de la carte.</p>
          <p>Gain de rendement : écart entre rendement atteignable et rendement moyen de la zone agroécologique (valeur de zone, non additive), seulement là où il est évalué (pas de rendement national recopié) et où la culture est « adaptée ». Il ne distingue pas les départements d'une même zone.</p>
          <p>{RAPPEL}.</p>
        </Methode>
      </>} />
  )
}
