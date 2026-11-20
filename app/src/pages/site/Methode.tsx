import { PAGES } from '../../lib/pages'
import { PageSite, Partie, Tableau } from './PageSite'

export default function Methode() {
  return (
    <PageSite
      titre={PAGES.methode.titre}
      description={PAGES.methode.description}
      chapeau="Trois modèles d'intelligence artificielle, entraînés sur 45 ans de pluie et 25 ans de rendements, testés sur des années qu'ils n'ont jamais vues."
    >
      <Partie titre="La pluie de la saison qu'on prépare">
        <p>
          La saison des pluies du Sahel dépend en partie de la température des océans au printemps : un El Niño fort l'assèche, un Atlantique sud chaud l'arrose. Le modèle apprend ce lien sur 1981-2025.
        </p>
        <Tableau
          colonnes={['Année choisie', 'Comment on prévoit', 'Erreur moyenne sur la pluie']}
          lignes={[
            ['L\'année dont l\'océan de mars à mai est connu (2026)', 'Prévision océan : températures de l\'océan de mars à mai (NOAA)', '113 mm'],
            ['Les années suivantes (2027-2035)', 'Prévision de tendance : moyenne des 15 dernières saisons du département, précisée fin mai de l\'année', '115 mm'],
            ['Référence', 'La pluie normale (1991-2020)', '122 mm'],
          ]}
        />
        <p>Erreurs mesurées en prévoyant les saisons 2016-2025. La même approche, statistique et apprentissage sur les températures de l'océan, est celle du centre régional AGRHYMET.</p>
      </Partie>

      <Partie titre="La récolte attendue">
        <p>
          Pour l'arachide, le mil, le sorgho, le niébé et le maïs : la récolte d'une année difficile, d'une année moyenne et d'une bonne année, et le risque d'une chute de plus de 20 % par rapport à la récolte habituelle. Le modèle combine la prévision de pluie, la pluie déjà tombée et les récoltes passées du département.
        </p>
        <p>
          <strong>Ce qu'il faut savoir</strong> : prouvée sur les années de test, la prévision d'une chute de récolte ne l'est que pour l'arachide, à partir de fin juillet. Ailleurs, l'écran présente un risque habituel, pas une prévision de l'année.
        </p>
      </Partie>

      <Partie titre="La période de semis">
        <p>
          Semer trop tôt expose à un faux départ (la pluie de semis, puis deux décades sèches). Semer trop tard expose à une saison qui s'arrête avant la récolte. Le modèle calcule les deux risques pour chaque décade de juin à août et conseille la période la plus sûre, culture par culture.
        </p>
        <p>Il repère les situations à risque nettement mieux que la fréquence passée (indice de discrimination 0,83 contre 0,76). Les seuils de pluie utilisés restent à valider avec les agronomes.</p>
      </Partie>

      <Partie titre="Comment nous testons">
        <ul className="list-disc space-y-2 pl-5">
          <li>Les années ne sont jamais mélangées au hasard : on apprend sur le passé, on teste sur les années suivantes.</li>
          <li>Les réglages sont choisis sans regarder les années de test.</li>
          <li>Chaque modèle est comparé à une prévision simple ; la fiabilité est affichée dans l'application, sous chaque résultat.</li>
        </ul>
      </Partie>
    </PageSite>
  )
}
