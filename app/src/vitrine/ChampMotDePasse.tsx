import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

interface PropsMotDePasse {
  id: string
  valeur: string
  onChange: (valeur: string) => void
  autoComplete: 'current-password' | 'new-password'
  minLength?: number
  decritPar?: string
}

export function ChampMotDePasse({ id, valeur, onChange, autoComplete, minLength, decritPar }: PropsMotDePasse) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input id={id} type={visible ? 'text' : 'password'} required autoComplete={autoComplete} minLength={minLength}
        aria-describedby={decritPar} className="champ-nuit pr-13" value={valeur} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-white/60 transition hover:text-white">
        {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  )
}
