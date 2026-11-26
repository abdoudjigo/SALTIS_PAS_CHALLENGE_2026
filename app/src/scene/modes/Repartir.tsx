// ONG, étape 5 — « Comment répartir mon stock, et livrer quand ? ». L'organisation saisit son stock (tonnes ou sacs),
// choisit un scénario nommé (Proportionnel, Urgence, Production : règles dans repartition.ts), et lit pour chaque
// département la quantité proposée et la date limite de livraison (début de la décade de semis conseillée, modèle 4).
// Sans stock saisi, rien n'est calculé (aucune valeur inventée). Une part ne dépasse jamais le besoin ; le reste non
// distribué est affiché. Fumier exclu (non chiffré).
import { useId, useMemo, useState } from 'react'
import { useCadreHarmonise, usePrixIntrants, useTerritoires } from '../../hooks/donnees'
import { libelle, nombre, pct, tonnes } from '../../lib/format'
import { lireSaisie } from '../../lib/saisie'
import type { LigneTerritoireAgrodistrib } from '../../types/marts'
import { besoinsParDepartement, culturePrincipale } from '../regles/besoinsPays'
import { cadrer, questionOng, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { chCompte } from '../regles/cadreHarmonise'
import type { Arc } from '../carte/Carte'
import { couleurCouverture, NON_DISPONIBLE } from '../carte/couleurs'
import { useDossier } from '../ong/dossier'
import { aLire, puceAnnee, puceChoix, puceCulture, type LigneCheck, type Puce } from '../interface/fiche'
import { FicheReponse } from '../interface/FicheReponse'
import { ColonnesDepartements, TableauDeBord } from '../interface/TableauDeBord'
import type { LonLat } from '../carte/geo'
import { budget, deIntrant, fcfa, intrantOng, nomIntrant, prixRetenu, puceIntrant, sacsDeTonnes, tonnesDeSacs, useDatesLimites } from '../ong/ong'
import { ARBITRAGES_NOMMES, enSacsEntiers, lignesMulticritere, METHODE, nomArbitrage, ordonner, prorataMulticritere, remplirDansLOrdre, SCENARIOS, VERSION, type Criteres } from '../regles/repartition'
import { Avis, Champ, Degrade, ErreurChamp, Groupe, Marque, Methode, Segments, Squelette } from '../interface/ui'
import { suivre } from '../../lib/mesure'

const DAKAR: LonLat = [-17.3, 14.74]
const SAISIR = 'Saisissez votre stock pour voir la répartition'

export default function Repartir({ cadre, publier }: PropsMode) {
  const a = useAnnee(cadre, 'M4')
  const { annee } = a
  const { data: territoires } = useTerritoires()
  const { data: ch } = useCadreHarmonise()
  const { data: listePrix } = usePrixIntrants()
  const { dossier, majDossier } = useDossier()
  const idTableau = useId()
  // Le dépôt : un clic sur la carte hors d'un département le déplace
  const [depot, setDepot] = useState<LonLat>(DAKAR)
  const intrant = intrantOng(cadre.ref, dossier)
  const code = cadre.selection
  const cultures = useMemo(() => [...new Set(territoires?.map((t) => t.culture))].sort(), [territoires])
  const culture = cadre.culture && cultures.includes(cadre.culture) ? cadre.culture : null
  const nom = nomIntrant(intrant)
  const scenario = SCENARIOS.find((s) => s.id === dossier.scenario) ?? SCENARIOS[0]
  const sacs = dossier.unite === 'sacs'
  const nomDep = (c: string) => cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c
  const quantite = (t: number) => (sacs ? `${nombre(Math.round(t * 20))} sacs` : tonnes(t))

  const besoins = useMemo(() => (territoires && intrant ? besoinsParDepartement(territoires, intrant.colonne_besoin, culture) : []), [territoires, intrant, culture])
  const demandes = useMemo(() => besoins.filter((b) => b.besoin_t !== null && b.besoin_t > 0).map((b) => ({ code: b.code, besoin_t: b.besoin_t!, vulnerabilite: b.vulnerabilite })), [besoins])
  const besoinTotal = demandes.reduce((s, d) => s + d.besoin_t, 0)
  // Scénario Multicritère : couples département × culture, comme le moteur ml/agrodistrib
  const lignesMulti = useMemo(() => (territoires && intrant ? lignesMulticritere(territoires, intrant.colonne_besoin, culture) : []), [territoires, intrant, culture])
  const sansDose = besoins.reduce((s, b) => s + b.sansDose, 0)

  // La culture de chaque département : la culture choisie, sinon celle de plus grande superficie (besoin connu > 0)
  const lignesCulture = useMemo(() => {
    if (!territoires || !intrant) return new Map<string, LigneTerritoireAgrodistrib>()
    if (!culture) return culturePrincipale(territoires, intrant.colonne_besoin)
    return new Map(territoires.filter((t) => t.culture === culture).map((t) => [t.code_departement, t]))
  }, [territoires, intrant, culture])
  const cultureParDep = useMemo(() => new Map([...lignesCulture.entries()].filter(([c]) => demandes.some((d) => d.code === c)).map(([c, l]) => [c, l.culture])), [lignesCulture, demandes])
  const criteres = useMemo(() => {
    const parCode = new Map(ch?.map((l) => [l.code_departement, l]))
    return new Map<string, Criteres>(demandes.map((d) => {
      const l = parCode.get(d.code)
      const t = lignesCulture.get(d.code)
      // Même règle que l'étape 1 : le Cadre harmonisé ne classe que l'année de son cycle
      const compte = chCompte(l, annee)
      return [d.code, {
        phase: compte ? l?.phase_retenue ?? null : null, personnes_phase3_5: compte ? l?.population_phase3_5_retenue ?? null : null, vulnerabilite: d.vulnerabilite,
        potentiel_adapte: t && t.potentiel_evalue && t.meilleur_niveau_adequation === 'adaptée' ? t.potentiel_gain_kg_ha : null,
      }]
    }))
  }, [ch, demandes, lignesCulture, annee])

  // Le stock saisi (tonnes ou sacs) : plus de 0, au plus 1 000 000 t (20 000 000 sacs).
  // Sans saisie valide, aucune répartition n'est calculée ; une saisie invalide affiche son message sous le champ.
  const lectureStock = lireSaisie(dossier.stock, { min: 0, minExclu: true, max: sacs ? 20_000_000 : 1_000_000, unite: sacs ? 'sacs' : 't' })
  const lu = lectureStock.valeur
  const stock_t = lu !== null ? (sacs ? tonnesDeSacs(Math.floor(lu)) : lu) : null
  const resultat = useMemo(() => {
    if (stock_t === null) return null
    const r = scenario.id === 'proportionnel' ? prorataMulticritere(lignesMulti, stock_t, dossier.arbitrage) : remplirDansLOrdre(stock_t, ordonner(demandes, criteres, scenario.id))
    return sacs ? enSacsEntiers(r, stock_t) : r
  }, [scenario.id, stock_t, demandes, lignesMulti, dossier.arbitrage, criteres, sacs])
  const parts = useMemo(() => (!resultat ? [] : scenario.id === 'proportionnel' ? [...resultat.parts].sort((x, y) => y.quantite_t - x.quantite_t) : resultat.parts), [resultat, scenario.id])
  const reparti = parts.reduce((s, p) => s + p.quantite_t, 0)
  const couverture = resultat && besoinTotal ? (100 * reparti) / besoinTotal : null
  const entiers = parts.filter((p) => p.quantite_t > 0 && p.besoin_t - p.quantite_t <= 1e-6).length
  const partiels = parts.filter((p) => p.quantite_t > 0 && p.besoin_t - p.quantite_t > 1e-6).length
  const servis = entiers + partiels

  const { couverte, pret, dates, texte: dateDe } = useDatesLimites(cadre, annee, cultureParDep)
  const premiere = parts.filter((p) => p.quantite_t > 0 && dates.has(p.code)).sort((x, y) => dates.get(x.code)!.decade - dates.get(y.code)!.decade)[0]
  const prix = prixRetenu(listePrix, intrant?.code_intrant, annee, dossier.prix)
  const prixSac = prix.saisi ?? prix.cession

  const raison = (c: string) => {
    const k = criteres.get(c)
    if (scenario.id === 'urgence') return [`CH ${k?.phase == null ? 'non compté' : `phase ${k.phase}`}`, k?.personnes_phase3_5 == null ? null : `${nombre(k.personnes_phase3_5)} pers. phases 3-5`, `vulnérabilité ${k?.vulnerabilite == null ? 'non notée' : nombre(k.vulnerabilite)}`].filter(Boolean).join(' · ')
    if (scenario.id === 'production') return k?.potentiel_adapte == null ? 'culture non « adaptée » ou potentiel non évalué : servi par besoin' : `potentiel +${nombre(k.potentiel_adapte)} kg/ha (${libelle(cultureParDep.get(c)).toLowerCase()}, valeur de zone)`
    return `prorata multicritère · fragilité ${k?.vulnerabilite == null ? 'non notée (médiane)' : nombre(k.vulnerabilite)}`
  }
  // Sacs par département : entiers en unité « sacs », sinon au demi-sac supérieur (arrondi par département)
  const sacsDe = (t: number) => (sacs ? Math.round(t * 20) : sacsDeTonnes(t))
  const budgetDe = (t: number) => (t > 0 && prixSac !== null ? budget(sacsDe(t), prixSac) : null)
  const colonnes = ['Département', 'Besoin', 'Proposé', 'Part couverte', sacs ? 'Sacs' : 'Sacs (arrondi par département)', prix.saisi !== null ? 'Budget, prix saisi par vous' : 'Budget subventionné', 'Livrer avant le', 'Raison du rang']
  const tableau = parts.map((p) => [nomDep(p.code), quantite(p.besoin_t), quantite(p.quantite_t), pct(p.couverture_pct), nombre(sacsDe(p.quantite_t)),
    p.quantite_t > 0 ? (prixSac === null ? 'prix à saisir' : fcfa(budgetDe(p.quantite_t))) : '—', p.quantite_t > 0 ? dateDe(p.code) : '—', raison(p.code)])
  // Le total = la somme des lignes affichées
  const totalSacs = parts.reduce((s, p) => s + (p.quantite_t > 0 ? sacsDe(p.quantite_t) : 0), 0)
  const totalBudget = prixSac === null ? null : parts.reduce((s, p) => s + (budgetDe(p.quantite_t) ?? 0), 0)
  // Couverture affichée arrondie vers le bas partout : on ne surestime jamais ce que le stock couvre (38,7 % → 38 %)
  const couvertureAffichee = couverture === null ? null : couverture >= 100 ? 100 : Math.floor(couverture)
  const totaux = ['Total', quantite(besoinTotal), quantite(reparti), pct(couvertureAffichee), nombre(totalSacs), totalBudget === null ? 'prix à saisir' : fcfa(totalBudget), '', '']
  const cleTableau = tableau.map((l) => l.join(';')).join('|') + totaux.join(';')

  const titre = !territoires ? 'Répartir le stock' : !demandes.length ? `Rien à répartir en ${nom}` : !resultat ? SAISIR : `${quantite(reparti)} ${deIntrant(intrant)} pour ${servis} département${servis > 1 ? 's' : ''}`
  const lignes: LigneCheck[] = !demandes.length ? [] : !resultat ? [{ etat: 'info', texte: SAISIR }] : [
    { etat: (couverture ?? 0) >= 100 ? 'ok' : 'attention', texte: `Le stock couvre **${pct(couvertureAffichee)}** du besoin` },
    { etat: 'info', texte: `**${entiers}** département${entiers > 1 ? 's' : ''} servi${entiers > 1 ? 's' : ''} entièrement, ${partiels} partiellement` },
    !couverte ? { etat: 'info', texte: `Date limite non disponible pour ${annee}` }
      : !pret ? { etat: 'info', texte: 'Date limite : en cours de chargement' }
        : premiere ? { etat: 'info', texte: `À livrer en premier avant le **${dates.get(premiere.code)!.date}** (${nomDep(premiere.code)})` } : { etat: 'info', texte: 'Date limite non disponible' },
  ]
  const cleLignes = lignes.map((l) => l.texte).join('|')

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(resultat?.parts.map((p) => [p.code, p]))
    const max = Math.max(...(resultat?.parts ?? []).map((p) => p.quantite_t), 1e-9)
    const centres = new Map(cadre.ref.departements.map((d) => [d.code_departement, [d.longitude, d.latitude] as LonLat]))
    const arcs: Arc[] = (resultat?.parts ?? []).filter((p) => p.quantite_t > 0 && centres.has(p.code)).map((p) => ({ id: p.code, de: depot, vers: centres.get(p.code)!, poids: Math.sqrt(p.quantite_t / max) }))
    return {
      aEcouter: territoires ? aLire(titre, lignes) : undefined,
      surPoint: setDepot,
      resume: resultat && demandes.length ? `${quantite(reparti)} répartis · ${pct(couvertureAffichee)} du besoin` : demandes.length ? 'Stock à saisir' : 'Rien à répartir',
      vue: {
        ambiance: 'nuit', camera: cadrer.pays(cadre, { inclinaison: 60, cap: -24 }), zones: null, relief: true, selection: code, satellite: false, pluie: 0, arcs, alertes: [],
        reperes: [{ id: 'depot', position: depot, genre: 'depot', libelle: 'Dépôt du stock' }],
        departements: resultat ? new Map(cadre.ref.departements.map((d) => {
          const p = parCode.get(d.code_departement)
          return [d.code_departement, p ? { couleur: couleurCouverture(p.couverture_pct), hauteur: 3000 + 70000 * Math.sqrt(p.quantite_t / max) } : { couleur: NON_DISPONIBLE }]
        })) : null,
      },
      // Sur la scène : ce que le stock couvre, et la quantité proposée à chaque département
      tableauDeBord: territoires ? (
        <TableauDeBord titre={`Répartir ${stock_t !== null ? `${quantite(stock_t)} ${deIntrant(intrant)}` : 'le stock'} · scénario ${scenario.libelle.toLowerCase()}`} tuiles={resultat ? [
          { valeur: quantite(reparti), libelle: `répartis, sur un besoin de ${quantite(besoinTotal)}`, etat: 'info' },
          { valeur: pct(couvertureAffichee), libelle: 'du besoin couvert par le stock', etat: (couverture ?? 0) >= 100 ? 'ok' : 'attention' },
          { valeur: `${entiers} + ${partiels}`, libelle: 'départements servis entièrement + partiellement', etat: 'info' },
          { valeur: premiere && dates.has(premiere.code) ? dates.get(premiere.code)!.date : '—', libelle: premiere ? `première date limite de livraison (${nomDep(premiere.code)})` : 'date limite non disponible', etat: premiere ? 'attention' : 'info' },
        ] : [
          { valeur: demandes.length ? quantite(besoinTotal) : '—', libelle: 'besoin total à couvrir', etat: 'info' },
          { valeur: demandes.length, libelle: 'départements avec un besoin calculé', etat: 'info' },
          { valeur: 'à saisir', libelle: 'stock disponible (puce « Stock » de la fenêtre)', etat: 'attention' },
        ]}>
          {resultat ? (() => {
            const max = Math.max(...parts.map((p) => p.quantite_t), 1e-9)
            return (
              <ColonnesDepartements code={code} choisir={cadre.choisir} max={max}
                echelle={{ haut: quantite(max), bas: '0' }}
                consigne="Dans l'ordre du scénario. Survolez une barre pour lire un département ; cliquez pour le voir sur la carte."
                legende={<span className="inline-flex items-center gap-1"><span className="h-2 w-6 rounded-[2px]" style={{ background: 'linear-gradient(to right,#d2492f,#f2b544,#2f7d4f)' }} aria-hidden />besoin couvert, 0 à 100 %</span>}
                elements={parts.map((p) => ({ code: p.code, nom: nomDep(p.code), valeur: p.quantite_t, couleur: couleurCouverture(p.couverture_pct),
                  detail: `${quantite(p.quantite_t)} proposés sur ${quantite(p.besoin_t)} (${pct(p.couverture_pct)})${p.quantite_t > 0 ? ` · livrer avant le ${dateDe(p.code)}` : ''}` }))} />
            )
          })() : <p className="text-xs text-white/60">Saisissez votre stock dans la fenêtre : la répartition s'affiche ici, département par département.</p>}
        </TableauDeBord>
      ) : undefined,
      legende: resultat ? <Degrade titre="Besoin couvert" gauche="0 %" droite="100 %" degrade="linear-gradient(to right,#d2492f,#f2b544,#2f7d4f)" note="Hauteur : quantité proposée. Gris : pas de besoin calculé." /> : undefined,
      infobulle: (c) => {
        const p = parCode.get(c)
        if (!resultat) return null
        return { titre: nomDep(c), lignes: p ? [`Proposé : ${quantite(p.quantite_t)} sur ${quantite(p.besoin_t)}`, `Besoin couvert : ${pct(p.couverture_pct)}`, ...(p.quantite_t > 0 ? [`Livrer avant le ${dateDe(c)}`] : [])] : ['Pas de besoin calculé (dose à saisir ou culture absente)'] }
      },
      // Sans stock saisi : seulement le titre et la consigne, aucun chiffre inventé
      etape: {
        titre, question: questionOng('repartir'), lignes,
        ...(resultat ? { tableau: { colonnes, lignes: [...tableau, totaux] }, legende: { titre: 'Besoin couvert', entrees: [0, 50, 100].map((v) => ({ couleur: couleurCouverture(v), libelle: `${v} %` })) } } : {}),
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lignes` et `tableau` sont résumés par leurs clés ; `nomDep`, `quantite`, `dateDe` suivent les référentiels, l'unité et les dates
  }, [resultat, cadre, demandes.length, reparti, couverture, territoires, code, titre, cleLignes, cleTableau, sacs, dates, couverte, pret, depot, parts, besoinTotal, entiers, partiels, premiere, stock_t, scenario.libelle, intrant])
  usePublier(publier, sortie)

  const puceStock: Puce = {
    id: 'stock', nom: 'Stock', libelle: lectureStock.erreur ? 'Stock : à corriger' : stock_t === null ? 'Stock : à saisir' : `Stock : ${quantite(stock_t)}`,
    contenu: (fermer) => (
      <div className="space-y-2">
        <Champ libelle={`Stock disponible (${sacs ? 'sacs de 50 kg' : 'tonnes'})`}>
          <input className="champ-scene tabular-nums" inputMode="decimal" autoFocus placeholder="à saisir"
            value={dossier.stock} onChange={(e) => majDossier({ stock: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fermer() } }}
            aria-invalid={Boolean(lectureStock.erreur)} aria-describedby={lectureStock.erreur ? 'erreur-stock' : undefined} />
        </Champ>
        {lectureStock.erreur && <ErreurChamp id="erreur-stock" className="mt-0">Stock : {lectureStock.erreur}</ErreurChamp>}
        <Segments libelle="Unité" options={[{ id: 't', libelle: 'Tonnes' }, { id: 'sacs', libelle: 'Sacs' }]} valeur={dossier.unite} onChange={(u) => majDossier({ unite: u, stock: '' })} />
      </div>
    ),
  }
  const puces = [puceAnnee(cadre, a), puceCulture(cadre, cultures, culture, 'Toutes'), puceIntrant(cadre.ref, intrant, majDossier),
    puceChoix('scenario', 'Scénario', SCENARIOS.map((s) => ({ id: s.id, libelle: s.libelle })), scenario.id, (id) => { majDossier({ scenario: id }); suivre('scenario_choisi', { scenario: id }) }), puceStock]

  return (
    <FicheReponse cadre={cadre} mode="repartir" cle={`${code}-${intrant?.code_intrant}-${culture}-${annee}-${scenario.id}`} titre={titre} lignes={lignes} puces={puces} aEcouter={sortie.aEcouter}
      etat={<>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">Scénario {scenario.libelle.toLowerCase()} · une proposition, à ajuster puis valider par votre organisation.</p>
        {!territoires && <Squelette lignes={4} />}
        {territoires && !demandes.length && <Avis>Aucun besoin calculé pour ce choix (doses à saisir) : rien à répartir.</Avis>}
        {demandes.length > 0 && !resultat && <p className="mt-2 text-sm text-white/70">Besoin connu : {quantite(besoinTotal)} sur {demandes.length} départements. Indiquez votre stock dans la puce « Stock ».</p>}
        {resultat && resultat.reste_t > 1e-6 && <Avis>Reste non distribué : {quantite(resultat.reste_t)}{sacs ? ' (arrondi aux sacs entiers compris)' : ' (le stock dépasse le besoin connu)'}.</Avis>}
          {scenario.id === 'proportionnel' && (
            <label className="mt-3 block text-2xs text-white/60">
              <span className="flex justify-between"><span>Arbitrage : fragilité ↔ récolte attendue par hectare</span><span className="text-sm font-medium text-white tabular-nums">{nomArbitrage(dossier.arbitrage)}</span></span>
              <input type="range" className="glissiere mt-1 block h-11 w-full" min={0} max={100} step={5} value={dossier.arbitrage} onChange={(e) => majDossier({ arbitrage: Number(e.target.value) })} />
              <span className="flex justify-between text-white/60">{ARBITRAGES_NOMMES.map((a) => <button key={a.valeur} type="button" className="min-h-11 underline-offset-4 hover:underline" onClick={() => majDossier({ arbitrage: a.valeur })}>{a.libelle}</button>)}</span>
            </label>
          )}
      </>}
      detail={demandes.length ? <>
        <Groupe titre={`Règle du scénario ${scenario.libelle.toLowerCase()}`}>
          <p className="text-sm leading-relaxed text-white/75">{scenario.regle}</p>
          {scenario.id === 'urgence' && !ch && <p className="mt-2 text-xs text-white/60">Cadre harmonisé non disponible : l'ordre suit la fragilité.</p>}
        </Groupe>
        {resultat && (
          <Groupe id={idTableau} titre="La répartition, département par département" complement={`${servis} servis sur ${demandes.length}`}>
            <div className="-mx-1 overflow-x-auto">
              <table aria-labelledby={idTableau} className="w-max min-w-full text-left text-xs text-white/80 tabular-nums">
                <thead><tr className="border-b border-white/[0.09] text-2xs text-white/60">{colonnes.map((c) => <th key={c} scope="col" className="px-1 py-1.5 font-medium">{c}</th>)}</tr></thead>
                <tbody>
                  {tableau.map((l, i) => (
                    <tr key={parts[i].code} className={parts[i].code === code ? 'bg-white/[0.09]' : undefined}>
                      {l.map((v, j) => j === 0
                        ? <th key={j} scope="row" className="px-1 font-medium text-white"><button type="button" className="min-h-11 text-left hover:underline" aria-current={parts[i].code === code ? 'true' : undefined} onClick={() => cadre.choisir(parts[i].code)}>{v}</button></th>
                        : <td key={j} className="px-1 py-1.5">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t border-white/[0.09] font-semibold text-white">{totaux.map((v, j) => (j === 0 ? <th key={j} scope="row" className="px-1 py-1.5">{v}</th> : <td key={j} className="px-1 py-1.5">{v}</td>))}</tr></tfoot>
              </table>
            </div>
            {!sacs && <p className="mt-2 text-2xs text-white/60">Sacs arrondis au demi-sac supérieur, département par département ; le total est la somme des lignes.</p>}
            {prix.saisi !== null && <p className="mt-2 flex items-center gap-2 text-2xs text-white/60"><Marque>saisi par vous</Marque>Budget calculé à votre prix d'achat.</p>}
            {prixSac === null && <p className="mt-2 text-2xs text-white/60">Prix {deIntrant(intrant)} à saisir (étape « Combien faut-il ? ») : budget non calculé.</p>}
          </Groupe>
        )}
        <Methode>
          <p>Proposition indicative ({scenario.id === 'proportionnel' ? `${METHODE}, version ${VERSION}` : `remplissage dans l'ordre, scénario ${scenario.libelle.toLowerCase()}`}), calculée sur les besoins de référence. Une part ne dépasse jamais le besoin ; le reste non distribué est affiché.{sacs ? ' En sacs : chaque part est arrondie au sac entier inférieur.' : ''}</p>
          <p>Date limite : premier jour de la période de 10 jours de semis conseillée par l’estimation 4 pour {culture ? libelle(culture).toLowerCase() : 'la culture de plus grande superficie de chaque département'} ({annee}). Aucun délai logistique n'est ajouté. Six appels au estimation 4 au plus : au-delà, « hors des cultures interrogées ». Culture non couverte par l’estimation 4 ou année hors de l’estimation : « non disponible ».</p>
          <p>Potentiel de gain (scénario Production) : valeur de la zone agroécologique, non additive, seulement là où il est évalué et la culture « adaptée ».</p>
          {sansDose > 0 && <p>{sansDose} couples département × culture sans dose connue ne reçoivent rien : leur besoin n'est pas calculé, il n'est pas nul.</p>}
          <p>Besoin connu : {quantite(besoinTotal)} sur {demandes.length} départements. Dépôt : Dakar au départ ; touchez la carte hors d'un département pour le déplacer.</p>
        </Methode>
      </> : undefined} />
  )
}
