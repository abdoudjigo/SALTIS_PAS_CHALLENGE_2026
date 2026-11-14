import { PagePublique, Rubrique } from '../../vitrine/PagePublique'

const LIEN = 'text-soleil-500 underline-offset-4 hover:underline'

export default function MentionsCredits() {
  return (
    <PagePublique
      surtitre="Mentions et crédits"
      titre="Qui publie ce site, et d'où viennent ses données."
      chapeau="Rien de ce que vous voyez ici n'existerait sans des données ouvertes et le travail de ceux qui les produisent."
    >
      <Rubrique titre="Éditeur">
        <p>
          Assaman & Suuf est développé par l'équipe AKAI (Alliance for Knowledge, Action & Innovation) dans le cadre du SALTIS PAS
          Challenge 2026.
        </p>
        <p>La plateforme est un outil d'aide à la décision. Elle ne remplace ni le conseil d'un technicien agricole, ni les bulletins officiels.</p>
      </Rubrique>

      <Rubrique titre="Données">
        <ul className="space-y-2">
          <li>Pluie : CHIRPS (Climate Hazards Center, UC Santa Barbara) et NASA POWER.</li>
          <li>Sols : SoilGrids (ISRIC).</li>
          <li>Superficies, productions et rendements : DAPSA, via HarvestStat et FEWS NET ; repères nationaux FAOSTAT.</li>
          <li>Découpage administratif : GADM, version 4.1, <a href="https://gadm.org" target="_blank" rel="noreferrer" className={LIEN}>gadm.org</a>, usage non commercial.</li>
        </ul>
        <p>Les doses d'engrais et de semis proviennent de références agronomiques publiées. Celles qui ne sont pas validées sont signalées « à confirmer avec l'ISRA ».</p>
      </Rubrique>

      <Rubrique titre="Cartes">
        <p>
          Fonds de carte et globe : © Mapbox, © OpenStreetMap. Les vents affichés sur le globe de la page d'accueil sont des prévisions
          mondiales fournies par Mapbox. Ils servent de décor et ne font pas partie des données du projet.
        </p>
      </Rubrique>

      <Rubrique titre="Photographie">
        <p>
          Champ d'arachide de la page d'accueil : « Culture d'arachide à Djissa Aliou (Kaolack) 13 », par Amadou250599Ba, juillet 2023,{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Culture_d%27arachide_%C3%A0_Djissa_Aliou_(Kaolack)_13.jpg" target="_blank" rel="noreferrer" className={LIEN}>Wikimedia Commons</a>,
          licence{' '}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noreferrer" className={LIEN}>CC BY-SA 4.0</a>.
          L'image a été recadrée et assombrie.
        </p>
      </Rubrique>

      <Rubrique titre="Typographies">
        <p>Fraunces et Inter, sous licence SIL Open Font License.</p>
      </Rubrique>
    </PagePublique>
  )
}
