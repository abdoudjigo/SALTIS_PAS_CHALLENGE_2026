// Garde-fou de la carte : sans WebGL, ou si Mapbox lève une erreur, la scène ne devient pas une page blanche.
// À la place de la carte, un fond sobre, un message et la liste des départements (`choix`) ; le menu, la fenêtre et
// le tiroir restent utilisables (audit, constat FE-02 : sans carte, on doit pouvoir choisir son département).
import { Component, type ReactNode } from 'react'
import { webglDisponible } from '../../lib/modeRendu'
import { LARGEUR_FENETRE_PX } from '../interface/Fenetre'

function SansCarte({ large, choix }: { large: boolean; choix?: ReactNode }) {
  return (
    <div className="absolute inset-0 bg-encre-nuit">
      <div className={large ? 'absolute top-1/2 left-24 mx-auto max-w-sm -translate-y-1/2' : 'absolute inset-x-6 top-36'}
        style={large ? { right: LARGEUR_FENETRE_PX + 48 } : undefined}>
        <p role="status" className={`text-sm leading-relaxed text-white/70 ${large ? '' : 'text-center'}`}>
          La carte 3D ne peut pas s’afficher sur cet appareil. Les conseils restent disponibles {large ? 'à droite' : 'ci-dessous'}.
        </p>
        {choix && <div className="mt-4">{choix}</div>}
      </div>
    </div>
  )
}

export class GardeCarte extends Component<{ large: boolean; children: ReactNode; onEchec?: () => void; choix?: ReactNode }, { echec: boolean }> {
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
    return this.state.echec ? <SansCarte large={this.props.large} choix={this.props.choix} /> : this.props.children
  }
}
