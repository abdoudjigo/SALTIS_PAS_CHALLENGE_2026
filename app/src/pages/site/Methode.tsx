import { PAGES } from '../../lib/pages'
import { PageSite, Partie, Tableau } from './PageSite'

export default function Methode() {
  return (
    <PageSite
      titre={PAGES.methode.titre}
      description={PAGES.methode.description}
      chapeau="Des estimations par intelligence artificielle, entraînés sur 45 ans de pluie et 25 ans de rendements, testés sur des années qu'ils n'ont jamais vues."
    >
      <Partie titre="La pluie de la saison qu'on prépare">
        <p>
          La saison des pluies du Sahel dépend en partie de la température des océans au printemps : un El Niño fort l'assèche, un Atlantique sud chaud l'arrose. L'estimation apprend ce lien sur 1981-2025.
        </p>
        <Tableau
          colonnes={['Année choisie', 'Comment on prévoit', 'Erreur moyenne sur la pluie']}
          lignes={[
            ['L\'année dont l\'océan de mars à mai est connu (2026)', 'Prévision océan : températures de l\'océan de mars à mai (NOAA)', '113 mm'],
            ['Les années suivantes (2027-2035)', 'Prévision de tendance : moyenne des 15 dernières saisons du département, précisée fin mai de l\'année', '115 mm'],
            ['Référence', 'La pluie moyenne des 30 dernières années (1991-2020)', '122 mm'],
          ]}
        />
        <p>Erreurs mesurées en prévoyant les saisons 2016-2025. La même approche, statistique et apprentissage sur les températures de l'océan, est celle du centre régional AGRHYMET.</p>
      </Partie>

      <Partie titre="La récolte attendue">
        <p>
          Pour l'arachide, le mil, le sorgho, le niébé et le maïs : la récolte d'une année difficile, d'une année moyenne et d'une bonne année, et le risque d'une chute de plus de 20 % par rapport à la récolte habituelle. L'estimation combine la prévision de pluie, la pluie déjà tombée et les récoltes passées du département.
        </p>
        <p>
          <strong>Ce qu'il faut savoir</strong> : prouvée sur les années de test, la prévision d'une chute de récolte ne l'est que pour l'arachide, à partir de fin juillet. Ailleurs, l'écran présente un risque habituel, pas une prévision de l'année.
        </p>
      </Partie>

      <Partie titre="La période de semis">
        <p>
          Semer trop tôt expose à un faux départ (la pluie s'arrête après les premières averses : deux périodes de 10 jours sèches après le semis). Semer trop tard expose à une saison qui s'arrête avant la récolte. L'estimation calcule les deux risques pour chaque période de 10 jours de juin à août et conseille la période la plus sûre, culture par culture.
        </p>
        <p>Il repère les situations à risque nettement mieux que la fréquence passée (indice de discrimination 0,83 contre 0,76). Les seuils de pluie utilisés restent à valider avec les agronomes.</p>
      </Partie>

      <Partie titre="Les cultures adaptées à la zone">
        <p>Pour chaque culture, la plateforme compte la part des saisons des 30 dernières années où la pluie a couvert tout son cycle dans le département. Les niveaux restent indicatifs, à valider avec les conseillers agricoles.</p>
      </Partie>

      <Partie titre="Semences, engrais et budget">
        <p>Les doses par hectare viennent du catalogue des Paquets d'Intrants Agricoles (IFDC-CORAF) et des fiches variétales de l'ISRA. Une dose non confirmée garde ce statut à l'écran ; le fumier est indiqué mais n'entre ni dans les totaux, ni dans le budget, ni dans la répartition. Le budget utilise les prix subventionnés officiels de la campagne ; l'ONG peut saisir ses propres prix d'achat.</p>
      </Partie>

      <Partie titre="Le niveau de fragilité d'un département">
        <p>Il combine les saisons en alerte sécheresse, la pluie d'une année sèche, la variabilité de la pluie et celle des récoltes par hectare. Il est noté sur 100, relatif entre départements et indicatif ; un département sans série de récolte n'est pas noté.</p>
      </Partie>

      <Partie titre="Où agir et comment répartir un stock">
        <p>« Où agir en priorité » croise quatre signaux : la phase du Cadre harmonisé (comptée seulement pour l'année de son cycle), le risque de chute de récolte, la pluie attendue et la fragilité. Pour répartir un stock, trois propositions :</p>
        <Tableau
          colonnes={['Proposition', 'Règle']}
          lignes={[
            ['Multicritère', 'Une part proportionnelle au besoin, majorée selon la fragilité et le gain attendu ; un réglage arbitre entre équité et production.'],
            ['Urgence', 'Les départements les plus graves au Cadre harmonisé d\'abord, puis selon les personnes en phases 3 à 5 et la fragilité.'],
            ['Production', 'Les départements au plus fort potentiel de gain d\'abord, là où la culture est adaptée.'],
          ]}
        />
        <p>La date limite de livraison est le début de la période de semis conseillée. La décision finale reste celle de l'organisation.</p>
      </Partie>

      <Partie titre="Cultiver en saison sèche">
        <p>La plateforme repère l'eau mobilisable près des terres : eau de surface présente 10 mois sur 12, nappe accessible, irrigation déjà en place. C'est un repérage indicatif, pas une étude de faisabilité.</p>
      </Partie>

      <Partie titre="Comment nous testons">
        <ul className="list-disc space-y-2 pl-5">
          <li>Les années ne sont jamais mélangées au hasard : on apprend sur le passé, on teste sur les années suivantes.</li>
          <li>Les réglages sont choisis sans regarder les années de test.</li>
          <li>Chaque estimation est comparée à une prévision simple ; la fiabilité est affichée dans l'application, sous chaque résultat.</li>
        </ul>
      </Partie>
    </PageSite>
  )
}
