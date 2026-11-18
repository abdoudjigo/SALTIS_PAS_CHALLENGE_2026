import { PageSite, Partie, Tableau } from './PageSite'

export default function APropos() {
  return (
    <PageSite
      titre="À propos"
      chapeau="Assaman & Suuf (« le ciel et la terre » en wolof) aide les agriculteurs, les ONG et les services de l'État à préparer la campagne agricole au Sénégal : quelle pluie attendre, quoi semer et quand, où porter les intrants."
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
            ['Agriculteur', 'La pluie attendue, la période de semis la plus sûre, la récolte attendue par culture, les semences et engrais pour sa surface.'],
            ['ONG et services de l\'État', 'Les départements à surveiller, les alertes de chute de récolte sur la carte, la vulnérabilité, les besoins du pays et une proposition de répartition d\'un stock.'],
          ]}
        />
        <p>Les 45 départements et les 6 zones agroécologiques du pays sont couverts.</p>
      </Partie>

      <Partie titre="Nos principes">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Une prévision n'est jamais un chiffre seul</strong> : elle porte ses probabilités ou sa fourchette, et sa fiabilité mesurée.</li>
          <li><strong>Ce que nous ne savons pas, nous l'écrivons</strong> : une valeur absente s'affiche « non disponible », jamais zéro ; une dose non validée garde son statut.</li>
          <li><strong>Chaque modèle est comparé à une prévision simple</strong> (la normale, la moyenne des années passées). Là où il ne fait pas mieux, l'écran le dit.</li>
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
