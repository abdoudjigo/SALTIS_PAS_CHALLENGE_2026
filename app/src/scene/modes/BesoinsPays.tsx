// ONG, étape 4 — « Combien faut-il, et pour quel budget ? » : le besoin d'un intrant en sacs et en tonnes,
// son budget au prix subventionné et au coût réel (dim_prix_intrant), et la part des surfaces qui ont une dose connue.
// Prix absent (urée, DAP) : « à saisir » ; l'organisation peut saisir son prix d'achat (« saisi par vous »), gardé pour la
// session et repris dans l'export. Fumier : jamais dans les totaux ni le budget (non chiffré).
import { useMemo } from 'react'
import { usePrixIntrants, useTerritoires } from '../../hooks/donnees'
import { libelle, nombre, pct, tonnes } from '../../lib/format'
import { besoinsParDepartement, partSurfaceAvecDose } from '../regles/besoinsPays'
import { cadrer, questionOng, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { couleurQuantite, NON_DISPONIBLE } from '../carte/couleurs'
import { aLire, puceAnnee, puceCulture, type LigneCheck } from '../interface/fiche'
import { FicheReponse } from '../interface/FicheReponse'
import { cleZone, ZONES } from '../carte/geo'
import { useDossier } from '../ong/dossier'
import { budget, deIntrant, fcfa, intrantOng, nomIntrant, prixRetenu, puceIntrant, sacsDeTonnes } from '../ong/ong'
import { Avis, Champ, Degrade, Groupe, Ligne, Lignes, Marque, Methode, Rang, Squelette } from '../interface/ui'

const STATUT_PRIX = { VALIDEE: 'validé', A_CONFIRMER: 'à confirmer', A_SAISIR: 'à saisir' } as const

export default function BesoinsPays({ cadre, publier }: PropsMode) {
  const a = useAnnee(cadre, 'M1')
  const { annee } = a
  const { data: territoires } = useTerritoires()
  const { data: listePrix } = usePrixIntrants()
  const { dossier, majDossier } = useDossier()
  const intrant = intrantOng(cadre.ref, dossier)
  const code = cadre.selection
  const cultures = useMemo(() => [...new Set(territoires?.map((t) => t.culture))].sort(), [territoires])
  const culture = cadre.culture && cultures.includes(cadre.culture) ? cadre.culture : null
  const nom = nomIntrant(intrant)

  const besoins = useMemo(() => (territoires && intrant ? besoinsParDepartement(territoires, intrant.colonne_besoin, culture) : []), [territoires, intrant, culture])
  const connus = useMemo(() => besoins.filter((b) => b.besoin_t !== null).sort((x, y) => y.besoin_t! - x.besoin_t!), [besoins])
  const total = connus.reduce((s, b) => s + b.besoin_t!, 0)
  const sansDose = besoins.reduce((s, b) => s + b.sansDose, 0)
  const max = connus[0]?.besoin_t ?? 0
  const parZone = ZONES.map((z) => ({ ...z, besoin: connus.filter((b) => cleZone(b.zone) === z.cle).reduce((s, b) => s + b.besoin_t!, 0) })).filter((z) => z.besoin > 0).sort((x, y) => y.besoin - x.besoin)
  const choisi = code ? besoins.find((b) => b.code === code) : undefined
  const depChoisi = code ? cadre.ref.departements.find((d) => d.code_departement === code)?.departement : undefined
  // Département choisi sans aucune ligne (Guédiawaye, Pikine ; ou culture absente) : jamais le total du pays sous son nom
  const sansSurface = Boolean(territoires && code && !choisi)
  const libelleSansSurface = `${depChoisi ?? code} : pas de superficie agricole de référence${culture ? ` pour ${libelle(culture).toLowerCase()}` : ''}`

  // La réponse porte sur le département choisi, sinon sur le pays
  const besoinVu = choisi ? choisi.besoin_t : !sansSurface && connus.length ? total : null
  // Sacs du pays = somme des sacs des départements (chacun au demi-sac supérieur) : le budget total est la somme des lignes
  const nbSacs = besoinVu === null ? null : choisi ? sacsDeTonnes(besoinVu) : connus.reduce((s, b) => s + sacsDeTonnes(b.besoin_t!), 0)
  const prix = prixRetenu(listePrix, intrant?.code_intrant, annee, dossier.prix)
  const couverture = territoires && intrant ? partSurfaceAvecDose(territoires, intrant.colonne_besoin, culture, choisi || sansSurface ? code : null) : null
  const pourQui = culture ? libelle(culture).toLowerCase() : 'toutes cultures'
  const titre = !territoires ? `Besoin en ${nom}` : sansSurface ? libelleSansSurface : nbSacs === null ? `${depChoisi ? `${depChoisi} : b` : 'B'}esoin en ${nom} non calculé` : `${depChoisi ? `${depChoisi} : ` : ''}${nombre(nbSacs)} sacs ${deIntrant(intrant)} pour ${pourQui}`

  const lignes: LigneCheck[] = !territoires ? [] : sansSurface ? [
    { etat: 'info', texte: `${libelleSansSurface} : besoin et budget non calculés` },
  ] : [
    besoinVu === null ? { etat: 'attention', texte: 'Besoin non calculé : dose à saisir' } : { etat: 'info', texte: `Besoin : **${nombre(nbSacs)} sacs** de 50 kg, soit ${tonnes(besoinVu)}` },
    prix.saisi !== null ? { etat: 'info', texte: `Budget à votre prix : **${fcfa(budget(nbSacs, prix.saisi))}** (saisi par vous)` }
      : prix.cession !== null ? { etat: 'info', texte: `Budget : **${fcfa(budget(nbSacs, prix.cession))}** subventionné, ${fcfa(budget(nbSacs, prix.reel))} en coût réel` }
        : { etat: 'attention', texte: `Prix ${nom} à saisir : budget non calculé` },
    couverture === null ? { etat: 'info', texte: 'Pas de superficie de référence ici' }
      : { etat: couverture >= 100 ? 'ok' : 'attention', texte: `Doses connues pour **${pct(couverture >= 100 ? 100 : Math.floor(couverture))}** des surfaces` },
  ]
  const cleLignes = lignes.map((l) => l.texte).join('|')

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(besoins.map((b) => [b.code, b]))
    return {
      aEcouter: territoires ? aLire(titre, lignes) : undefined,
      resume: connus.length ? `${tonnes(total)} ${deIntrant(intrant)} · ${connus.length} départements` : `Besoin en ${nom} non calculé`,
      vue: {
        ambiance: 'jour', camera: cadrer.pays(cadre, { inclinaison: 50, cap: 8 }), zones: null, relief: true, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [],
        departements: new Map(besoins.map((b) => [b.code, b.besoin_t === null || !max ? { couleur: NON_DISPONIBLE } : { couleur: couleurQuantite(Math.sqrt(b.besoin_t / max)), hauteur: 4000 + 75000 * Math.sqrt(b.besoin_t / max) }])),
      },
      legende: <Degrade titre={`Besoin en ${nom}`} gauche="faible" droite={tonnes(max)} degrade="linear-gradient(to right,#d5eadb,#5aa878,#12391f)" note="Gris : dose à saisir, besoin non calculé." />,
      infobulle: (c) => {
        const b = parCode.get(c)
        const dep = cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c
        if (!b) return { titre: dep, lignes: ['Pas de superficie de référence'] }
        return { titre: dep, lignes: [b.besoin_t === null ? 'Dose à saisir : besoin non calculé' : `Besoin : ${nombre(sacsDeTonnes(b.besoin_t))} sacs (${tonnes(b.besoin_t)})`, ...(b.sansDose && b.besoin_t !== null ? [`${b.sansDose} culture(s) sans dose connue`] : [])] }
      },
      etape: {
        titre, question: questionOng('besoins'), lignes,
        legende: { titre: `Besoin en ${nom}`, entrees: [{ couleur: couleurQuantite(0), libelle: 'faible' }, { couleur: couleurQuantite(1), libelle: tonnes(max) }, { couleur: NON_DISPONIBLE, libelle: 'dose à saisir' }] },
        tableau: {
          colonnes: ['Département', 'Besoin (t)', 'Sacs de 50 kg', prix.saisi !== null ? 'Budget, prix saisi par vous (FCFA)' : 'Budget subventionné (FCFA)', 'Coût réel (FCFA)'],
          lignes: connus.slice(0, 10).map((b) => {
            const n = sacsDeTonnes(b.besoin_t!)
            return [b.departement, tonnes(b.besoin_t), nombre(n), fcfa(budget(n, prix.saisi ?? prix.cession)), prix.saisi !== null ? '—' : fcfa(budget(n, prix.reel))]
          }),
        },
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lignes` est résumé par `cleLignes`, `prix` par ses champs
  }, [besoins, connus, total, max, code, cadre, nom, territoires, titre, cleLignes, prix.saisi, prix.cession, prix.reel])
  usePublier(publier, sortie)

  // Sources et statuts de la dose retenue, pour le choix en cours
  const colonneSource = intrant?.colonne_besoin === 'besoin_semences_retenu_t' ? 'semis' : 'engrais'
  const codeVu = choisi || sansSurface ? code : null
  const sources = useMemo(() => {
    const m = new Map<string, number>()
    territoires?.filter((t) => (!culture || t.culture === culture) && (!codeVu || t.code_departement === codeVu)).forEach((t) => {
      const source = (colonneSource === 'semis' ? t.source_reference_semis : t.source_reference_engrais) ?? 'source non renseignée'
      const statut = colonneSource === 'semis' ? t.statut_validation_semis : t.statut_validation_engrais
      const cle = `${source} · ${statut ?? 'statut non renseigné'}`
      m.set(cle, (m.get(cle) ?? 0) + 1)
    })
    return [...m.entries()].sort((x, y) => y[1] - x[1])
  }, [territoires, culture, codeVu, colonneSource])
  const noteDap = intrant?.colonne_besoin === 'besoin_dap_t' ? territoires?.find((t) => t.note_dap)?.note_dap : null
  const libelleFumier = territoires?.find((t) => t.libelle_fumier)?.libelle_fumier
  const saisi = intrant ? dossier.prix[intrant.code_intrant] : undefined

  return (
    <FicheReponse cadre={cadre} mode="besoins" cle={`${code}-${intrant?.code_intrant}-${culture}-${annee}`} titre={titre} lignes={lignes} aEcouter={sortie.aEcouter}
      puces={[puceAnnee(cadre, a), puceCulture(cadre, cultures, culture, 'Toutes'), puceIntrant(cadre.ref, intrant, majDossier)]}
      etat={<>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">Besoins de référence (superficies habituelles × doses), pas des besoins prévisionnels.</p>
        {!territoires && <Squelette lignes={4} />}
        {territoires && !connus.length && <Avis>Aucune dose connue pour ce choix : le besoin n'est pas calculé. Il n'est pas nul.</Avis>}
      </>}
      detail={territoires ? <>
        <Groupe titre={`Prix du ${intrant?.nom_intrant ?? 'produit'}`} complement="sac de 50 kg">
          <Lignes>
            <Ligne libelle="Prix de cession (subventionné)" valeur={prix.cession === null ? 'à saisir' : fcfa(prix.cession)} />
            <Ligne libelle="Coût réel (cession + subvention)" valeur={prix.reel === null ? 'à saisir' : fcfa(prix.reel)} />
            <Ligne libelle="Statut" valeur={prix.statut ? STATUT_PRIX[prix.statut] : 'non disponible'} detail={prix.campagne === null ? 'aucun prix publié' : prix.campagne === annee ? `campagne ${prix.campagne}` : `campagne ${prix.campagne}, dernier prix connu`} />
          </Lignes>
          {prix.source && <p className="mt-2 text-2xs leading-snug text-white/60">Source : {prix.source}</p>}
          <Champ libelle="Votre prix d'achat (FCFA / sac de 50 kg)" className="mt-3">
            <input className="champ-scene tabular-nums" inputMode="decimal" placeholder="à saisir" value={saisi ?? ''} aria-invalid={Boolean(saisi?.trim()) && prix.saisi === null}
              onChange={(e) => {
                if (!intrant) return
                // Le texte tapé est gardé tel quel (virgule, espaces) ; il n'est converti qu'au calcul (lireNombre)
                const suite = { ...dossier.prix }
                if (e.target.value === '') delete suite[intrant.code_intrant]
                else suite[intrant.code_intrant] = e.target.value
                majDossier({ prix: suite })
              }} />
          </Champ>
          {Boolean(saisi?.trim()) && prix.saisi === null && <p role="alert" className="mt-2 text-xs text-soleil-500">Tapez un prix positif, par exemple 15 000.</p>}
          {prix.saisi !== null && <p className="mt-2 flex items-center gap-2 text-xs text-white/70"><Marque>saisi par vous</Marque>Gardé pour la session et repris dans le dossier exporté.</p>}
          {prix.saisi !== null && nbSacs !== null && (
            <Lignes>
              <Ligne libelle="Budget à votre prix" valeur={fcfa(budget(nbSacs, prix.saisi))} detail="saisi par vous" />
              {prix.cession !== null && <Ligne libelle="Budget au prix subventionné" valeur={fcfa(budget(nbSacs, prix.cession))} />}
              {prix.reel !== null && <Ligne libelle="Budget au coût réel" valeur={fcfa(budget(nbSacs, prix.reel))} />}
            </Lignes>
          )}
        </Groupe>

        {sources.length > 0 && (
          <Groupe titre="Dose retenue : source et statut" complement={`${sources.reduce((s, [, n]) => s + n, 0)} couples département × culture`}>
            <Lignes>{sources.map(([s, n]) => <Ligne key={s} libelle={s} valeur={nombre(n)} />)}</Lignes>
          </Groupe>
        )}

        {parZone.length > 0 && (
          <Groupe titre="Par zone agroécologique">
            <ol>{parZone.map((z) => <Rang key={z.cle} nom={z.nom} part={total > 0 ? (100 * z.besoin) / total : null} couleur={z.couleur} valeur={tonnes(z.besoin)} />)}</ol>
          </Groupe>
        )}
        {connus.length > 0 && (
          <Groupe titre="Par département" complement={`${connus.length}`}>
            <ol>
              {connus.map((b, i) => <Rang key={b.code} rang={i + 1} nom={b.departement} part={max > 0 ? (100 * b.besoin_t!) / max : null} couleur="var(--color-vert-500)" valeur={`${nombre(sacsDeTonnes(b.besoin_t!))} sacs · ${tonnes(b.besoin_t)}`} actif={b.code === code} onClick={() => cadre.choisir(b.code)} />)}
            </ol>
          </Groupe>
        )}

        <Methode>
          <p>Besoins de référence historiques (superficies de référence × doses de la zone), pas prévisionnels. Sacs de 50 kg, arrondis au demi-sac supérieur par département ; le total du pays est la somme des départements. Budget = sacs × prix du sac (le budget total est la somme des lignes).</p>
          <p>Les sommes par zone additionnent les départements. Une dose inconnue reste « à saisir », jamais zéro : {nombre(sansDose)} couples département × culture sont dans ce cas.</p>
          {noteDap && <p>DAP : {noteDap}.</p>}
          {libelleFumier && <p>Fumier : {libelleFumier}. Il n'entre ni dans les totaux, ni dans le budget, ni dans la répartition.</p>}
        </Methode>
      </> : undefined} />
  )
}
