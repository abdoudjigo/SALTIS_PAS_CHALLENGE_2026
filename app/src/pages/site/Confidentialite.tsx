import { Link } from 'react-router'
import { config } from '../../config'
import { consentement } from '../../consentement/consentement'
import { PAGES } from '../../lib/pages'
import { AdresseContact } from './AdresseContact'
import { PageSite, Partie, Tableau } from './PageSite'

const LIEN = 'font-medium text-vert-700 underline underline-offset-4'

export default function Confidentialite() {
  return (
    <PageSite titre={PAGES.confidentialite.titre} description={PAGES.confidentialite.description} chapeau="Ce que la plateforme enregistre, ce qui reste dans votre navigateur, et ce que reçoivent les services qu'elle utilise.">
      <Partie titre="En bref">
        <ul className="list-disc space-y-2 pl-5">
          <li>Pas de compte, pas de nom, pas d'adresse e-mail : on entre par un profil (agriculteur, ou ONG et services de l'État).</li>
          <li>Ce que vous saisissez (position de la parcelle, surface, doses, stocks) reste dans votre navigateur.</li>
          <li>Aucun cookie publicitaire, aucune revente de données.</li>
        </ul>
      </Partie>

      <Partie titre="Responsable du traitement">
        <p>
          Assaman & Suuf est un prototype réalisé par l'équipe AKAI dans le cadre du SALTIS PAS Challenge 2026.
          {config.aUnContact ? (
            <> Pour toute question sur vos données : <AdresseContact libelle="afficher l'adresse e-mail" />.</>
          ) : (
            <> Pour toute question sur vos données, passez par la page <Link to="/contact" className={LIEN}>Contact</Link>.</>
          )}
        </p>
      </Partie>

      <Partie titre="Données traitées">
        <Tableau
          colonnes={['Donnée', 'Où elle se trouve', 'À quoi elle sert']}
          lignes={[
            ['Profil choisi à l\'entrée (agriculteur, ou organisation), sans nom ni compte', 'Votre navigateur (stockage local)', 'Rouvrir la carte sans repasser par l\'accueil'],
            ['Choix sur les cookies', 'Votre navigateur (stockage local), 6 mois', 'Ne pas reposer la question à chaque visite'],
            ['Position de la parcelle (géolocalisation ou coordonnées saisies)', 'Votre navigateur, le temps de la visite', 'Trouver le département, son sol et ses cultures'],
            ['Surface, doses, stocks et scénarios saisis', 'Votre navigateur', 'Calculer vos besoins et les répartitions'],
            ['Adresse IP', 'Nos serveurs, de façon temporaire', 'Limiter le nombre de requêtes et protéger le service'],
            ['Pages vues, appareil, pays et ville approximative (avec votre accord)', 'Nos serveurs (Umami)', 'Compter les visites, sans cookie'],
            ['Avis d\'une organisation (formulaire « Donner votre avis ») : nom et type de l\'organisation, régions, réponses écrites', 'Envoyé par e-mail à l\'équipe (service Gmail de Google) ; rien n\'est enregistré par la plateforme', 'Améliorer la plateforme avec les ONG et les services de l\'État'],
          ]}
        />
        <p>La géolocalisation n'est demandée que si vous appuyez sur le bouton prévu ; vous pouvez la refuser et choisir votre département dans la liste, ou saisir des coordonnées. La position reste dans votre navigateur : seul le code du département est envoyé à nos serveurs.</p>
      </Partie>

      <Partie titre="Cookies et stockage local">
        <p>
          La plateforme ne dépose aucun cookie publicitaire. Elle utilise le stockage local du navigateur pour fonctionner : garder le profil choisi, vos saisies et votre choix sur les cookies.
          Ce stockage est indispensable et ne demande pas d'accord. Effacer les données du site dans les réglages du navigateur supprime tout.
        </p>
      </Partie>

      <Partie titre="Mesure d'audience">
        {config.umamiId ? (
          <>
            <p>
              Avec votre accord seulement (bandeau affiché à la première visite), le site compte ses visites avec <strong>Umami</strong>, un outil libre que nous hébergeons
              nous-mêmes, sur le même serveur que le site : les données ne partent chez aucun tiers et ne sont ni revendues ni partagées.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Ce qui est enregistré : la page vue (sans les paramètres de l'adresse), le site d'où vous venez, le type d'appareil, la taille d'écran, le navigateur, le système, la langue, et le pays et la ville approximative (déduits de l'adresse IP au moment de la visite).</li>
              <li>Ce qui ne l'est pas : aucun cookie, aucun identifiant durable, ni votre adresse IP elle-même ni vos saisies (position, surface, doses, stocks).</li>
              <li>Le réglage « Ne pas me suivre » de votre navigateur est respecté.</li>
            </ul>
            <p>
              Refuser ne change rien au fonctionnement du site. Votre choix est gardé 6 mois, puis redemandé.{' '}
              <button type="button" onClick={consentement.rouvrir} className={LIEN}>Changer mon choix</button>
            </p>
          </>
        ) : (
          <p>Aucune mesure d'audience n'est active aujourd'hui. Si elle l'est un jour, elle ne démarrera qu'après votre accord.</p>
        )}
      </Partie>

      <Partie titre="Services tiers">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Mapbox</strong> (États-Unis) fournit le fond de carte : il reçoit votre adresse IP et la zone de carte affichée, qui peut être proche de votre parcelle quand la carte s'en approche. À chaque ouverture de la carte, sa bibliothèque garde aussi dans votre navigateur un identifiant aléatoire et envoie un signal de chargement à Mapbox, pour sa facturation.</li>
          <li><strong>Google (Gmail)</strong> transmet à l'équipe les avis envoyés par le formulaire « Donner votre avis ».</li>
          <li><strong>Lecture à voix haute en français</strong> : elle utilise la synthèse vocale de votre navigateur ; selon le navigateur, le texte lu peut être envoyé à son éditeur.</li>
          <li><strong>Voix wolof</strong> : le texte de la page à lire est transformé en voix par notre serveur. Si un service de synthèse externe est activé (Hugging Face), ce texte lui est envoyé. Il ne contient aucune donnée personnelle.</li>
          <li><strong>Hostinger</strong> loue le serveur qui héberge le site, l'API et la mesure d'audience.</li>
        </ul>
      </Partie>

      <Partie titre="Durée de conservation">
        <p>Les données du navigateur restent tant que vous ne les effacez pas. Les adresses IP ne servent qu'à la limitation de débit et aux journaux techniques du serveur ; elles ne sont rattachées à aucun profil. Les avis des organisations restent dans la boîte e-mail de l'équipe.</p>
      </Partie>

      <Partie titre="Vos droits">
        <p>
          Conformément à la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel, vous disposez d'un droit d'accès, de rectification, d'opposition et de suppression.
          Vous pouvez l'exercer en nous écrivant, et saisir la Commission de protection des données personnelles (CDP) si vous estimez que vos droits ne sont pas respectés.
        </p>
      </Partie>

      <Partie titre="Mise à jour">
        <p>Dernière mise à jour : 22 novembre 2026. Cette page est modifiée à chaque changement de ce que la plateforme enregistre.</p>
      </Partie>
    </PageSite>
  )
}
