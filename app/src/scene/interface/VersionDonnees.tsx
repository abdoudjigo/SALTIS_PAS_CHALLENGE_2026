// Sous les résultats : la date de la dernière mise à jour des données de la plateforme (audit, constat ARC-03).
// Rien en mode démonstration (aucune réponse de l'API, donc aucune version).
import { dateVersion, useVersionDonnees } from '../../api/versionDonnees'

const FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' })

export function VersionDonnees() {
  const version = useVersionDonnees()
  if (!version) return null
  const date = dateVersion(version)
  return (
    <p className="mt-4 text-2xs text-white/50" title={`Version des données : ${version}`}>
      {date ? `Données de la plateforme mises à jour le ${FORMAT.format(date)}.` : `Version des données : ${version}.`}
    </p>
  )
}
