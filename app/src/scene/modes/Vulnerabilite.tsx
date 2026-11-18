// Organisation — « Vulnérabilité » : où une mauvaise saison pèse le plus. Volumes = score (relatif, indicatif).
import { useMemo } from 'react'
import { useVulnerabilite } from '../../hooks/donnees'
import { libelle, mm, nombre, pct } from '../../lib/format'
import { cadrer, usePublier, type PropsMode, type Sortie } from '../cadre'
import { couleurVulnerabilite, teinteVulnerabilite } from '../couleurs'
import { dire } from '../lecture'
import { Cle, Degrade, Detail, Groupe, Lien, Ligne, Lignes, Methode, Rang, Reponse, Squelette } from '../ui'

export default function Vulnerabilite({ cadre, publier }: PropsMode) {
  const { data } = useVulnerabilite()
  const code = cadre.selection
  const classement = useMemo(() => (data ?? []).filter((v) => v.score_vulnerabilite !== null).sort((a, b) => b.score_vulnerabilite! - a.score_vulnerabilite!), [data])
  const fiche = data?.find((v) => v.code_departement === code)
  const nonNotes = (data ?? []).filter((v) => v.score_vulnerabilite === null).map((v) => v.departement)
  const tete = classement[0]

  const sortie = useMemo<Sortie>(() => {
    const parCode = new Map(data?.map((v) => [v.code_departement, v]))
    const f = code ? parCode.get(code) : undefined
    const aEcouter = !data ? undefined : f
      ? [
          f.score_vulnerabilite === null
            ? `${f.departement} n'est pas noté : ses données de rendement sont insuffisantes.`
            : `${f.departement} : vulnérabilité de ${dire.nombre(f.score_vulnerabilite)} sur cent, rang ${f.rang_vulnerabilite} sur ${classement.length}${f.classe_vulnerabilite ? `, classe ${libelle(f.classe_vulnerabilite).replace(' (relatif)', '')}` : ''}.`,
          ...(f.freq_alerte_secheresse_pct != null ? [`${dire.pct(f.freq_alerte_secheresse_pct)} des saisons y ont connu une alerte sécheresse depuis 1991.`] : []),
          'Le score compare les départements entre eux. Il est relatif et indicatif.',
        ]
      : [
          `Les départements où une mauvaise saison pèse le plus : ${classement.slice(0, 3).map((v) => `${v.departement}, ${dire.nombre(v.score_vulnerabilite)} sur cent`).join(' ; ')}.`,
          'Le score mêle l\'aléa sécheresse, pour 60 pour cent, et la sensibilité des rendements, pour 40 pour cent. Il compare les départements entre eux : il est relatif et indicatif.',
          ...(nonNotes.length ? [`Non notés, faute de données : ${nonNotes.join(', ')}.`] : []),
        ]
    return {
      aEcouter,
      resume: f ? `${f.departement} · ${f.score_vulnerabilite === null ? 'non noté' : `score ${nombre(f.score_vulnerabilite)}`}` : 'Où agir d’abord',
      vue: {
        ambiance: 'crepuscule', camera: cadrer.pays(cadre, { inclinaison: 58, cap: -18 }), zones: null, relief: true, selection: code, satellite: false, arcs: [], reperes: [], pluie: 0,
        departements: new Map(data?.map((v) => [v.code_departement, { couleur: couleurVulnerabilite(v.score_vulnerabilite), hauteur: (v.score_vulnerabilite ?? 0) * 800 }])),
      },
      legende: <Degrade titre="Score de vulnérabilité" gauche="0" droite="100" degrade="linear-gradient(to right,#fdf0d2,#f2b544,#e07a3a,#a3311c)" note="Relatif entre départements. Gris : non noté." />,
      infobulle: (c) => {
        const v = parCode.get(c)
        return v ? { titre: v.departement, lignes: v.score_vulnerabilite === null ? ['Non noté (données de rendement insuffisantes)', `Aléa sécheresse : ${nombre(v.score_alea_secheresse)}`] : [`Score ${nombre(v.score_vulnerabilite)} · rang ${v.rang_vulnerabilite}`, libelle(v.classe_vulnerabilite)] } : null
      },
    }
  }, [data, code, cadre, classement, nonNotes])
  usePublier(publier, sortie)

  return (
    <div>
      {fiche ? (
        <Reponse cle={code} titre={fiche.departement} phrase={`${libelle(fiche.zone_agroecologique)}. ${fiche.classe_vulnerabilite ? libelle(fiche.classe_vulnerabilite) : 'Non noté : données de rendement insuffisantes'}.`}>
          <Cle valeur={fiche.score_vulnerabilite === null ? '—' : nombre(fiche.score_vulnerabilite)} unite={fiche.score_vulnerabilite === null ? undefined : '/ 100'} libelle={fiche.rang_vulnerabilite ? `rang ${fiche.rang_vulnerabilite} sur ${classement.length}` : 'non noté'} teinte={fiche.score_vulnerabilite === null ? undefined : teinteVulnerabilite(fiche.score_vulnerabilite)} />
          <Cle valeur={nombre(fiche.score_alea_secheresse)} libelle="aléa sécheresse" />
          <Cle valeur={fiche.score_sensibilite_rendement === null ? '—' : nombre(fiche.score_sensibilite_rendement)} libelle="sensibilité des rendements" />
        </Reponse>
      ) : (
        <Reponse titre="Où agir d’abord" phrase="Les départements où une mauvaise saison pèse le plus. Les 5 premiers :">
          {tete && <Cle large valeur={tete.departement} libelle={`le plus vulnérable, score ${nombre(tete.score_vulnerabilite)}`} teinte={teinteVulnerabilite(tete.score_vulnerabilite)} />}
          {data && <Cle valeur={classement.length} unite="dép." libelle="notés" />}
        </Reponse>
      )}
      {!data && <Squelette lignes={6} />}

      {!fiche && data && (
        <ol className="mt-4">
          {classement.slice(0, 5).map((v, i) => <Rang key={v.code_departement} rang={i + 1} nom={v.departement} part={v.score_vulnerabilite} couleur={couleurVulnerabilite(v.score_vulnerabilite)} valeur={nombre(v.score_vulnerabilite)} onClick={() => cadre.choisir(v.code_departement)} />)}
        </ol>
      )}

      {data && <Detail libelle={fiche ? 'Voir le détail' : `Voir les ${classement.length} départements`}>
      {fiche && (
        <Groupe titre="Ce qui fait le score">
          <Lignes>
            <Ligne libelle="Saisons en alerte sécheresse" valeur={pct(fiche.freq_alerte_secheresse_pct)} />
            <Ligne libelle="Pluie d'une année sèche" valeur={mm(fiche.pluie_saison_annee_seche_mm)} />
            <Ligne libelle="Variabilité de la pluie" valeur={pct(fiche.variabilite_pluie_cv_pct)} />
            <Ligne libelle="Variabilité des rendements" valeur={pct(fiche.variabilite_rendement_pct)} detail={fiche.confiance_rendement === 'faible' ? 'confiance faible' : undefined} />
          </Lignes>
        </Groupe>
      )}

      {data && (
        <Groupe titre="Classement" complement={`${classement.length} départements`}>
          <ol>
            {classement.map((v, i) => (
              <Rang key={v.code_departement} rang={i + 1} nom={v.departement} part={v.score_vulnerabilite} couleur={couleurVulnerabilite(v.score_vulnerabilite)} valeur={nombre(v.score_vulnerabilite)}
                actif={v.code_departement === code} onClick={() => cadre.choisir(v.code_departement)} />
            ))}
          </ol>
        </Groupe>
      )}
      </Detail>}
      {fiche && <div className="mt-3"><Lien onClick={() => cadre.choisir(null)}>Revenir au classement du pays</Lien></div>}

      <Methode>
        <p>Score relatif et indicatif (méthode v1), à valider avec les techniciens. Aléa sécheresse 60 %, sensibilité des rendements 40 %.</p>
        {nonNotes.length > 0 && <p>Non notés, jamais comptés comme 0 : {nonNotes.join(', ')}.</p>}
        <p>La Vallée du fleuve est en tête alors qu'une grande partie de son agriculture est irriguée : l'aléa pluvial peut y surestimer la vulnérabilité.</p>
      </Methode>
    </div>
  )
}
