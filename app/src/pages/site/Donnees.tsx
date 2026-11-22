import { PAGES } from '../../lib/pages'
import { config } from '../../config'
import { PageSite, Partie, Tableau } from './PageSite'

export default function Donnees() {
  return (
    <PageSite
      titre={PAGES.donnees.titre}
      description={PAGES.donnees.description}
      chapeau="Toutes les données sont publiques. Elles sont nettoyées, contrôlées et testées avant d'arriver sur la carte."
    >
      <Partie titre="Mode démonstration">
        <div className="rounded-2xl border border-orange-300 bg-orange-50 p-4 text-encre">
          Quand l’application utilise <b>VITE_DONNEES_DEMO=true</b>, les données affichées
          sont synthétiques. Elles ont été générées pour compléter les écrans, mais elles ne
          représentent pas des observations, des prix, des doses, des stocks ou des prévisions
          réels. Le bandeau « Démo · données synthétiques » reste visible dans la plateforme.
        </div>
      </Partie>
      <Partie titre="D'où viennent les données">
        <Tableau
          colonnes={['Donnée', 'Source', 'Période']}
          lignes={[
            ['Pluie journalière et décadaire', 'CHIRPS (Climate Hazards Center, Université de Californie à Santa Barbara)', '1981-2025'],
            ['Climat (températures, évaporation, humidité du sol)', 'NASA POWER', '1981-2025'],
            ['Sols (texture, pH, réserve en eau, carbone)', 'SoilGrids (ISRIC)', '—'],
            ['Rendements et superficies par département', 'DAPSA, Ministère de l\'Agriculture, via HarvestStat et FEWS NET', '1981-2021'],
            ['Rendements nationaux', 'FAOSTAT (FAO)', '—'],
            ['Températures des océans (El Niño, Atlantique)', 'NOAA', '1981-2026'],
            [config.donneesDemo ? 'Doses d\'engrais et de semences (synthétiques)' : 'Doses d\'engrais et de semences (à confirmer)', config.donneesDemo ? 'Génération locale fictive pour démonstration uniquement' : 'IFDC-CORAF, catalogue des Paquets d\'Intrants Agricoles ; fiches variétales ISRA', '—'],
            ['Insécurité alimentaire par département', 'Cadre harmonisé, CILSS et partenaires ; données via HDX (Food Security and Nutrition Working Group, Afrique de l\'Ouest et du Centre)', '2014-2026'],
            ['Prix des intrants subventionnés', 'APS (septembre 2025) ; circulaire du ministère de l\'Agriculture du 30 avril 2026', '2026'],
            ['Contours des départements', 'GADM, version 4.1, https://gadm.org', '—'],
            ['Fond de carte', 'Mapbox, OpenStreetMap', '—'],
          ]}
        />
      </Partie>

      <Partie titre="Comment elles sont préparées">
        <p>
          Les fichiers sont chargés dans un entrepôt de données (Snowflake), puis transformés en tables contrôlées : une par écran de l'application. Chaque règle est testée automatiquement : aucune valeur manquante n'est remplacée par zéro, aucune valeur de zone n'est additionnée deux fois.
        </p>
      </Partie>

      <Partie titre="Limites connues">
        <ul className="list-disc space-y-2 pl-5">
          <li>Les rendements s'arrêtent en 2021 et changent de définition en 2016 (superficie récoltée, puis superficie semée).</li>
          {config.donneesDemo
            ? <li>Le jeu actif est entièrement synthétique : aucune dose, aucun prix ou stock ne doit être utilisé pour une décision réelle.</li>
            : <li>Les doses d'engrais validées manquent pour la plupart des cultures : elles sont attendues de l'ISRA. L'application affiche « dose à saisir ».</li>}
          <li>Guédiawaye n'a pas de série de pluie décadaire ; Guédiawaye et Pikine n'ont pas de superficie agricole de référence.</li>
        </ul>
      </Partie>

      <Partie titre="Licences">
        <p>Chaque source garde sa licence. Les contours GADM sont réservés à un usage non commercial et doivent être cités : « GADM, version 4.1, https://gadm.org ». Les données du Cadre harmonisé sont sous licence CC BY : « Cadre harmonisé, CILSS et partenaires ; données via HDX (Food Security and Nutrition Working Group, Afrique de l'Ouest et du Centre) ».</p>
      </Partie>
    </PageSite>
  )
}
