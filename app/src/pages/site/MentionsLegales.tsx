import { PageSite, Partie } from './PageSite'

export default function MentionsLegales() {
  return (
    <PageSite titre="Mentions légales et confidentialité" chapeau="Qui publie la plateforme, ce qu'elle enregistre, et les crédits des données.">
      <Partie titre="Éditeur">
        <p>Assaman & Suuf est un prototype réalisé par l'équipe AKAI dans le cadre du SALTIS PAS Challenge 2026.</p>
      </Partie>
      <Partie titre="Données personnelles">
        <ul className="list-disc space-y-2 pl-5">
          <li>On entre sur la plateforme par un profil (agriculteur, ou ONG et services de l'État), sans créer de compte ni donner son nom.</li>
          <li>La position choisie, la surface et les doses saisies restent dans le navigateur ; elles ne sont pas enregistrées sur nos serveurs.</li>
          <li>Aucun cookie publicitaire. Le fond de carte est chargé auprès de Mapbox, qui reçoit l'adresse IP comme tout service de cartes.</li>
        </ul>
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
