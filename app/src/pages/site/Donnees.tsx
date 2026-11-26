import { PAGES } from '../../lib/pages'
import { PageSite, Partie, Tableau } from './PageSite'

export default function Donnees() {
  return (
    <PageSite
      titre={PAGES.donnees.titre}
      description={PAGES.donnees.description}
      chapeau="Toutes les données sont publiques. Elles sont nettoyées, contrôlées et testées avant d'arriver sur la carte."
    >
      <Partie titre="D'où viennent les données">
        <Tableau
          colonnes={['Donnée', 'Source', 'Période']}
          lignes={[
            ['Pluie par jour et par période de 10 jours', 'CHIRPS (Climate Hazards Center, Université de Californie à Santa Barbara)', '1981-2025'],
            ['Climat (températures, évaporation, humidité du sol)', 'NASA POWER', '1981-2025'],
            ['Sols (texture, pH, réserve en eau, carbone)', 'SoilGrids (ISRIC)', '—'],
            ['Rendements et superficies par département', 'DAPSA, Ministère de l\'Agriculture, via HarvestStat et FEWS NET', '1981-2021'],
            ['Rendements nationaux', 'FAOSTAT (FAO)', '—'],
            ['Températures des océans (El Niño, Atlantique)', 'NOAA', '1981-2026'],
            ['Doses d\'engrais et de semences (à confirmer)', 'IFDC-CORAF, catalogue des Paquets d\'Intrants Agricoles ; fiches variétales ISRA', '—'],
            ['Insécurité alimentaire par département', 'Cadre harmonisé, CILSS et partenaires ; données via HDX (Food Security and Nutrition Working Group, Afrique de l\'Ouest et du Centre)', '2014-2026'],
            ['Prix des intrants subventionnés', 'APS (septembre 2025) ; circulaire du ministère de l\'Agriculture du 30 avril 2026', '2026'],
            ['Eau de surface (présente 10 mois sur 12)', 'JRC Global Surface Water, Commission européenne (Copernicus)', 'jusqu\'à 2021'],
            ['Nappes souterraines (profondeur, débit d\'un forage)', 'British Geological Survey (BGS)', '—'],
            ['Irrigation existante', 'FAO GMIA ; végétation de saison sèche MODIS et occupation du sol ESA WorldCover', 'vers 2005 ; 2021-2024'],
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
          <li>Les récoltes par département s'arrêtent en 2021 et changent de définition en 2016 (superficie récoltée, puis superficie semée).</li>
          <li>Les doses d'engrais validées manquent pour la plupart des cultures : elles sont attendues de l'ISRA. L'application affiche « dose à saisir ».</li>
          <li>Keur Massar, créé en 2021, est compté avec Pikine pour le Cadre harmonisé.</li>
          <li>La carte de l'eau de surface s'arrête en 2021 : les retenues récentes peuvent manquer ; les nappes donnent un ordre de grandeur par département, pas l'emplacement d'un forage.</li>
          <li>Guédiawaye n'a pas de série de pluie par période de 10 jours ; Guédiawaye et Pikine n'ont pas de superficie agricole de référence.</li>
        </ul>
      </Partie>

      <Partie titre="Licences">
        <p>Chaque source garde sa licence. Les contours GADM sont réservés à un usage non commercial et doivent être cités : « GADM, version 4.1, https://gadm.org ». Les données du Cadre harmonisé sont sous licence CC BY : « Cadre harmonisé, CILSS et partenaires ; données via HDX (Food Security and Nutrition Working Group, Afrique de l'Ouest et du Centre) ». Nappes : « Based upon mapping provided by British Geological Survey © NERC 2012 ». JRC/Copernicus, FAO, ESA WorldCover et MODIS : libres, avec citation.</p>
      </Partie>
    </PageSite>
  )
}
