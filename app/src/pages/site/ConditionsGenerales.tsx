import { Link } from 'react-router'
import { PAGES } from '../../lib/pages'
import { PageSite, Partie } from './PageSite'

const LIEN = 'font-medium text-vert-700 underline underline-offset-4'

export default function ConditionsGenerales() {
  return (
    <PageSite titre={PAGES.conditionsGenerales.titre} description={PAGES.conditionsGenerales.description} chapeau="Les règles d'usage de la plateforme : ce qu'elle propose, ce qu'elle ne garantit pas, et ce qu'on peut faire de ses contenus.">
      <Partie titre="Objet">
        <p>
          Assaman & Suuf est un prototype d'aide à la décision agricole pour les 45 départements du Sénégal, réalisé par l'équipe AKAI dans le cadre du SALTIS PAS Challenge 2026.
          Utiliser la plateforme vaut acceptation des présentes conditions.
        </p>
      </Partie>

      <Partie titre="Accès">
        <ul className="list-disc space-y-2 pl-5">
          <li>L'accès est gratuit et sans création de compte : on entre par un profil (agriculteur, ou ONG et services de l'État).</li>
          <li>La plateforme est un prototype : elle peut être interrompue, modifiée ou arrêtée sans préavis, et certaines fonctions s'appuient sur des données d'exemple.</li>
        </ul>
      </Partie>

      <Partie titre="Estimations indicatives">
        <p>
          Les prévisions, niveaux d'adéquation, besoins en intrants et propositions de répartition sont des <strong>estimations indicatives, pas des garanties</strong>.
          Plusieurs doses agronomiques ne sont pas encore validées par un spécialiste ; leur statut est affiché avec chaque valeur.
        </p>
        <p>
          Ces informations complètent l'avis des services techniques et des conseillers agricoles, sans le remplacer. Les décisions de semis, d'achat ou de répartition d'intrants restent de la responsabilité de l'utilisateur.
          La façon dont les chiffres sont produits est décrite sur la page <Link to="/methode" className={LIEN}>Méthode</Link>.
        </p>
      </Partie>

      <Partie titre="Usage autorisé">
        <ul className="list-disc space-y-2 pl-5">
          <li>Consulter la plateforme et s'en servir pour préparer une campagne ou une répartition d'intrants.</li>
          <li>Ne pas chercher à perturber le service : pas de requêtes automatisées massives, pas de tentative d'accès aux systèmes qui l'hébergent.</li>
          <li>Ne pas présenter les estimations comme des données officielles ou validées.</li>
        </ul>
      </Partie>

      <Partie titre="Contenus et données">
        <p>
          Les textes, l'interface et les illustrations de la plateforme appartiennent à l'équipe AKAI. Les données viennent de sources tierces, chacune sous sa propre licence, détaillées sur la page <Link to="/donnees" className={LIEN}>Données</Link>.
          Les contours GADM sont réservés à un usage non commercial et doivent être cités : « GADM, version 4.1, https://gadm.org ».
        </p>
        <p>Toute reprise d'un chiffre ou d'une carte doit citer Assaman & Suuf et la source d'origine de la donnée.</p>
      </Partie>

      <Partie titre="Responsabilité">
        <p>
          L'équipe AKAI s'efforce de fournir des informations exactes, sans garantir qu'elles soient complètes, à jour ou exemptes d'erreurs.
          Elle ne peut être tenue responsable des décisions prises sur la base de la plateforme, ni d'une interruption du service ou des services tiers qu'elle utilise (fond de carte, synthèse vocale).
        </p>
      </Partie>

      <Partie titre="Données personnelles">
        <p>Ce que la plateforme enregistre est décrit dans la <Link to="/confidentialite" className={LIEN}>politique de confidentialité</Link>.</p>
      </Partie>

      <Partie titre="Droit applicable et modifications">
        <p>
          Les présentes conditions sont soumises au droit sénégalais. Elles peuvent évoluer avec la plateforme ; la version en vigueur est celle publiée sur cette page.
          Dernière mise à jour : 16 novembre 2026. Une question : page <Link to="/contact" className={LIEN}>Contact</Link>.
        </p>
      </Partie>
    </PageSite>
  )
}
