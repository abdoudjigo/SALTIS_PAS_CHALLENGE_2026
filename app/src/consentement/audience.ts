// Mesure d'audience (Umami, auto-hébergé, sans cookie) : le script n'est chargé qu'après « Accepter » dans le
// bandeau, et seulement si un identifiant de site est configuré (VITE_UMAMI_ID). Il est servi par le site
// lui-même sous /stats (deploy/Caddyfile) : même origine, rien à ajouter à la CSP.
//
// Changer d'avis après coup : un script chargé ne peut pas être retiré, mais Umami n'envoie plus rien tant que
// « umami.disabled » est posé dans le stockage du navigateur (vérifié avant chaque envoi par son script).
import { config } from '../config'
import { consentement } from './consentement'

const CLE_ARRET = 'umami.disabled'
let charge = false

function appliquer() {
  if (!config.umamiId) return
  const accord = consentement.audienceAcceptee()
  try {
    if (accord) localStorage.removeItem(CLE_ARRET)
    else localStorage.setItem(CLE_ARRET, '1')
  } catch {
    /* stockage indisponible : sans accord, le script n'est de toute façon pas chargé */
  }
  if (!accord || charge) return
  charge = true
  const script = document.createElement('script')
  script.defer = true
  script.src = '/stats/script.js'
  script.dataset.websiteId = config.umamiId
  script.dataset.hostUrl = `${location.origin}/stats`
  // Respect du réglage « Ne pas me suivre » du navigateur ; ni paramètres d'adresse ni ancres enregistrés
  script.dataset.doNotTrack = 'true'
  script.dataset.excludeSearch = 'true'
  script.dataset.excludeHash = 'true'
  document.head.appendChild(script)
}

/** À appeler une fois au démarrage : applique le choix actuel, puis chaque changement d'avis. */
export function demarrerMesureAudience() {
  appliquer()
  consentement.subscribe(appliquer)
}
