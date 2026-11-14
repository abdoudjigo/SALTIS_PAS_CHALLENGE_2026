import { Link } from 'react-router'
import { PagePublique, Rubrique } from '../../vitrine/PagePublique'

const QUESTIONS = [
  { question: 'Quelle pluie, quelle saison ?', reponse: "Le bilan de chaque saison des pluies depuis 1981 et, pendant la campagne, le cumul de pluie comparé à la normale tous les dix jours." },
  { question: 'Que semer, avec quel cycle ?', reponse: "Pour 12 cultures, la chance qu'un cycle court, moyen ou long aille au bout de la saison dans le département." },
  { question: "Combien d'engrais et de semences ?", reponse: 'Des besoins de référence par département et par culture : superficie cultivée multipliée par la dose de la zone.' },
  { question: 'Où porter les intrants ?', reponse: "Pour une ONG ou un service de l'État : les territoires prioritaires selon leurs besoins et leur vulnérabilité." },
]

const PUBLICS = [
  { qui: 'Producteurs', quoi: 'Préparer la campagne, choisir la culture et le cycle, estimer leurs propres besoins.' },
  { qui: 'Conseillers agricoles', quoi: 'Relayer les recommandations auprès des producteurs de leur département.' },
  { qui: "Services de l'État", quoi: 'Anticiper les besoins, planifier et répartir leurs intrants.' },
  { qui: 'ONG', quoi: 'Cibler les territoires les plus vulnérables et y orienter leurs ressources.' },
]

const EQUIPE = [
  { nom: 'Abdoulaye Djigo', role: 'Ingénierie des données, déploiement, responsable technique' },
  { nom: 'Ndèye Khady Mbaye', role: 'Animation de l’équipe, analyse des données' },
  { nom: 'Aby Faye', role: 'Ingénierie des données, coordination' },
  { nom: 'Ibrahima Niass Diouf', role: 'Responsable du produit, science des données' },
  { nom: 'Anthony Exaucé M.', role: 'Développement de l’application' },
]

const SOURCES = [
  'CHIRPS : pluie journalière, 1981-2025',
  'NASA POWER : climat, en secours de CHIRPS',
  'SoilGrids : pH, texture et réserve en eau des sols',
  'DAPSA : superficies, productions et rendements par département',
  'FAOSTAT : repères nationaux',
  'GADM 4.1 : codes et découpage des départements',
]

export default function APropos() {
  return (
    <PagePublique
      surtitre="À propos"
      titre="Relier la pluie du ciel à chaque champ du Sénégal."
      chapeau="Assaman veut dire le ciel et Suuf la terre, en wolof. La plateforme croise le climat, les sols et les rendements pour aider à décider, département par département, avant et pendant la campagne agricole."
    >
      <Rubrique titre="Le problème">
        <p>
          Au Sénégal, l'essentiel de l'agriculture dépend de la pluie. Une saison courte ou longue, abondante ou faible, ne
          demande ni la même culture, ni la même variété, ni les mêmes intrants. Les données pour le savoir existent, mais
          elles sont dispersées et difficiles à lire.
        </p>
        <p>Assaman & Suuf les rassemble et les rend lisibles à l'échelle où l'on décide : le département.</p>
      </Rubrique>

      <Rubrique titre="Quatre questions">
        <dl className="space-y-6">
          {QUESTIONS.map((q) => (
            <div key={q.question}>
              <dt className="font-titre text-xl text-white">{q.question}</dt>
              <dd className="mt-1">{q.reponse}</dd>
            </div>
          ))}
        </dl>
      </Rubrique>

      <Rubrique titre="Pour qui">
        <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {PUBLICS.map((p) => (
            <div key={p.qui}>
              <dt className="font-medium text-soleil-500">{p.qui}</dt>
              <dd className="mt-1">{p.quoi}</dd>
            </div>
          ))}
        </dl>
      </Rubrique>

      <Rubrique titre="Notre exigence">
        <p>
          Une valeur absente s'affiche « non disponible », jamais zéro. Une dose d'engrais ou de semis qui n'a pas été validée
          par un spécialiste porte la mention « à confirmer avec l'ISRA ». Le score de vulnérabilité compare les départements
          entre eux : il est relatif et indicatif, et c'est écrit à côté du chiffre.
        </p>
        <p>Les besoins en intrants sont des besoins de référence, calculés sur les superficies passées. Ce ne sont pas des prévisions.</p>
      </Rubrique>

      <Rubrique titre="Les données">
        <ul className="space-y-2">
          {SOURCES.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p>Le détail des licences et des crédits figure dans les <Link to="/mentions-credits" className="text-soleil-500 underline-offset-4 hover:underline">mentions et crédits</Link>.</p>
      </Rubrique>

      <Rubrique titre="L'équipe AKAI">
        <p>
          AKAI, pour Alliance for Knowledge, Action & Innovation. Le projet est développé pour le SALTIS PAS Challenge 2026.
        </p>
        <ul className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {EQUIPE.map((m) => (
            <li key={m.nom}>
              <div className="font-medium text-white">{m.nom}</div>
              <div className="text-sm">{m.role}</div>
            </li>
          ))}
        </ul>
        <p>
          Une question, une donnée à corriger, un partenariat ? <Link to="/contact" className="text-soleil-500 underline-offset-4 hover:underline">Écrivez-nous</Link>.
        </p>
      </Rubrique>
    </PagePublique>
  )
}
