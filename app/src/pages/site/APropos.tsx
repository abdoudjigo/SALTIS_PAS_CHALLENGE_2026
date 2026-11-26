import { PAGES } from '../../lib/pages'
import { PageSite, Partie, Tableau } from './PageSite'

export default function APropos() {
  return (
    <PageSite
      titre={PAGES.aPropos.titre}
      description={PAGES.aPropos.description}
      chapeau="Assaman & Suuf (« le ciel et la terre » en wolof) aide les agriculteurs, les ONG et les services de l'État à préparer la campagne agricole au Sénégal : quelle pluie attendre, quoi semer et quand, où porter les semences et les engrais."
    >
      <Partie titre="Le défi">
        <p>
          Au Sénégal, l'agriculture vit au rythme d'une seule saison des pluies, de juin à octobre. <strong>Savoir comment sera la pluie de la saison prochaine</strong> est la première question de qui prépare sa campagne : un agriculteur qui choisit sa culture et sa date de semis, une ONG ou un service de l'État qui décide où envoyer semences et engrais.
        </p>
      </Partie>

      <Partie titre="Ce que fait la plateforme">
        <p>On tape l'année que l'on prépare ; la plateforme prédit, département par département, et en tire le reste.</p>
        <Tableau
          colonnes={['Pour qui', 'Ce qu\'on obtient']}
          lignes={[
            ['Agriculteur', 'Sa parcelle (sol et risques), la pluie attendue, les cultures adaptées à sa zone, la période de semis la plus sûre, les semences et engrais pour sa surface, et l\'eau disponible pour cultiver en saison sèche.'],
            ['ONG et services de l\'État', 'Sept étapes : où agir en priorité (Cadre harmonisé, alerte récolte, pluie, fragilité), la saison qui vient, l\'alerte récolte, les besoins et le budget en francs CFA, la répartition du stock et la date limite de livraison, les zones à fort potentiel, puis le dossier de campagne en PDF.'],
          ]}
        />
        <p>Les 45 départements et les 6 zones agroécologiques du pays sont couverts.</p>
      </Partie>

      <Partie titre="Pensée pour le terrain">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Une seule carte</strong> : chaque question change la carte et ouvre sa réponse, en mots simples, avec une pastille verte, orange ou rouge.</li>
          <li><strong>À écouter</strong> : chaque réponse se lit à voix haute, en français ou en wolof.</li>
          <li><strong>Sur téléphone</strong> : la plateforme s'installe comme une application, et les données déjà consultées restent affichées sans réseau.</li>
          <li><strong>À partager</strong> : l'ONG exporte son dossier de campagne en PDF, et peut nous donner son avis depuis son espace.</li>
        </ul>
      </Partie>

      <Partie titre="Nos principes">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Une prévision n'est jamais un chiffre seul</strong> : elle porte ses chances ou sa fourchette, et sa fiabilité mesurée.</li>
          <li><strong>Ce que nous ne savons pas, nous l'écrivons</strong> : une valeur absente s'affiche « non disponible », jamais zéro ; une dose non validée garde son statut.</li>
          <li><strong>Chaque estimation est comparée à une prévision simple</strong> (la moyenne des années passées). Là où il ne fait pas mieux, l'écran le dit.</li>
        </ul>
      </Partie>

      <Partie titre="L'équipe">
        <p>
          La plateforme est conçue par l'<strong>équipe AKAI</strong> pour le <strong>SALTIS PAS Challenge 2026</strong> : données, modèles d'intelligence artificielle, API et application.
        </p>
      </Partie>
    </PageSite>
  )
}
