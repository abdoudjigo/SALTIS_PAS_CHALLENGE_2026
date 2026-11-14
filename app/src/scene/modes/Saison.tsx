// « La saison qui vient » (modèle 1) : la saison sera-t-elle sèche, normale ou humide ? Par défaut la campagne
// à venir. La réponse nomme la classe la plus probable avec sa probabilité, les 3 barres sont toujours visibles.
// Une année passée sert de vérification : ce qu'on avait prévu, ce qui est tombé.
import { useMemo } from 'react'
import { etatPrevision, usePrevisionSaison } from '../../hooks/previsions'
import { mm, nombre } from '../../lib/format'
import { cadrer, useAnnee, usePublier, type PropsMode, type Sortie } from '../cadre'
import { CLASSES3, couleurPluie, degrade, parts3, tendance } from '../couleurs'
import { Attente, ChampAnnee, MethodeModele } from '../previsions'
import { dire } from '../lecture'
import { CLASSE_WO, FIN_WO, pctWo, wo } from '../wolof'
import { Cle, Degrade, Detail, Fourchette, Groupe, Ligne, Lignes, Parts, Reponse } from '../ui'

const METRES_PAR_MM = 45

type Probas = { proba_seche_pct: number | null; proba_normale_pct: number | null; proba_humide_pct: number | null }
type LigneSaison = { departement: string; pluie_prevue_mm: number | null; pluie_basse_mm: number | null; pluie_haute_mm: number | null; pluie_normale_mm: number | null; pluie_observee_mm: number | null }

/** L'essentiel, pour l'oreille : la saison, la pluie attendue face à la normale, d'où vient la prévision. */
function ecouterSaison(annee: number, classe: string, proba: number | null, p: Probas, l: LigneSaison | undefined, tendance: boolean, passee: boolean): string[] {
  const lieu = l ? `à ${l.departement}` : 'au Sénégal'
  const phrases = [passee
    ? `Saison ${annee} ${lieu} : le modèle la prévoyait plutôt ${classe}, avec ${dire.pct(proba)} de chances.`
    : `Saison ${annee} ${lieu} : elle s'annonce plutôt ${classe}, avec ${dire.pct(proba)} de chances.`]
  phrases.push(`Chances d'une saison sèche : ${dire.pct(p.proba_seche_pct)} ; normale : ${dire.pct(p.proba_normale_pct)} ; humide : ${dire.pct(p.proba_humide_pct)}.`)
  if (l && l.pluie_prevue_mm !== null) {
    phrases.push(`Pluie attendue : ${dire.mm(l.pluie_prevue_mm)}, entre ${dire.nombre(l.pluie_basse_mm)} et ${dire.mm(l.pluie_haute_mm)}.`)
    if (l.pluie_normale_mm) {
      const ecart = (l.pluie_prevue_mm - l.pluie_normale_mm) / l.pluie_normale_mm
      const comparaison = Math.abs(ecart) < 0.05 ? 'proche de la normale' : ecart > 0 ? 'au-dessus de la normale' : 'en dessous de la normale'
      phrases.push(`C'est ${comparaison}, qui est de ${dire.mm(l.pluie_normale_mm)}.`)
    }
  } else phrases.push('Touchez un département sur la carte pour entendre sa pluie attendue.')
  if (passee) phrases.push(l?.pluie_observee_mm != null ? `Il est réellement tombé ${dire.mm(l.pluie_observee_mm)}.` : 'La pluie réellement tombée n\'est pas disponible.')
  else if (tendance) phrases.push(`C'est une prévision de tendance, tirée des quinze dernières saisons. Elle sera précisée fin mai ${annee}, avec l'état des océans.`)
  else phrases.push(`Cette prévision s'appuie sur l'état des océans de mars à mai ${annee}.`)
  phrases.push('C\'est une estimation indicative, pas une certitude.')
  return phrases
}

/** La même chose en wolof (mascotte « WLF »). */
function ecouterSaisonWo(annee: number, classe: string, proba: number | null, l: LigneSaison | undefined, tendance: boolean, passee: boolean): string[] {
  const lieu = l ? `ci ${l.departement}` : 'ci Senegaal'
  const phrases = [`Atum ${wo(annee)}, ${lieu}, nawet bi dina am ${CLASSE_WO[classe] ?? classe}. Yaakaar ji mooy ${pctWo(proba)}.`]
  if (l?.pluie_prevue_mm != null) phrases.push(`Taw bi ñu xaar mooy ${wo(l.pluie_prevue_mm)} milimetar, diggante ${wo(l.pluie_basse_mm)} ak ${wo(l.pluie_haute_mm)}.`)
  if (l?.pluie_normale_mm) phrases.push(`Ci at mu yem, dafay tollu ci ${wo(l.pluie_normale_mm)} milimetar.`)
  if (passee) phrases.push(l?.pluie_observee_mm != null ? `Taw bi daanu woon: ${wo(l.pluie_observee_mm)} milimetar.` : 'Taw bi daanu woon, xamuñu ko.')
  else if (tendance) phrases.push('Xayma bii, dañu ko jële ci fukki at ak juróom yi weesu.')
  phrases.push(FIN_WO)
  return phrases
}

