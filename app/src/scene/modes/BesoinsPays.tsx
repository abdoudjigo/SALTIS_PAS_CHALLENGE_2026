// Organisation — « Besoins » : combien de semences ou d'engrais par département, et où la dose manque.
import { useMemo, useState } from 'react'
import { useTerritoires } from '../../hooks/donnees'
import { libelle, nombre, tonnes } from '../../lib/format'
import { besoinsParDepartement } from '../besoinsPays'
import { cadrer, usePublier, type PropsMode, type Sortie } from '../cadre'
import { couleurQuantite, NON_DISPONIBLE } from '../couleurs'
import { cleZone, ZONES } from '../geo'
import { dire } from '../lecture'
import { Avis, Champ, Cle, Degrade, Detail, Groupe, Methode, Rang, Reponse, Squelette } from '../ui'

export default function BesoinsPays({ cadre, publier }: PropsMode) {
  const { data: territoires } = useTerritoires()
  const intrants = cadre.ref.intrants
  const [codeIntrant, setIntrant] = useState(intrants.find((i) => i.colonne_besoin === 'besoin_semences_retenu_t')?.code_intrant ?? intrants[0]?.code_intrant)
  const [culture, setCulture] = useState<string | null>(null)
  const intrant = intrants.find((i) => i.code_intrant === codeIntrant) ?? intrants[0]
  const code = cadre.selection

  const cultures = useMemo(() => [...new Set(territoires?.map((t) => t.culture))].sort(), [territoires])
  const besoins = useMemo(() => (territoires && intrant ? besoinsParDepartement(territoires, intrant.colonne_besoin, culture) : []), [territoires, intrant, culture])
  const connus = useMemo(() => besoins.filter((b) => b.besoin_t !== null).sort((a, b) => b.besoin_t! - a.besoin_t!), [besoins])
  const total = connus.reduce((a, b) => a + b.besoin_t!, 0)
  const sansDose = besoins.reduce((a, b) => a + b.sansDose, 0)
  const max = connus[0]?.besoin_t ?? 0
  const parZone = ZONES.map((z) => ({ ...z, besoin: connus.filter((b) => cleZone(b.zone) === z.cle).reduce((a, b) => a + b.besoin_t!, 0) })).filter((z) => z.besoin > 0).sort((a, b) => b.besoin - a.besoin)
  const nom = intrant?.nom_intrant.toLowerCase() ?? 'intrant'

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(besoins.map((b) => [b.code, b]))
    const t = (x: number) => dire.kg(x * 1000)
    const choisi = code ? parCode.get(code) : undefined
    const depChoisi = code ? cadre.ref.departements.find((d) => d.code_departement === code)?.departement : undefined
    const aEcouter = !territoires ? undefined : [
      ...(choisi && depChoisi ? [choisi.besoin_t === null ? `${depChoisi} : besoin en ${nom} non calculé, dose à saisir.` : `${depChoisi} : besoin en ${nom} de ${t(choisi.besoin_t)}.`] : []),
      connus.length ? `Besoin total en ${nom}${culture ? ` pour ${libelle(culture).toLowerCase()}` : ''} : ${t(total)}, sur ${connus.length} départements.` : `Le besoin en ${nom} n'est pas encore calculé : les doses sont à saisir.`,
      ...(connus.length ? [`Les plus gros besoins : ${connus.slice(0, 3).map((b) => `${cadre.ref.departements.find((d) => d.code_departement === b.code)?.departement ?? b.code}, ${t(b.besoin_t!)}`).join(' ; ')}.`] : []),
      ...(parZone[0] ? [`Zone la plus demandeuse : ${parZone[0].nom}, avec ${t(parZone[0].besoin)}.`] : []),
      ...(sansDose ? [`Attention : ${sansDose} couple${sansDose > 1 ? 's' : ''} département et culture n'${sansDose > 1 ? 'ont' : 'a'} pas encore de dose. Le total est donc partiel.`] : []),
      'Ce sont des besoins de référence, calculés sur les superficies habituelles, pas des besoins prévisionnels.',
    ]
    return {
      aEcouter,
      resume: connus.length ? `${tonnes(total)} de ${nom} · ${connus.length} départements` : `Besoin en ${nom} non calculé`,
      vue: {
        ambiance: 'jour', camera: cadrer.pays(cadre, { inclinaison: 50, cap: 8 }), zones: null, relief: true, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0,
        departements: new Map(besoins.map((b) => [b.code, b.besoin_t === null || !max ? { couleur: NON_DISPONIBLE } : { couleur: couleurQuantite(Math.sqrt(b.besoin_t / max)), hauteur: 4000 + 75000 * Math.sqrt(b.besoin_t / max) }])),
      },
      legende: <Degrade titre={`Besoin en ${nom}`} gauche="faible" droite={tonnes(max)} degrade="linear-gradient(to right,#d5eadb,#5aa878,#12391f)" note="Gris : dose à saisir, besoin non calculé." />,
      infobulle: (c) => {
        const b = parCode.get(c)
        const dep = cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c
        if (!b) return { titre: dep, lignes: ['Pas de superficie de référence'] }
        return { titre: dep, lignes: [b.besoin_t === null ? 'Dose à saisir : besoin non calculé' : `Besoin : ${tonnes(b.besoin_t)}`, ...(b.sansDose && b.besoin_t !== null ? [`${b.sansDose} culture(s) sans dose connue`] : [])] }
      },
    }
  }, [besoins, connus, total, max, code, cadre, nom, territoires, culture, parZone, sansDose])
  usePublier(publier, sortie)

  return (
    <div>
      <Reponse cle={`${codeIntrant}-${culture}`} titre={`Besoin en ${nom}`} phrase={`${culture ? libelle(culture) : 'Toutes cultures'}. Les 3 plus gros besoins ci-dessous.`}>
        <Cle valeur={territoires ? (connus.length ? nombre(total) : '—') : '—'} unite={connus.length ? 't' : undefined} libelle="besoin total connu" />
        <Cle valeur={territoires ? connus.length : '—'} unite="dép." libelle="avec un besoin calculé" />
        <Cle valeur={territoires ? nombre(sansDose) : '—'} libelle="doses à saisir" teinte={sansDose ? 'var(--color-soleil-500)' : undefined} />
      </Reponse>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Champ libelle="Intrant">
          <select className="champ-scene" value={codeIntrant} onChange={(e) => setIntrant(e.target.value)}>
            {intrants.map((i) => <option key={i.code_intrant} value={i.code_intrant}>{i.nom_intrant}</option>)}
          </select>
        </Champ>
        <Champ libelle="Culture">
          <select className="champ-scene" value={culture ?? ''} onChange={(e) => setCulture(e.target.value || null)}>
            <option value="">Toutes</option>
            {cultures.map((c) => <option key={c} value={c}>{libelle(c)}</option>)}
          </select>
        </Champ>
      </div>
      {!territoires && <Squelette lignes={6} />}
      {territoires && !connus.length && <Avis>Aucune dose connue pour ce choix : le besoin n'est pas calculé. Il n'est pas nul.</Avis>}

      {connus.length > 0 && <ol className="mt-4">{connus.slice(0, 3).map((b, i) => <Rang key={b.code} rang={i + 1} nom={b.departement} part={(100 * b.besoin_t!) / max} couleur="var(--color-vert-500)" valeur={tonnes(b.besoin_t)} actif={b.code === code} onClick={() => cadre.choisir(b.code)} />)}</ol>}

      {connus.length > 0 && <Detail libelle="Voir par zone et par département">
      {parZone.length > 0 && (
        <Groupe titre="Par zone agroécologique">
          <ol>{parZone.map((z) => <Rang key={z.cle} nom={z.nom} part={(100 * z.besoin) / total} couleur={z.couleur} valeur={tonnes(z.besoin)} />)}</ol>
        </Groupe>
      )}

      {connus.length > 0 && (
        <Groupe titre="Par département" complement={`${connus.length}`} replie={false}>
          <ol>
            {connus.map((b, i) => <Rang key={b.code} rang={i + 1} nom={b.departement} part={(100 * b.besoin_t!) / max} couleur="var(--color-vert-500)" valeur={tonnes(b.besoin_t)} actif={b.code === code} onClick={() => cadre.choisir(b.code)} />)}
          </ol>
        </Groupe>
      )}
      </Detail>}

      <Methode>
        <p>Besoins de référence historiques (superficies de référence × doses de la zone), pas prévisionnels.</p>
        <p>Les sommes par zone additionnent les départements. Une dose inconnue reste « à saisir », jamais zéro : {nombre(sansDose)} couples département × culture sont dans ce cas.</p>
        <p>Semences du riz pluvial de Casamance exclues (dose de repiquage irrigué non applicable).</p>
      </Methode>
    </div>
  )
}
