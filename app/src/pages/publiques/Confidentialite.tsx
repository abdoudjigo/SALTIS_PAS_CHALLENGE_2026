import { Link } from 'react-router'
import { config } from '../../config'
import { PagePublique, Rubrique } from '../../vitrine/PagePublique'

export default function Confidentialite() {
  return (
    <PagePublique
      surtitre="Politique de confidentialité"
      titre="Ce que nous savons de vous, et ce que nous en faisons."
      chapeau="Le moins possible, et seulement pour faire fonctionner la plateforme. Version du 11 novembre 2026."
    >
      <Rubrique titre="Les données que vous nous confiez">
        <p>
          Pour créer un compte producteur, nous demandons votre nom, votre adresse email, un mot de passe et le département de vos
          champs. Le département sert à vous montrer directement la pluie, les cultures et les besoins de votre territoire.
        </p>
        <p>
          Les comptes des organisations (ONG, services de l'État) et des conseillers sont créés par un administrateur, avec le nom,
          l'email et l'organisation de la personne.
        </p>
      </Rubrique>

      <Rubrique titre="Ce qui reste sur votre appareil">
        <p>
          Une fois connecté, votre session et le dernier département consulté sont gardés dans le stockage de votre navigateur, pour
          vous éviter de vous reconnecter à chaque visite. La déconnexion efface la session et les données affichées.
        </p>
        <p>
          La plateforme peut s'installer sur le téléphone et fonctionner sans connexion : les pages et les données déjà consultées
          sont alors conservées sur l'appareil.
        </p>
      </Rubrique>

      {config.authDemo && (
        <Rubrique titre="Version de démonstration">
          <p>
            Cette version fonctionne avec des comptes de démonstration. Un compte créé ici reste dans votre navigateur et n'est envoyé
            à aucun serveur : n'y utilisez pas un mot de passe que vous employez ailleurs.
          </p>
        </Rubrique>
      )}

      <Rubrique titre="Ce que nous ne faisons pas">
        <p>Pas de publicité, pas de traceur publicitaire, pas de revente de données.</p>
      </Rubrique>

      <Rubrique titre="Les services tiers">
        <p>
          Le globe et les cartes sont fournis par Mapbox. Lorsqu'une carte s'affiche, votre navigateur charge des éléments depuis les
          serveurs de Mapbox, qui reçoivent alors des informations techniques comme votre adresse IP.
        </p>
      </Rubrique>

      <Rubrique titre="Les données agricoles">
        <p>
          Les données de pluie, de sols, de rendements et de besoins affichées par la plateforme sont des données par département,
          issues de sources publiques. Elles ne décrivent aucune exploitation ni aucune personne.
        </p>
      </Rubrique>

      <Rubrique titre="Vos droits">
        <p>
          Conformément à la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel, vous
          pouvez demander l'accès à vos données, leur rectification ou leur suppression, et vous opposer à leur traitement. Vous pouvez
          aussi saisir la Commission de protection des données personnelles (CDP).
        </p>
        <p>
          Pour exercer ces droits :{' '}
          {config.emailContact
            ? <a href={`mailto:${config.emailContact}`} className="text-soleil-500 underline-offset-4 hover:underline">{config.emailContact}</a>
            : <Link to="/contact" className="text-soleil-500 underline-offset-4 hover:underline">page de contact</Link>}.
        </p>
      </Rubrique>
    </PagePublique>
  )
}
