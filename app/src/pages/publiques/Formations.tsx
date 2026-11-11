import { Link } from 'react-router'
import { PagePublique } from '../../vitrine/PagePublique'

const MODULES = [
  {
    titre: 'Lire la carte des saisons',
    public: 'Tous les profils',
    contenu: "Comprendre la pluie d'une saison, son écart à la normale et les alertes de sécheresse ou d'excès de pluie d'un département.",
  },
  {
    titre: 'Suivre la campagne tous les dix jours',
    public: 'Producteurs, conseillers',
    contenu: 'Lire le cumul de pluie depuis juin, le comparer à la normale et savoir si la saison est en avance ou en retard.',
  },
  {
    titre: 'Choisir la culture et le cycle',
    public: 'Producteurs, conseillers',
    contenu: 'Comparer les cycles court, moyen et long d’une culture, et comprendre les mentions « adaptée », « à risque » et « déconseillée ».',
  },
  {
    titre: 'Estimer les besoins en intrants',
    public: 'Producteurs, organisations',
    contenu: 'Lire un besoin de référence, distinguer une dose connue d’une « dose à saisir », et ne pas confondre référence et prévision.',
  },
  {
    titre: 'Répartir un stock avec AgroDistrib',
    public: "ONG, services de l'État",
    contenu: 'Déclarer un stock, comparer les répartitions proposées, les ajuster et les valider, en tenant compte de la vulnérabilité.',
  },
]

export default function Formations() {
  return (
    <PagePublique
      surtitre="Formations"
      titre="Apprendre à lire le ciel et la terre."
      chapeau="Des modules courts, en français, pensés pour le terrain et pour le téléphone. Ils sont en préparation : voici ce qu'ils couvriront."
    >
      <ol className="border-t border-white/10">
        {MODULES.map((m, i) => (
          <li key={m.titre} className="grid gap-x-10 gap-y-2 border-b border-white/10 py-8 md:grid-cols-[5rem_minmax(0,1.2fr)_minmax(0,2fr)]">
            <span className="font-titre text-4xl leading-none text-soleil-500">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <h2 className="font-titre text-2xl leading-tight font-medium">{m.titre}</h2>
              <p className="mt-2 text-sm text-brume">{m.public}</p>
            </div>
            <div className="max-w-xl">
              <p className="leading-relaxed text-white/75">{m.contenu}</p>
              <span className="mt-3 inline-flex rounded-full border border-white/20 px-3 py-1 text-xs text-white/60">en préparation</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-10 max-w-2xl leading-relaxed text-white/75">
        Vous accompagnez des producteurs et souhaitez une session pour votre structure ?{' '}
        <Link to="/contact" className="text-soleil-500 underline-offset-4 hover:underline">Contactez-nous</Link>.
      </p>
    </PagePublique>
  )
}
