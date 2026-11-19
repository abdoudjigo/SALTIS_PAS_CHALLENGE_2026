// Barre de progression de l'export, posée au-dessus de la scène pendant que l'export ouvre les étapes une à une
// (l'étape 7 est alors démontée : la barre ne peut pas vivre dans son composant). Accessible : dialogue modal,
// role="progressbar" avec sa valeur, libellé annoncé (aria-live). Classes et jetons existants seulement.
import type { Progression } from './types'

export interface Barre {
  maj(p: Progression): void
  fermer(): void
}

export function ouvrirBarre(titre: string): Barre {
  const fond = document.createElement('div')
  fond.className = 'fixed inset-0 z-50 grid place-items-start justify-center bg-encre-nuit/40 px-4 pt-24'
  fond.setAttribute('role', 'dialog')
  fond.setAttribute('aria-modal', 'true')
  fond.setAttribute('aria-labelledby', 'export-barre-titre')
  fond.innerHTML = `
    <div class="verre-scene w-full max-w-sm rounded-xl px-4 py-3.5" tabindex="-1">
      <p id="export-barre-titre" class="text-sm font-medium text-white"></p>
      <div class="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-labelledby="export-barre-titre" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <span class="block h-full rounded-full bg-soleil-500 transition-[width] duration-300" style="width:0%"></span>
      </div>
      <p class="mt-2 text-xs leading-snug text-white/75" aria-live="polite"></p>
    </div>`
  fond.querySelector('#export-barre-titre')!.textContent = titre
  const barre = fond.querySelector<HTMLElement>('[role="progressbar"]')!
  const remplissage = barre.querySelector<HTMLElement>('span')!
  const libelle = fond.querySelector<HTMLElement>('[aria-live]')!
  document.body.appendChild(fond)
  fond.querySelector<HTMLElement>('[tabindex]')!.focus()
  return {
    maj({ fait, total, libelle: texte }) {
      const pct = total ? Math.round((100 * fait) / total) : 0
      barre.setAttribute('aria-valuenow', String(pct))
      barre.setAttribute('aria-valuetext', `${pct} % · ${texte}`)
      remplissage.style.width = `${pct}%`
      libelle.textContent = `${texte} (${fait} sur ${total})`
    },
    fermer: () => fond.remove(),
  }
}
