// La vulnérabilité n'est plus une étape du parcours de l'ONG : sa vue de carte (couleur et volume = score relatif),
// son classement et le détail de son score sont la vue « vulnérabilité » de l'étape 1 (Campagne.tsx).
import { libelle, mm, nombre, pct } from '../../lib/format'
import type { LigneVulnerabilite } from '../../types/marts'
import type { Infobulle } from '../cadre'
import type { EtatDepartement } from './Carte'
import { couleurVulnerabilite } from './couleurs'
import { Degrade, Groupe, Ligne, Lignes, Rang } from '../interface/ui'

/** La vue « vulnérabilité » de la carte : couleur et volume = score, légende, infobulle. */
// eslint-disable-next-line react-refresh/only-export-components -- fonction de vue (pas un composant), partagée avec la carte
export function vueVulnerabilite(data: LigneVulnerabilite[] | undefined) {
  const parCode = new Map(data?.map((v) => [v.code_departement, v]))
  return {
    departements: new Map<string, EtatDepartement>(data?.map((v) => [v.code_departement, { couleur: couleurVulnerabilite(v.score_vulnerabilite), hauteur: (v.score_vulnerabilite ?? 0) * 800 }])),
    legende: <Degrade titre="Score de vulnérabilité" gauche="0" droite="100" degrade="linear-gradient(to right,#fdf0d2,#f2b544,#e07a3a,#a3311c)" note="Relatif entre départements. Gris : non noté." />,
    /** la même légende, en données (export) */
    entrees: [0, 40, 70, 100].map((v) => ({ couleur: couleurVulnerabilite(v), libelle: `score ${v}` })),
    infobulle: (c: string): Infobulle | null => {
      const v = parCode.get(c)
      return v ? { titre: v.departement, lignes: v.score_vulnerabilite === null ? ['Non noté (données de rendement insuffisantes)', `Aléa sécheresse : ${nombre(v.score_alea_secheresse)}`] : [`Score ${nombre(v.score_vulnerabilite)} · rang ${v.rang_vulnerabilite}`, libelle(v.classe_vulnerabilite)] } : null
    },
  }
}

/** Les départements notés, du plus vulnérable au moins vulnérable. */
// eslint-disable-next-line react-refresh/only-export-components -- fonction de tri, partagée avec l'étape 1
export const classerVulnerabilite = (data: LigneVulnerabilite[] | undefined) =>
  (data ?? []).filter((v) => v.score_vulnerabilite !== null).sort((a, b) => b.score_vulnerabilite! - a.score_vulnerabilite!)

/** Ce qui fait le score d'un département. */
export function ScoreVulnerabilite({ fiche }: { fiche: LigneVulnerabilite }) {
  return (
    <Groupe titre="Ce qui fait le score de vulnérabilité">
      <Lignes>
        <Ligne libelle="Saisons en alerte sécheresse" valeur={pct(fiche.freq_alerte_secheresse_pct)} />
        <Ligne libelle="Pluie d'une année sèche" valeur={mm(fiche.pluie_saison_annee_seche_mm)} />
        <Ligne libelle="Variabilité de la pluie" valeur={pct(fiche.variabilite_pluie_cv_pct)} />
        <Ligne libelle="Variabilité des rendements" valeur={pct(fiche.variabilite_rendement_pct)} detail={fiche.confiance_rendement === 'faible' ? 'confiance faible' : undefined} />
      </Lignes>
    </Groupe>
  )
}

/** Le classement des départements notés ; un clic choisit le département (sélection partagée). */
export function ClassementVulnerabilite({ classement, code, choisir }: { classement: LigneVulnerabilite[]; code: string | null; choisir: (code: string) => void }) {
  return (
    <Groupe titre="Classement de vulnérabilité" complement={`${classement.length} départements`}>
      <ol>
        {classement.map((v, i) => (
          <Rang key={v.code_departement} rang={i + 1} nom={v.departement} part={v.score_vulnerabilite} couleur={couleurVulnerabilite(v.score_vulnerabilite)} valeur={nombre(v.score_vulnerabilite)}
            actif={v.code_departement === code} onClick={() => choisir(v.code_departement)} />
        ))}
      </ol>
    </Groupe>
  )
}
