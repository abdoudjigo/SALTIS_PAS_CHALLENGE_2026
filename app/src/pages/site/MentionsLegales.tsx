import { Link } from 'react-router'
import { PAGES } from '../../lib/pages'
import { PageSite, Partie } from './PageSite'

export default function MentionsLegales() {
  return (
    <PageSite titre={PAGES.mentionsLegales.titre} description={PAGES.mentionsLegales.description} chapeau="Qui publie la plateforme, la portée de ses estimations, et les crédits des données.">
      <Partie titre="Éditeur">
        <p>Assaman & Suuf est un prototype réalisé par l'équipe AKAI dans le cadre du SALTIS PAS Challenge 2026.</p>
      </Partie>
      <Partie titre="Hébergement">
        <p>Le site, l'API et la mesure d'audience sont hébergés sur un serveur privé virtuel loué à Hostinger. Le fond de carte est fourni par Mapbox.</p>
      </Partie>
      <Partie titre="Données personnelles">
        <p>
          Pas de compte, pas de cookie publicitaire ; vos saisies restent dans le navigateur. Le détail est dans la{' '}
          <Link to="/confidentialite" className="font-medium text-vert-700 underline underline-offset-4">politique de confidentialité</Link>.
        </p>
      </Partie>
      <Partie titre="Estimations indicatives">
        <p>Les prévisions sont des estimations indicatives, pas des garanties. Elles complètent l'avis des services techniques et des conseillers agricoles, sans le remplacer.</p>
      </Partie>
      <Partie titre="Crédits">
        <p>CHIRPS, NASA POWER, SoilGrids (ISRIC), DAPSA, HarvestStat, FEWS NET, FAOSTAT, NOAA, Mapbox et OpenStreetMap. Contours : « GADM, version 4.1, https://gadm.org ». Détail sur la page Données.</p>
      </Partie>
    </PageSite>
  )
}
