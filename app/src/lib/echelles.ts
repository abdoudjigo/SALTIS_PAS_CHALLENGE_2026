// Échelles de couleurs des indicateurs cartographiés. NULL → gris (inconnu), jamais la couleur de 0.
export const COULEUR_INCONNU = '#c9c4b8'

export type ValeurCarte = number | string | null | undefined

export interface Echelle {
  type: 'continue' | 'categorie'
  couleur: (v: ValeurCarte) => string
  legende: { couleur: string; texte: string }[]
}

export interface IndicateurCarte {
  libelle: string
  unite?: string
  echelle: Echelle
}

function interpoler(stops: [number, string][], v: number): string {
  if (v <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    const [v0, c0] = stops[i - 1]
    const [v1, c1] = stops[i]
    if (v <= v1) {
      const t = (v - v0) / (v1 - v0)
      const a = c0.match(/\w\w/g)!.map((h) => parseInt(h, 16))
      const b = c1.match(/\w\w/g)!.map((h) => parseInt(h, 16))
      return '#' + a.map((x, k) => Math.round(x + (b[k] - x) * t).toString(16).padStart(2, '0')).join('')
    }
  }
  return stops[stops.length - 1][1]
}

function continue_(paliers: [number, string][], unite: string, decimales = 0): Echelle {
  const stops = paliers.map(([v, c]): [number, string] => [v, '#' + c.replace('#', '')])
  return {
    type: 'continue',
    couleur: (v) => (typeof v !== 'number' ? COULEUR_INCONNU : interpoler(stops, v)),
    legende: stops.map(([v, c]) => ({ couleur: c, texte: `${v > 0 && unite === '%' ? '+' : ''}${v.toFixed(decimales)}${unite ? ' ' + unite : ''}` })),
  }
}

function categorie(valeurs: Record<string, string>): Echelle {
  return {
    type: 'categorie',
    couleur: (v) => (typeof v === 'string' && valeurs[v]) || COULEUR_INCONNU,
    legende: Object.entries(valeurs).map(([texte, couleur]) => ({ texte, couleur })),
  }
}

export const INDICATEURS_CARTE = {
  anomalie_pluie_saison_pct: {
    libelle: 'Écart à la normale',
    unite: '%',
    echelle: continue_([[-50, '8a5527'], [-25, 'd9a86c'], [0, 'f4f1e8'], [25, '7fb3dd'], [50, '1b5a8e']], '%'),
  },
  pluie_saison_mm: {
    libelle: 'Pluie de la saison',
    unite: 'mm',
    echelle: continue_([[150, 'f3eddc'], [400, 'b9d6ec'], [700, '5d9bd0'], [1000, '2d7fc1'], [1400, '12395c']], 'mm'),
  },
  risque_saison: {
    libelle: 'Risque de la saison',
    echelle: categorie({ normal: '#5fa77a', sécheresse: '#d2492f', 'excès de pluie': '#2d7fc1', 'sécheresse et excès de pluie': '#f2b544' }),
  },
  score_vulnerabilite: {
    libelle: 'Vulnérabilité (relative)',
    unite: '/100',
    echelle: continue_([[0, 'fbf3d5'], [25, 'f6cf7a'], [50, 'ec9a4a'], [75, 'd2492f'], [100, '7d1d10']], ''),
  },
} satisfies Record<string, IndicateurCarte>

export type ChampCarte = keyof typeof INDICATEURS_CARTE