export default function Saison({ cadre, publier }: PropsMode) {
  const a = useAnnee(cadre, 'M1')
  const { annee, passee } = a
  const requete = usePrevisionSaison(annee)
  const etat = etatPrevision(requete)
  const lignes = requete.data?.donnees
  const code = cadre.selection ?? cadre.user.code_departement
  const ligne = lignes?.find((l) => l.code_departement === code)
  // Les probabilités viennent de l'état des océans : elles sont les mêmes dans tout le pays
  const probas = ligne ?? lignes?.[0]
  const t = useMemo(() => (probas ? tendance(probas) : null), [probas])

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(lignes?.map((l) => [l.code_departement, l]))
    return {
      aEcouter: t && probas ? ecouterSaison(annee, t.classe, t.proba, probas, ligne, a.tendance, passee) : undefined,
      aEcouterWo: t ? ecouterSaisonWo(annee, t.classe, t.proba, ligne, a.tendance, passee) : undefined,
      resume: t ? `${annee} : ${t.texte}, ${nombre(t.proba)} %${ligne ? ` · ${mm(ligne.pluie_prevue_mm)}` : ''}` : `Saison ${annee}`,
      vue: {
        ambiance: 'aube', camera: cadrer.pays(cadre, { inclinaison: 50, cap: -10 }), zones: null, relief: true, selection: code, satellite: false, arcs: [], reperes: [], pluie: t?.classe === 'humide' ? 0.45 : 0, alertes: [],
        departements: lignes ? new Map(lignes.map((x) => [x.code_departement, { couleur: couleurPluie(x.pluie_prevue_mm), hauteur: (x.pluie_prevue_mm ?? 0) * METRES_PAR_MM }])) : null,
      },
      legende: <Degrade titre={`Pluie prévue · saison ${annee}`} gauche="200 mm" droite="1 350 mm" degrade={degrade(couleurPluie, 200, 1350)} note="Hauteur et couleur : pluie prévue pour la saison." />,
      infobulle: (c) => {
        const x = parCode.get(c)
        return x ? { titre: x.departement, lignes: [`Pluie prévue : ${mm(x.pluie_prevue_mm)}`, `Entre ${nombre(x.pluie_basse_mm)} et ${mm(x.pluie_haute_mm)} · normale ${mm(x.pluie_normale_mm)}`] } : null
      },
    }
  }, [lignes, code, cadre, annee, t, ligne, probas, a.tendance, passee])
  usePublier(publier, sortie)

  return (
    <div>
      <Reponse cle={`${code}-${annee}`} titre={t ? `${annee} : ${t.texte}` : `Saison ${annee}`}
        phrase={ligne ? `${ligne.departement} · pluie de la saison ${annee}.` : 'Tout le pays. Touchez un département pour sa pluie attendue.'}>
        {t && <Cle valeur={nombre(t.proba)} unite="%" libelle={`de chances : saison ${t.classe}`} teinte={t.couleur} />}
        {ligne && <Cle valeur={nombre(ligne.pluie_prevue_mm)} unite="mm" libelle="pluie attendue" />}
        {ligne && <Cle valeur={nombre(ligne.pluie_normale_mm)} unite="mm" libelle="en année normale" />}
      </Reponse>
      <Attente etat={etat} objet={`la saison ${annee}`} />

      {probas && <div className="mt-5"><Parts parts={parts3(probas)} /></div>}

      <ChampAnnee cadre={cadre} a={a} saison={ligne} />

      {ligne && (
        <Detail>
          <Groupe titre={`Pluie de la saison · ${ligne.departement}`}>
            <Fourchette bas={ligne.pluie_basse_mm} haut={ligne.pluie_haute_mm} valeur={ligne.pluie_prevue_mm} repere={ligne.pluie_normale_mm} couleur={CLASSES3.humide.couleur}
              description={`Pluie prévue ${mm(ligne.pluie_prevue_mm)}, entre ${mm(ligne.pluie_basse_mm)} et ${mm(ligne.pluie_haute_mm)} ; normale ${mm(ligne.pluie_normale_mm)}`} />
            <p className="mt-1.5 mb-2 text-2xs text-white/45">Bande : fourchette · point : prévision · trait : normale</p>
            <Lignes>
              <Ligne libelle="Fourchette" valeur={ligne.pluie_basse_mm === null || ligne.pluie_haute_mm === null ? 'non disponible' : `${nombre(ligne.pluie_basse_mm)} – ${mm(ligne.pluie_haute_mm)}`} detail="8 chances sur 10" />
              <Ligne libelle="Normale" valeur={mm(ligne.pluie_normale_mm)} detail="moyenne 1991-2020" />
              {passee && <Ligne libelle="Réellement tombée" valeur={ligne.pluie_observee_mm === null ? 'non disponible' : mm(ligne.pluie_observee_mm)} />}
            </Lignes>
          </Groupe>
        </Detail>
      )}

      <MethodeModele cibles={[{ modele: 'M1', tendance: a.tendance }]} avertissements={requete.data?.avertissements}>
        <p>Indicatif. « Plutôt » : c'est la classe la plus probable, pas une certitude ; les trois chances se lisent ensemble.</p>
        <p>{passee ? 'Année passée rejouée : le modèle ne connaissait pas cette saison.' : a.tendance ? `${annee} : l'océan de mars à mai n'est pas encore connu.` : `Prévision ${annee} faite avec l'état des océans de mars à mai (NOAA). Aucune pluie ${annee} n'est encore observée.`} Les chances sont les mêmes dans tout le pays ; seule la pluie attendue change d'un département à l'autre.</p>
      </MethodeModele>
    </div>
  )
}
