// Agriculteur — « Quand semer » (modèle 4) : la réponse est une période, en dates. Une frise de début juin à
// mi-août montre trois temps : trop tôt (la pluie de semis peut être suivie d'un sec), le bon moment, trop tard
// (les pluies finissent avant la récolte). La carte montre le meilleur moment dans chaque département.
//
// Pastilles de l'agriculteur : seulement les champs du modèle 4 (/previsions/risque-semis) et `estBonMoment` (conseil.ts :
// risque_total_pct < RISQUE_BON_MOMENT, strictement ; la même règle pour la frise, la checklist et le titre).
// - Meilleure décade (`decade_conseillee`) bon moment → ok « Semez du {début} au {fin}, après une pluie d'au moins 20 mm » ;
//   sinon attention « Aucune période sûre : attendez une pluie d'au moins 20 mm et préférez un cycle court ».
// - Décade « trop tôt » ou « trop tard » de la frise (avant ou après le bon moment de `fenetre`) → non.
// - 3 lignes au plus, rangées non > attention > ok > info.
// Année que le modèle 4 ne couvre pas (`anneeCouverte`) : aucun appel, « Pas de prévision de semis pour {année} ».
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useActuelles, etatActuel, useCarteSemis, useRisqueSemis } from '../../hooks/previsions'
import { libelle, nombre, pct } from '../../lib/format'
import type { RisqueSemis } from '../../types/previsions'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { couleurDecade, degrade } from '../carte/couleurs'
import { datesDecade, debutDecade, MODELES, natureAnnee, periodeDecades } from '../regles/fiabilite'
import { Attente, MethodeModele } from '../previsions'
import { cultureWo, decadeWo, FIN_WO, pctWo, wo } from '../voix/wolof'
import { cultureRetenue, decadesCulture, fenetre, PLUIE_SEMIS_MM, repliCulture, RISQUE_BON_MOMENT } from '../regles/conseil'
import { aLire, CHOISIR, puceAnnee, puceCulture, trierLignes, type LigneCheck } from '../interface/fiche'
import { FicheReponse } from '../interface/FicheReponse'
import { AFaire, Cle, Cles, Degrade, Groupe, Ligne, Lignes, LigneFiabilite, type Action } from '../interface/ui'

type Temps = 'tot' | 'bon' | 'tard'
const TEMPS: Record<Temps, { nom: string; classe: string }> = {
  tot: { nom: 'Trop tôt', classe: 'bg-soleil-500/45' },
  bon: { nom: 'Bon moment', classe: 'bg-vert-500' },
  tard: { nom: 'Trop tard', classe: 'bg-alerte-500/70' },
}

