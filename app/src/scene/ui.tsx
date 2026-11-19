// Briques des fenêtres de résultats. Trois niveaux de lecture, toujours dans cet ordre :
// la réponse (une phrase, un à trois chiffres), le détail (groupes de lignes), la méthode (repliée).
// Pas de cartes dans les cartes : des filets fins, l'espace et la typographie font la structure.
import clsx from 'clsx'
import { Check, ChevronDown, Info } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { VIDE } from '../lib/format'

// --- Niveau 1 : la réponse -----------------------------------------------------------------------
/** `cle` change avec le département ou la campagne : la réponse se met à jour par un court fondu. */
/** `vivant` : la réponse est annoncée par les lecteurs d'écran quand elle change (fenêtres de l'agriculteur). */
export function Reponse({ cle, titre, phrase, children, vivant = false }: { cle?: string | number | null; titre: string; phrase?: ReactNode; children?: ReactNode; vivant?: boolean }) {
  const contenu = (
    <header key={cle ?? titre} className="maj">
      <h2 className="font-titre text-titre-fiche font-semibold text-white">{titre}</h2>
      {phrase && <p className="mt-1.5 text-sm leading-relaxed text-white/70">{phrase}</p>}
      {children && <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3">{children}</div>}
    </header>
  )
  return vivant ? <div aria-live="polite">{contenu}</div> : contenu
}

/** Les chiffres clés posés sous le « que faire » : le pourquoi de la réponse. */
export const Cles = ({ children }: { children: ReactNode }) => <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-3">{children}</div>

export interface Action {
  texte: ReactNode
  /** ouvre une autre fonctionnalité pour aller plus loin */
  vers?: { mode: string; libelle: string }
}

/**
 * « Que faire » : 1 à 3 actions courtes, chacune commence par un verbe, placées juste sous la réponse.
 * `note` : une réserve d'une ligne (conseil indicatif). Pas de carte dans la carte : un filet, comme les groupes.
 */
export function AFaire({ actions, aller, note }: { actions: Action[]; aller: (mode: string) => void; note?: string }) {
  if (!actions.length) return null
  return (
    <section className="mt-4 border-t border-white/[0.09] pt-3.5" aria-label="Que faire">
      <h3 className={ETIQUETTE}>Que faire</h3>
      <ol className="mt-2 space-y-1">
        {actions.map((a, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-white">
            <span className="mt-px w-4 shrink-0 text-xs font-semibold text-soleil-500 tabular-nums" aria-hidden>{i + 1}.</span>
            <span className="min-w-0 flex-1">
              {a.texte}
              {a.vers && <> <Lien onClick={() => aller(a.vers!.mode)} compact>{a.vers.libelle}</Lien></>}
            </span>
          </li>
        ))}
      </ol>
      {note && <p className="mt-1.5 text-2xs leading-snug text-white/60">{note}</p>}
    </section>
  )
}

/**
 * D'où vient la réponse et ce qu'elle vaut, en une ligne : « Prévision océan (fin mai 2026) · fiabilité modeste ».
 * `marques` : statuts posés devant (dose à confirmer…). Ne remplace pas la méthode, repliée plus bas.
 */
export function LigneFiabilite({ parties, marques = [] }: { parties: (string | null | undefined | false)[]; marques?: string[] }) {
  const texte = parties.filter(Boolean).join(' · ')
  return (
    <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs leading-snug text-white/60">
      {marques.map((m) => <Marque key={m}>{m}</Marque>)}
      <span>{texte}</span>
    </p>
  )
}

/** Chiffre clé : la valeur en grand, l'unité en petit, le libellé dessous. */
export function Cle({ valeur, unite, libelle, teinte, large = false }: { valeur: ReactNode; unite?: string; libelle: string; teinte?: string; large?: boolean }) {
  return (
    <div className={clsx(large && 'col-span-2')}>
      <p className="text-2xl leading-none font-semibold text-white tabular-nums" style={teinte ? { color: teinte } : undefined}>
        {valeur}{unite && <span className="ml-1 text-xs font-normal text-white/60">{unite}</span>}
      </p>
      <p className="mt-1.5 text-2xs leading-snug text-white/60">{libelle}</p>
    </div>
  )
}

// --- Niveau 2 : le détail ------------------------------------------------------------------------
const ETIQUETTE = 'text-2xs font-medium tracking-etiquette text-white/60 uppercase'

/** Groupe de mesures, séparé par un filet. `replie` : fermé au départ (listes longues). */
export function Groupe({ titre, children, replie, complement, id }: { titre: string; children: ReactNode; replie?: boolean; complement?: string; id?: string }) {
  const [ouvert, setOuvert] = useState(!replie)
  const repliable = replie !== undefined
  return (
    <section className="mt-5 border-t border-white/[0.09] pt-3.5">
      {repliable ? (
        <h3 id={id}>
          <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className={clsx(ETIQUETTE, '-my-2 flex min-h-11 w-full items-center justify-between gap-3 text-left transition hover:text-white')}>
            <span>{titre}{complement && <span className="ml-2 tracking-normal text-white/60 normal-case">{complement}</span>}</span>
            <ChevronDown className={clsx('size-4 shrink-0 transition-transform duration-300', ouvert && 'rotate-180')} aria-hidden />
          </button>
        </h3>
      ) : (
        <h3 id={id} className={ETIQUETTE}>{titre}{complement && <span className="ml-2 tracking-normal text-white/60 normal-case">{complement}</span>}</h3>
      )}
      {ouvert && <div className="mt-3">{children}</div>}
    </section>
  )
}

/** Une mesure sur une ligne : libellé à gauche, valeur alignée à droite. */
export function Ligne({ libelle, valeur, detail, teinte }: { libelle: string; valeur: ReactNode; detail?: string; teinte?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-white/60">{libelle}</dt>
      <dd className="text-right">
        {/* Une valeur absente se dit « non disponible », jamais 0 ni un tiret seul */}
        <span className="text-sm font-medium text-white tabular-nums" style={teinte ? { color: teinte } : undefined}>{valeur === VIDE ? 'non disponible' : valeur}</span>
        {detail && <span className="block text-2xs text-white/60">{detail}</span>}
      </dd>
    </div>
  )
}
export const Lignes = ({ children }: { children: ReactNode }) => <dl className="-my-1.5">{children}</dl>

export function Barre({ part, couleur }: { part: number | null; couleur: string }) {
  return (
    <span className="block h-1 overflow-hidden rounded-full bg-white/10">
      {part !== null && <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(part, 100))}%`, background: couleur }} />}
    </span>
  )
}

/** Ligne de classement : rang, nom, barre, valeur. Cliquable quand elle choisit un département. */
export function Rang({ rang, nom, part, couleur, valeur, actif, onClick }: { rang?: number; nom: string; part: number | null; couleur: string; valeur: string; actif?: boolean; onClick?: () => void }) {
  const contenu = (
    <>
      {rang !== undefined && <span className="w-5 text-2xs text-white/60 tabular-nums">{rang}</span>}
      <span className="min-w-0 flex-1 truncate text-sm text-white">{nom}</span>
      <span className="w-16 shrink-0"><Barre part={part} couleur={couleur} /></span>
      <span className="w-14 shrink-0 text-right text-sm font-medium text-white tabular-nums">{valeur}</span>
    </>
  )
  const classes = clsx('flex min-h-11 w-full items-center gap-2.5 text-left', actif && 'rounded-md bg-white/[0.09] shadow-[inset_2px_0_0_var(--color-soleil-500)]')
  return onClick
    ? <li><button type="button" onClick={onClick} aria-current={actif ? 'true' : undefined} className={clsx(classes, '-mx-2 w-[calc(100%+1rem)] rounded-md px-2 transition hover:bg-white/[0.06]')}>{contenu}</button></li>
    : <li className={classes}>{contenu}</li>
}

/**
 * Plusieurs parts côte à côte (les 3 probabilités d'une saison) : libellé, barre, valeur. La plus forte est mise
 * en avant, les autres restent lisibles : on montre toujours les trois. Une part absente reste vide.
 */
export function Parts({ parts }: { parts: { libelle: string; part: number | null; couleur: string }[] }) {
  const max = Math.max(...parts.map((p) => p.part ?? -1))
  return (
    <dl className="space-y-2.5">
      {parts.map((p) => {
        const fort = p.part !== null && p.part === max
        return (
          <div key={p.libelle} className="grid grid-cols-[4.25rem_1fr_3.5rem] items-center gap-2.5">
            <dt className={clsx('text-sm', fort ? 'font-semibold text-white' : 'text-white/60')}>{p.libelle}</dt>
            <span className={clsx('block overflow-hidden rounded-full bg-white/10', fort ? 'h-2.5' : 'h-1.5')}>
              {p.part !== null && <span className={clsx('block h-full rounded-full transition-[width] duration-700', !fort && 'opacity-60')} style={{ width: `${Math.max(0, Math.min(p.part, 100))}%`, background: p.couleur }} />}
            </span>
            <dd className={clsx('text-right tabular-nums', fort ? 'text-md font-semibold text-white' : 'text-sm text-white/70')}>{p.part === null ? '—' : `${Math.round(p.part)} %`}</dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Le détail d'une réponse : replié au départ, derrière un vrai bouton. On voit qu'il y a plus, sans l'avoir sous les yeux. */
export function Detail({ children, libelle = 'Voir le détail' }: { children: ReactNode; libelle?: string }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="mt-5">
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-white/20 bg-white/[0.04] px-3.5 text-sm font-medium text-white transition hover:border-white/45 hover:bg-white/[0.08]">
        {ouvert ? 'Masquer le détail' : libelle}
        <ChevronDown className={clsx('size-4 shrink-0 transition-transform duration-300', ouvert && 'rotate-180')} aria-hidden />
      </button>
      {ouvert && <div className="maj">{children}</div>}
    </div>
  )
}

/**
 * Fourchette sur un axe : la bande va du bas au haut, le point est la valeur centrale, le trait le repère
 * (normale, rendement habituel). Sans fourchette complète, rien n'est dessiné : « non disponible ».
 */
export function Fourchette({ bas, haut, valeur, repere, couleur, description }: { bas: number | null; haut: number | null; valeur?: number | null; repere?: number | null; couleur: string; description: string }) {
  if (bas === null || haut === null) return <p className="text-xs text-white/60">Fourchette non disponible</p>
  const bornes = [bas, haut, repere ?? bas]
  const [min, max] = [Math.min(...bornes) * 0.82, Math.max(...bornes) * 1.12]
  const x = (v: number) => `${((v - min) / (max - min || 1)) * 100}%`
  return (
    <div className="relative h-4" role="img" aria-label={description}>
      <span className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
      <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-55" style={{ left: x(bas), width: `calc(${x(haut)} - ${x(bas)})`, background: couleur }} />
      {repere !== null && repere !== undefined && <span className="absolute top-0 h-full w-px bg-white/80" style={{ left: x(repere) }} />}
      {valeur !== null && valeur !== undefined && <span className="absolute top-1/2 size-2 -translate-1/2 rounded-full ring-2 ring-encre-nuit" style={{ left: x(valeur), background: couleur }} />}
    </div>
  )
}

/** Étiquette d'état d'une prévision. `ferme` : prévision de l'année ; `neutre` : valeur habituelle ou réserve. */
export function Marque({ ton = 'neutre', children }: { ton?: 'ferme' | 'neutre'; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded-full border px-2 py-0.5 text-2xs leading-4 whitespace-nowrap', ton === 'ferme' ? 'border-soleil-500/60 text-soleil-500' : 'border-white/20 text-white/65')}>{children}</span>
}

// --- Niveau 3 : la méthode -----------------------------------------------------------------------
/** Notes de méthode et limites : repliées par défaut, jamais supprimées. */
export function Methode({ children }: { children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <section className="mt-5 border-t border-white/[0.09]">
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="flex min-h-11 w-full items-center gap-2 text-left text-xs text-white/60 transition hover:text-white">
        <Info className="size-3.5 shrink-0" aria-hidden />
        <span className="flex-1">Méthode et limites</span>
        <ChevronDown className={clsx('size-4 shrink-0 transition-transform duration-300', ouvert && 'rotate-180')} aria-hidden />
      </button>
      {ouvert && <div className="maj space-y-2 pb-2 text-xs leading-relaxed text-white/60">{children}</div>}
    </section>
  )
}

// --- Commandes -----------------------------------------------------------------------------------
export function Champ({ libelle, children, className }: { libelle: string; children: ReactNode; className?: string }) {
  return <label className={clsx('block text-2xs text-white/60', className)}>{libelle}<span className="mt-1 block">{children}</span></label>
}

/** Choix exclusif entre quelques options courtes (moment de la saison, critère de classement). */
export function Segments<T extends string>({ libelle, options, valeur, onChange }: { libelle: string; options: { id: T; libelle: string }[]; valeur: T; onChange: (id: T) => void }) {
  return (
    <div role="radiogroup" aria-label={libelle} className="flex rounded-lg border border-white/12 p-0.5">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === valeur} onClick={() => onChange(o.id)}
          className={clsx('min-h-11 flex-1 rounded-md px-1 text-xs font-medium transition', o.id === valeur ? 'bg-soleil-500 text-encre-nuit' : 'text-white/70 hover:bg-white/[0.07] hover:text-white')}>
          {o.libelle}
        </button>
      ))}
    </div>
  )
}

/**
 * Saisie de l'année, partout la même. Une année à venir se tape (de `min` à `max`) : la plateforme prédit.
 * Une année passée se choisit dans la liste : elle sert de vérification. `nature` dit en une ligne ce qu'on regarde.
 */
export function SaisieAnnee({ annee, onChange, passees, min, max, nature, className }: { annee: number; onChange: (annee: number) => void; passees: number[]; min: number; max: number; nature: string; className?: string }) {
  const [texte, setTexte] = useState(annee >= min ? String(annee) : '')
  // Le message sous le champ (nature de l'année ou erreur) décrit toujours le champ
  const idNature = useId()
  // L'année a changé ailleurs (liste des années passées) : le champ suit
  const [suivie, setSuivie] = useState(annee)
  if (suivie !== annee) {
    setSuivie(annee)
    setTexte(annee >= min ? String(annee) : '')
  }
  const saisie = Number(texte)
  const horsPlage = texte.trim() !== '' && texte.trim().length >= 4 && (!Number.isInteger(saisie) || saisie < min || saisie > max)
  const taper = (valeur: string) => {
    setTexte(valeur)
    const n = Number(valeur)
    if (Number.isInteger(n) && n >= min && n <= max) onChange(n)
  }
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2">
        <Champ libelle={`Année à prévoir (${min}-${max})`}>
          <input className="champ-scene tabular-nums" type="number" inputMode="numeric" min={min} max={max} step={1} placeholder={String(min)} value={texte} aria-invalid={horsPlage} aria-describedby={idNature}
            onChange={(e) => taper(e.target.value)} />
        </Champ>
        <Champ libelle="Ou une année passée">
          <select className="champ-scene" value={annee < min ? annee : ''} onChange={(e) => e.target.value && onChange(Number(e.target.value))}>
            <option value="">Choisir…</option>
            {[...passees].sort((a, b) => b - a).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Champ>
      </div>
      {horsPlage
        ? <p id={idNature} role="alert" className="mt-2 text-xs leading-relaxed text-soleil-500">Les prévisions vont de {min} à {max}. Tapez une année dans cette plage.</p>
        : <p id={idNature} className="mt-2 text-xs leading-relaxed text-white/65">{nature}</p>}
    </div>
  )
}

/** Lien d'action dans le texte : ouvre une autre fonctionnalité. */
export function Lien({ children, onClick, compact = false }: { children: ReactNode; onClick: () => void; compact?: boolean }) {
  // `compact` : dans une phrase, la ligne garde sa hauteur ; la cible tactile reste de 44 px par une marge négative
  return <button type="button" onClick={onClick} className={clsx('inline-flex items-center text-sm font-medium text-soleil-500 underline-offset-4 hover:underline', compact ? '-my-3 min-h-11 align-baseline whitespace-nowrap' : 'min-h-11')}>{children}</button>
}

export function Bouton({ children, onClick, plein = false, disabled, className, decritPar }: { children: ReactNode; onClick?: () => void; plein?: boolean; disabled?: boolean; className?: string; decritPar?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-describedby={decritPar}
      className={clsx('inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50',
        plein ? 'bg-soleil-500 text-encre-nuit hover:bg-soleil-100' : 'border border-white/15 text-white hover:border-white/40 hover:bg-white/5', className)}>
      {children}
    </button>
  )
}

export function Pastille({ couleur, children }: { couleur: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-white/75">
      <span className="size-1.5 rounded-full" style={{ background: couleur }} aria-hidden />
      {children}
    </span>
  )
}

/** Message d'état (hors Sénégal, localisation refusée, rien à répartir). */
export const Avis = ({ children }: { children: ReactNode }) => <p role="alert" className="mt-3 border-l-2 border-soleil-500 pl-3 text-sm leading-relaxed text-white/80">{children}</p>

/** Chargement : des lignes fantômes à la place du contenu. */
export function Squelette({ lignes = 3 }: { lignes?: number }) {
  return (
    <div className="mt-4 animate-pulse space-y-3" role="status" aria-label="Chargement des données">
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="flex justify-between gap-6"><span className="h-3 rounded bg-white/10" style={{ width: `${38 + ((i * 17) % 30)}%` }} /><span className="h-3 w-14 rounded bg-white/10" /></div>
      ))}
    </div>
  )
}

// --- Légendes de la carte ------------------------------------------------------------------------
export function Degrade({ titre, gauche, droite, degrade, note }: { titre: string; gauche: string; droite: string; degrade: string; note?: string }) {
  return (
    <div className="w-52">
      <p className={ETIQUETTE}>{titre}</p>
      <div className="mt-2 h-1.5 rounded-full" style={{ background: degrade }} />
      <div className="mt-1.5 flex justify-between text-2xs text-white/60 tabular-nums"><span>{gauche}</span><span>{droite}</span></div>
      {note && <p className="mt-1.5 text-2xs leading-snug text-white/60">{note}</p>}
    </div>
  )
}

export function Categories({ titre, entrees }: { titre: string; entrees: { couleur: string; libelle: string }[] }) {
  return (
    <div>
      <p className={ETIQUETTE}>{titre}</p>
      <ul className="mt-2 space-y-1">
        {entrees.map((e) => (
          <li key={e.libelle} className="flex items-center gap-2 text-xs text-white/75">
            <span className="size-2 rounded-[2px]" style={{ background: e.couleur }} aria-hidden />{e.libelle}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Une liste d'options à cocher (une seule à la fois), dans le menu d'une puce. */
export function Options<T extends string | null>({ nom, options, valeur, choisir, fermer }: { nom: string; options: { id: T; libelle: string }[]; valeur: T; choisir: (id: T) => void; fermer: () => void }) {
  return (
    <div role="radiogroup" aria-label={nom} className="-m-1 max-h-64 overflow-y-auto overscroll-contain">
      {options.map((o) => (
        <button key={o.id ?? ''} type="button" role="radio" aria-checked={o.id === valeur} onClick={() => { choisir(o.id); fermer() }}
          className={clsx('flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition hover:bg-white/[0.07]', o.id === valeur ? 'font-semibold text-soleil-500' : 'text-white')}>
          <span className="flex-1">{o.libelle}</span>
          {o.id === valeur && <Check className="size-4 shrink-0" aria-hidden />}
        </button>
      ))}
    </div>
  )
}

