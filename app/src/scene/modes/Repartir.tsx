// Organisation — « Répartir un stock » : on pose le dépôt sur la carte, on indique la quantité,
// la solution propose une part par département et la trace en arcs depuis le dépôt.
import { useMemo, useState } from 'react'
import { useTerritoires } from '../../hooks/donnees'
import { libelle, nombre, pct, tonnes } from '../../lib/format'
import { lireNombre } from '../../lib/saisie'
import { besoinsParDepartement } from '../besoinsPays'
import { cadrer, usePublier, type PropsMode, type Sortie } from '../cadre'
import type { Arc } from '../Carte'
import { couleurCouverture, NON_DISPONIBLE } from '../couleurs'
import type { LonLat } from '../geo'
import { METHODE, repartir, VERSION } from '../repartition'
import { dire } from '../lecture'
import { Avis, Champ, Cle, Degrade, ErreurChamp, Groupe, Methode, Rang, Reponse, Squelette, Detail } from '../ui'

const DAKAR: LonLat = [-17.3, 14.74]

export default function Repartir({ cadre, publier }: PropsMode) {
  const { data: territoires } = useTerritoires()
  const intrants = cadre.ref.intrants
  const [codeIntrant, setIntrant] = useState(intrants.find((i) => i.colonne_besoin === 'besoin_semences_retenu_t')?.code_intrant ?? intrants[0]?.code_intrant)
  const [culture, setCulture] = useState<string | null>(null)
  const [saisie, setSaisie] = useState('')
  const [priorite, setPriorite] = useState(40)
  const [depot, setDepot] = useState<LonLat>(DAKAR)
  const intrant = intrants.find((i) => i.code_intrant === codeIntrant) ?? intrants[0]

  const cultures = useMemo(() => [...new Set(territoires?.map((t) => t.culture))].sort(), [territoires])
  const besoins = useMemo(() => (territoires && intrant ? besoinsParDepartement(territoires, intrant.colonne_besoin, culture) : []), [territoires, intrant, culture])
  const demandes = useMemo(() => besoins.filter((b) => b.besoin_t !== null && b.besoin_t > 0).map((b) => ({ code: b.code, besoin_t: b.besoin_t!, vulnerabilite: b.vulnerabilite })), [besoins])
  const besoinTotal = demandes.reduce((a, d) => a + d.besoin_t, 0)
  const sansDose = besoins.reduce((a, b) => a + b.sansDose, 0)
  // Sans saisie : un stock qui couvre le quart du besoin, pour que la carte parle tout de suite
  // Stock tapé : plus de 0, au plus 1 000 000 t. Saisie invalide : rien n'est réparti et un message l'explique
  const lectureStock = lireNombre(saisie, { min: 0, minExclu: true, max: 1_000_000, unite: 't' })
  const stock = lectureStock.vide ? Math.round(besoinTotal * 0.25) : (lectureStock.valeur ?? 0)
  const resultat = useMemo(() => repartir(stock, demandes, priorite / 100), [stock, demandes, priorite])
  const parts = useMemo(() => [...resultat.parts].sort((a, b) => b.quantite_t - a.quantite_t), [resultat])
  const reparti = parts.reduce((a, p) => a + p.quantite_t, 0)
  const couverture = besoinTotal ? (100 * reparti) / besoinTotal : null
  const servis = parts.filter((p) => p.quantite_t > 0).length
  const nom = (code: string) => cadre.ref.departements.find((d) => d.code_departement === code)?.departement ?? code
  const moinsCouverts = [...parts].sort((a, b) => a.couverture_pct - b.couverture_pct).slice(0, 4)
  const maxPart = parts[0]?.quantite_t ?? 0

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(resultat.parts.map((p) => [p.code, p]))
    const max = Math.max(...resultat.parts.map((p) => p.quantite_t), 1e-9)
    const centres = new Map(cadre.ref.departements.map((d) => [d.code_departement, [d.longitude, d.latitude] as LonLat]))
    const arcs: Arc[] = resultat.parts.filter((p) => p.quantite_t > 0 && centres.has(p.code)).map((p) => ({ id: p.code, de: depot, vers: centres.get(p.code)!, poids: Math.sqrt(p.quantite_t / max) }))
    const t = (x: number) => dire.kg(x * 1000)
    const nomIntrant = intrant?.nom_intrant.toLowerCase() ?? 'intrant'
    const aEcouter = !territoires ? undefined : !demandes.length
      ? [`Rien à répartir : le besoin en ${nomIntrant} n'est pas calculé, faute de dose connue.`]
      : [
          `Stock de ${t(stock)} de ${nomIntrant}, réparti entre ${servis} départements : ${dire.pct(couverture)} du besoin couvert.`,
          `Les plus grosses parts : ${parts.slice(0, 3).map((x) => `${nom(x.code)}, ${t(x.quantite_t)}`).join(' ; ')}.`,
          `Les moins couverts : ${moinsCouverts.slice(0, 3).map((x) => `${nom(x.code)}, ${dire.pct(x.couverture_pct)}`).join(' ; ')}.`,
          `Proposition calculée au prorata des besoins, avec ${priorite} pour cent de priorité à la vulnérabilité. Une part ne dépasse jamais le besoin. À valider par votre organisation.`,
        ]
    return {
      aEcouter,
      surPoint: setDepot,
      resume: demandes.length ? `${tonnes(reparti)} répartis · ${pct(couverture)} du besoin` : 'Rien à répartir',
      vue: {
        ambiance: 'nuit', camera: cadrer.pays(cadre, { inclinaison: 60, cap: -24 }), zones: null, relief: true, selection: null, satellite: false, pluie: 0, arcs,
        reperes: [{ id: 'depot', position: depot, genre: 'depot', libelle: 'Dépôt du stock' }],
        departements: new Map(cadre.ref.departements.map((d) => {
          const p = parCode.get(d.code_departement)
          return [d.code_departement, p ? { couleur: couleurCouverture(p.couverture_pct), hauteur: 3000 + 70000 * Math.sqrt(p.quantite_t / max) } : { couleur: NON_DISPONIBLE }]
        })),
      },
      legende: <Degrade titre="Besoin couvert" gauche="0 %" droite="100 %" degrade="linear-gradient(to right,#d2492f,#f2b544,#2f7d4f)" note="Hauteur : quantité proposée. Gris : pas de besoin calculé." />,
      infobulle: (c) => {
        const p = parCode.get(c)
        return { titre: nom(c), lignes: p ? [`Proposé : ${tonnes(p.quantite_t)} sur ${tonnes(p.besoin_t)}`, `Besoin couvert : ${pct(p.couverture_pct)}`] : ['Pas de besoin calculé (dose à saisir ou culture absente)'] }
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `nom` ne dépend que des référentiels
  }, [resultat, depot, cadre, demandes.length, reparti, couverture, territoires, intrant, stock, servis, parts, moinsCouverts, priorite])
  usePublier(publier, sortie)

  return (
    <div>
      <Reponse titre="Du dépôt aux départements" phrase="Une proposition, à ajuster. Touchez la carte pour déplacer le dépôt.">
        <Cle valeur={demandes.length ? nombre(reparti) : '—'} unite="t" libelle={`répartis sur ${tonnes(stock)}`} />
        <Cle valeur={couverture === null ? '—' : nombre(couverture)} unite="%" libelle="du besoin connu couvert" teinte={couverture === null ? undefined : couleurCouverture(couverture)} />
        <Cle valeur={demandes.length ? servis : '—'} unite="dép." libelle="servis" />
      </Reponse>

      <div className="mt-4 grid grid-cols-[1fr_6rem] gap-2">
        <Champ libelle="Intrant">
          <select className="champ-scene" value={codeIntrant} onChange={(e) => setIntrant(e.target.value)}>
            {intrants.map((i) => <option key={i.code_intrant} value={i.code_intrant}>{i.nom_intrant}</option>)}
          </select>
        </Champ>
        <Champ libelle="Stock (t)">
          <input className="champ-scene tabular-nums" inputMode="decimal" placeholder={String(Math.round(besoinTotal * 0.25))} value={saisie} onChange={(e) => setSaisie(e.target.value)}
            aria-invalid={Boolean(lectureStock.erreur)} aria-describedby={lectureStock.erreur ? 'erreur-stock' : undefined} />
        </Champ>
        {lectureStock.erreur && <ErreurChamp id="erreur-stock" className="col-span-2 mt-0">Stock : {lectureStock.erreur}</ErreurChamp>}
        <Champ libelle="Culture visée" className="col-span-2">
          <select className="champ-scene" value={culture ?? ''} onChange={(e) => setCulture(e.target.value || null)}>
            <option value="">Toutes les cultures</option>
            {cultures.map((c) => <option key={c} value={c}>{libelle(c)}</option>)}
          </select>
        </Champ>
      </div>
      <label className="mt-3 block text-2xs text-white/60">
        <span className="flex justify-between"><span>Priorité à la vulnérabilité</span><span className="text-sm font-medium text-white tabular-nums">{priorite} %</span></span>
        <input type="range" className="glissiere mt-1 block h-6 w-full" min={0} max={100} step={5} value={priorite} onChange={(e) => setPriorite(Number(e.target.value))} />
        <span className="flex justify-between text-white/60"><span>prorata des besoins</span><span>les plus vulnérables d'abord</span></span>
      </label>

      {!territoires && <Squelette lignes={5} />}
      {territoires && !demandes.length && <Avis>Aucun besoin calculé pour ce choix (doses à saisir) : rien à répartir.</Avis>}
      {resultat.reste_t > 0.5 && <Avis>Le stock dépasse le besoin connu : {tonnes(resultat.reste_t)} ne sont pas répartis.</Avis>}

      {demandes.length > 0 && (
        <Detail libelle="Voir la répartition par département">
          <Groupe titre="Là où le manque reste le plus fort">
            <ol>{moinsCouverts.map((p) => <Rang key={p.code} nom={nom(p.code)} part={p.couverture_pct} couleur={couleurCouverture(p.couverture_pct)} valeur={`−${tonnes(p.besoin_t - p.quantite_t)}`} />)}</ol>
          </Groupe>
          <Groupe titre="Parts proposées" complement={`${servis} départements`} replie>
            <ol>{parts.filter((p) => p.quantite_t > 0).map((p, i) => <Rang key={p.code} rang={i + 1} nom={nom(p.code)} part={maxPart ? (100 * p.quantite_t) / maxPart : null} couleur={couleurCouverture(p.couverture_pct)} valeur={tonnes(p.quantite_t)} />)}</ol>
          </Groupe>
        </Detail>
      )}

      <Methode>
        <p>Proposition indicative ({METHODE}, version {VERSION}), calculée sur les besoins de référence. Une part ne dépasse jamais le besoin.</p>
        {sansDose > 0 && <p>{sansDose} couples département × culture sans dose connue ne reçoivent rien : leur besoin n'est pas calculé, il n'est pas nul.</p>}
        <p>Besoin connu : {tonnes(besoinTotal)} sur {demandes.length} départements. L'enregistrement et la validation des scénarios viendront avec la base de l'application.</p>
      </Methode>
    </div>
  )
}
