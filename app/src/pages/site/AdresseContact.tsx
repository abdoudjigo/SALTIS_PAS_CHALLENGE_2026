// Bouton « Afficher l'adresse e-mail » : l'adresse n'entre dans la page qu'au clic (anti-spam, voir src/lib/contact.ts).
import { Mail } from 'lucide-react'
import { useState } from 'react'
import { adresseContact } from '../../lib/contact'

const LIEN = 'font-medium text-vert-700 underline underline-offset-4'

export function AdresseContact({ libelle = "Afficher l'adresse e-mail" }: { libelle?: string }) {
  const [adresse, setAdresse] = useState<string | null>(null)
  if (adresse) return <a href={`mailto:${adresse}`} className={LIEN}>{adresse}</a>
  return (
    <button type="button" onClick={() => setAdresse(adresseContact())} className={`${LIEN} inline-flex min-h-11 items-center gap-2`}>
      <Mail className="size-4" aria-hidden /> {libelle}
    </button>
  )
}
