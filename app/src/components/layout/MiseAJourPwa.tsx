import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

// Propose de recharger quand une nouvelle version est déployée (pas de rechargement forcé pendant une saisie)
export function MiseAJourPwa() {
  const {
    needRefresh: [aMettreAJour, setAMettreAJour],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => reg.update(), 60 * 60 * 1000)
    },
  })

  if (!aMettreAJour) return null
  return (
    <div className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-encre p-3 pl-4 text-sm text-white shadow-xl animate-apparition lg:bottom-6">
      <span className="flex-1">Une nouvelle version est disponible.</span>
      <button onClick={() => updateServiceWorker(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-vert-500 px-3 py-1.5 font-medium hover:bg-vert-700">
        <RefreshCw className="size-4" /> Mettre à jour
      </button>
      <button onClick={() => setAMettreAJour(false)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Plus tard">
        <X className="size-4" />
      </button>
    </div>
  )
}