/** Frise de début juin à mi-août : une case par décade, trois couleurs, la meilleure cochée. */
function Frise({ decades, de, a, choisie, onChoisir }: { decades: RisqueSemis[]; de: number; a: number; choisie: number; onChoisir: (decade: number) => void }) {
  const temps = (i: number): Temps => (i < de ? 'tot' : i > a ? 'tard' : 'bon')
  const zones = ([['tot', de], ['bon', a - de + 1], ['tard', decades.length - a - 1]] as [Temps, number][]).filter(([, n]) => n > 0)
  return (
    <div>
      <div className="grid grid-cols-8 gap-0.5 text-2xs font-medium text-white/90" aria-hidden>
        {zones.map(([t, n]) => <span key={t} className="truncate pb-1.5" style={{ gridColumn: `span ${n}` }}>{n > 1 || t === 'bon' ? TEMPS[t].nom : ''}</span>)}
      </div>
      <div className="grid grid-cols-8 gap-0.5" role="radiogroup" aria-label="Période de semis">
        {decades.map((d, i) => (
          <button key={d.decade_semis} type="button" role="radio" aria-checked={d.decade_semis === choisie} onClick={() => onChoisir(d.decade_semis)}
            aria-label={`${periodeDecades(d.decade_semis)} : ${TEMPS[temps(i)].nom.toLowerCase()}, risque ${pct(d.risque_total_pct)}`}
            className={clsx('grid h-11 place-items-center transition hover:brightness-125', TEMPS[temps(i)].classe, i === 0 && 'rounded-l-md', i === decades.length - 1 && 'rounded-r-md', d.decade_semis === choisie && 'ring-2 ring-white ring-inset')}>
            {d.decade_conseillee && <Check className="size-4 text-white" strokeWidth={3} aria-hidden />}
          </button>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-8 gap-0.5 text-2xs text-white/60 tabular-nums" aria-hidden>
        <span className="col-span-3">1er juin</span><span className="col-span-3">1er juil.</span><span className="col-span-2">1er août</span>
      </div>
    </div>
  )
}

export default function QuandSemer({ cadre, publier }: PropsMode) {
  const a = useAnnee(cadre, 'M4', true)
  const { annee, couverte: anneeCouverte } = a
  // La période touchée sur la frise, pour une culture : changer de culture revient à la meilleure
  const [touchee, setTouchee] = useState<{ culture: string; decade: number } | null>(null)
  const code = cadre.selection ?? cadre.user.code_departement
  const departement = cadre.ref.departements.find((d) => d.code_departement === code)

  // Année hors du modèle 4 : aucune requête (pas de 404)
  const requete = useRisqueSemis(anneeCouverte ? code : null, annee)
  const donnees = useActuelles(requete)
  const etat = anneeCouverte ? etatActuel(requete) : 'absente'
  const cultures = useMemo(() => {
    const liste = [...new Set(donnees?.donnees.map((l) => l.culture))].sort((a, b) => a.localeCompare(b, 'fr'))
    // Sans culture choisie, l'arachide d'abord (la culture la plus semée)
    return liste.includes('ARACHIDE') ? ['ARACHIDE', ...liste.filter((c) => c !== 'ARACHIDE')] : liste
  }, [donnees])
  // La culture partagée si le modèle 4 la couvre ici ; sinon le choix par défaut, sans écraser la culture partagée
  const demandee = cadre.culture
  const culture = (cultures.length ? cultureRetenue(demandee, cultures) : demandee) ?? 'ARACHIDE'
  const repli = cultures.length ? repliCulture(demandee, culture) : null
  const decades = useMemo(() => decadesCulture(donnees?.donnees, culture), [donnees, culture])
  const f = useMemo(() => fenetre(decades), [decades])
  const decadeChoisie = touchee?.culture === culture ? touchee.decade : null
  const detail = decades.find((d) => d.decade_semis === decadeChoisie) ?? f?.meilleure
  const carte = useCarteSemis(anneeCouverte ? culture : null, annee)
  const carteDonnees = useActuelles(carte)
  const nomCulture = libelle(culture).toLowerCase()
  const article = /^[aeiouéèh]/i.test(nomCulture) ? "l'" : nomCulture.startsWith('pastèque') ? 'la ' : 'le '
  const sur = f?.sur ?? false

  // Que faire : ne pas semer trop tôt, semer après une vraie pluie dans la fenêtre, préparer les intrants
  const finDate = (decade: number) => { const d = datesDecade(decade); return `${d.fin} ${['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][d.mois]}` }
  const tot = f && f.de > 0 ? decades[f.de - 1] : undefined
  const actions: Action[] = !f ? [] : !sur
    ? [{ texte: 'Aucune période n’est vraiment sûre cette année : préférez une culture à cycle plus court.', vers: { mode: 'semer', libelle: 'Que semer ?' } }]
    : [
        ...(tot && tot.risque_faux_depart_pct !== null ? [{ texte: `Ne semez pas avant le ${debutDecade(decades[f.de].decade_semis)} : avant, ${nombre(tot.risque_faux_depart_pct)} % de risque d’un sec juste après la levée.` }] : []),
        { texte: `Semez après une pluie d’au moins ${PLUIE_SEMIS_MM} mm, entre le ${debutDecade(decades[f.de].decade_semis)} et le ${finDate(decades[f.a].decade_semis)}.` },
        { texte: 'Préparez vos semences et engrais.', vers: { mode: 'surface', libelle: 'Combien ?' } },
      ]
  // La réponse en 1 à 3 lignes : trop tôt, le bon moment (avec la pluie de semis), trop tard
  const tard = f && f.a < decades.length - 1 ? decades[f.a + 1] : undefined
  const titre = !departement ? 'Choisissez un département' : !anneeCouverte ? `Pas de prévision de semis pour ${annee}` : f
    ? (sur ? `Semez ${article}${nomCulture} ${periodeDecades(decades[f.de].decade_semis, decades[f.a].decade_semis)}` : `Le moins risqué : ${periodeDecades(f.meilleure.decade_semis)}`)
    : departement.departement
  const lignesFiche: LigneCheck[] = !departement ? [CHOISIR] : !f ? [] : trierLignes([
    ...(tot && tot.risque_faux_depart_pct !== null ? [{ etat: 'non' as const, texte: `Avant le ${debutDecade(decades[f.de].decade_semis)} : **${nombre(tot.risque_faux_depart_pct)} %** de faux départ (la pluie s’arrête après les premières averses)` }] : []),
    sur
      ? { etat: 'ok' as const, texte: `Semez du **${debutDecade(decades[f.de].decade_semis)}** au **${finDate(decades[f.a].decade_semis)}**, après une pluie d’au moins ${PLUIE_SEMIS_MM} mm` }
      : { etat: 'attention' as const, texte: `Aucune période sûre : attendez une pluie d’au moins ${PLUIE_SEMIS_MM} mm et préférez un cycle court` },
    ...(tard && tard.risque_fin_trop_tot_pct !== null ? [{ etat: 'non' as const, texte: `Après le ${finDate(decades[f.a].decade_semis)} : **${nombre(tard.risque_fin_trop_tot_pct)} %** de risque que les pluies s’arrêtent trop tôt` }] : []),
  ])
  const cleLignes = lignesFiche.map((l) => l.texte).join('|')

  const sortie = useMemo<Sortie>(() => {
    const lignes = carteDonnees?.donnees
    const parCode = new Map(lignes?.map((l) => [l.code_departement, l]))
    // La voix lit le titre puis les lignes ; sans période calculée, la phrase existante
    const aEcouter = departement && !anneeCouverte ? aLire(titre, [])
      : departement && etat === 'chargement' ? []
        : departement && !f ? [`Pas de période de semis calculée pour ${article}${nomCulture} à ${departement.departement}.`] : aLire(titre, lignesFiche)
    const aEcouterWo = !departement || !anneeCouverte || etat === 'chargement' ? undefined : !f
      ? [`Ci ${departement.departement}, amul jamono ji ñu xayma ngir ${cultureWo(culture)}.`]
      : [
          `Ci ${departement.departement}, atum ${wo(annee)}, ${cultureWo(culture)} gi, ngay ji ko ${decadeWo(decades[f.de].decade_semis, decades[f.a].decade_semis)}.`,
          `Jamono ji gën: ${decadeWo(f.meilleure.decade_semis)}. Loraange gi: ${pctWo(f.meilleure.risque_total_pct)}.`,
          'Soo jiwee ba gaaw, taw bi mën na dakk. Soo yàggee, taw bi mën na jeex bala ngóob mi.',
          FIN_WO,
        ]
    return {
      aEcouter,
      aEcouterWo,
      resume: departement ? (!anneeCouverte ? `Pas de prévision de semis pour ${annee}` : f ? (sur ? `${libelle(culture)} : semer ${periodeDecades(decades[f.de].decade_semis, decades[f.a].decade_semis, true)}` : `${libelle(culture)} : aucune période sûre`) : departement.departement) : 'Choisissez un département',
      vue: {
        ambiance: 'jour', camera: cadrer.pays(cadre, { inclinaison: 26, cap: -6 }), zones: null, relief: false, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0, alertes: [],
        departements: lignes ? new Map(lignes.map((l) => [l.code_departement, { couleur: couleurDecade(l.decade_semis) }])) : null,
      },
      legende: <Degrade titre={`Meilleur moment pour semer · ${nomCulture}`} gauche="début juin" droite="mi-août" degrade={degrade(couleurDecade, 16, 23, 7)} note="Gris : non disponible." />,
      infobulle: (c) => {
        const l = parCode.get(c)
        const nom = cadre.ref.departements.find((d) => d.code_departement === c)?.departement ?? c
        return { titre: nom, lignes: l ? [`${libelle(culture)} : ${periodeDecades(l.decade_semis)}`, `Risque : ${pct(l.risque_total_pct)}`] : ['Non disponible (pas de pluie par période de 10 jours)'] }
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `lignesFiche` est tiré de `f` et `decades`
  }, [carteDonnees, departement, f, decades, culture, nomCulture, code, cadre, annee, article, sur, titre, cleLignes, anneeCouverte, etat])
  usePublier(publier, sortie)

  if (!departement) return <FicheReponse cadre={cadre} mode="semis" cle="aucun" titre={titre} lignes={lignesFiche} aEcouter={sortie.aEcouter} aEcouterWo={sortie.aEcouterWo} />

  const puces = [puceAnnee(cadre, a), puceCulture(cadre, cultures.length ? cultures : [culture], culture)]
  return (
    <FicheReponse cadre={cadre} mode="semis" cle={`${code}-${annee}-${culture}`} culture={culture} puces={puces} titre={titre} teinte={f ? (sur ? 'var(--color-vert-500)' : 'var(--color-soleil-500)') : undefined} lignes={lignesFiche}
      aEcouter={sortie.aEcouter} aEcouterWo={sortie.aEcouterWo}
      etat={<>
        {repli && <p className="mt-2 text-xs text-white/60">{repli}</p>}
        {anneeCouverte && <Attente etat={etat} objet={`${departement.departement} en ${annee}`} />}
        {etat === 'ok' && !f && <p className="mt-4 text-sm text-white/60">Pas de période de semis calculée pour {article}{nomCulture} dans ce département.</p>}
      </>}
      detail={!f && !detail ? undefined : (
        <>
          <p className="mt-4 text-sm leading-relaxed text-white/70">{`${departement.departement} · ${annee}.${f && !sur ? ' Aucune période n’est vraiment sûre ici pour cette culture.' : ''}`}</p>
          <AFaire aller={cadre.aller} actions={actions} />

          {f && (
            <Cles>
              <Cle large valeur={periodeDecades(f.meilleure.decade_semis, f.meilleure.decade_semis, true).replace('du ', '')} libelle="le meilleur moment" teinte="var(--color-vert-100)" />
              <Cle valeur={nombre(f.meilleure.risque_total_pct)} unite="%" libelle="de risque" />
            </Cles>
          )}

          {f && detail && (
            <div className="mt-5">
              <Frise decades={decades} de={f.de} a={f.a} choisie={detail.decade_semis} onChoisir={(d) => setTouchee({ culture, decade: d })} />
              <p className="mt-3 text-sm text-white/80" aria-live="polite">
                <span className="font-medium text-white">{libelle(periodeDecades(detail.decade_semis))}</span> : {pct(detail.risque_total_pct)} de risque
                {detail.decade_conseillee ? ', le plus bas.' : detail.risque_faux_depart_pct === null || detail.risque_fin_trop_tot_pct === null ? '.' : detail.risque_faux_depart_pct >= detail.risque_fin_trop_tot_pct ? ' (un sec après le semis).' : ' (pluies finies avant la récolte).'}
              </p>
            </div>
          )}

          {f && <LigneFiabilite parties={['Estimation de la date de semis', MODELES.M4.fiabilite, natureAnnee(annee, a.aVenir)]} />}


          {detail && (
            <>
              <Groupe titre={libelle(periodeDecades(detail.decade_semis))}>
                <Lignes>
                  <Ligne libelle="Risque total" valeur={pct(detail.risque_total_pct)} />
                  <Ligne libelle="Semer trop tôt" valeur={pct(detail.risque_faux_depart_pct)} detail="un sec après le semis" />
                  <Ligne libelle="Semer trop tard" valeur={pct(detail.risque_fin_trop_tot_pct)} detail="pluies finies avant la récolte" />
                  <Ligne libelle="Pluie de semis" valeur={pct(detail.chance_pluie_semis_pct)} detail={`années avec au moins ${PLUIE_SEMIS_MM} mm`} />
                  <Ligne libelle="Cycle de la culture" valeur={detail.cycle_jours === null ? 'non disponible' : `${nombre(detail.cycle_jours)} jours`} />
                </Lignes>
              </Groupe>
            </>
          )}

          <MethodeModele cibles={[{ modele: 'M4' }]} avertissements={donnees?.avertissements}>
            <p>À valider avec les agronomes. Le meilleur moment est la période de 10 jours où le risque est le plus faible, parmi celles où il pleut assez pour semer au moins une année sur deux. Le « bon moment » ajoute les périodes voisines où le risque reste sous {RISQUE_BON_MOMENT} %.</p>
            <p>Calculé avec la prévision de saison {annee}{a.tendance ? ' (prévision de tendance)' : ''}{detail?.proba_saison_seche_m1_pct != null ? ` : ${pct(detail.proba_saison_seche_m1_pct)} de chances d'une saison sèche` : ''}.</p>
          </MethodeModele>
        </>
      )} />
  )
}
