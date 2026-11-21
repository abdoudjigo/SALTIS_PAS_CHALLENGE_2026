// Garde-fou de la carte : sans WebGL, ou si Mapbox lève une erreur, la scène ne devient pas une page blanche.
// À la place de la carte, un fond sobre et un message ; le menu, la fenêtre et le tiroir restent utilisables
// (les départements se choisissent alors depuis les fenêtres, ou par « Me localiser »).
import { Component, type ReactNode } from 'react'
import { webglDisponible } from '../../lib/modeRendu'
import { LARGEUR_FENETRE_PX } from '../interface/Fenetre'

function SansCarte({ large }: { large: boolean }) {
  return (
    <div className="absolute inset-0 bg-encre-nuit">
      <p role="status" className={large ? 'absolute top-1/2 left-24 mx-auto max-w-sm -translate-y-1/2 text-sm leading-relaxed text-white/70' : 'absolute inset-x-6 top-40 text-center text-sm leading-relaxed text-white/70'}
        style={large ? { right: LARGEUR_FENETRE_PX + 48 } : undefined}>
        La carte 3D ne peut pas s’afficher sur cet appareil. Les conseils restent disponibles {large ? 'à droite' : 'ci-dessous'}.
      </p>
    </div>
  )
}

export class GardeCarte extends Component<{ large: boolean; children: ReactNode; onEchec?: () => void }, { echec: boolean }> {
  // Testé une fois, avant de monter la carte : Mapbox lève sinon « Failed to initialize WebGL »
  state = { echec: !webglDisponible() }

  static getDerivedStateFromError() {
    return { echec: true }
  }

  componentDidMount() {
    if (this.state.echec) this.props.onEchec?.()
  }

  componentDidCatch(erreur: unknown) {
    console.warn('Carte indisponible :', erreur)
    this.props.onEchec?.()
  }

  render() {
    return this.state.echec ? <SansCarte large={this.props.large} /> : this.props.children
  }
}
