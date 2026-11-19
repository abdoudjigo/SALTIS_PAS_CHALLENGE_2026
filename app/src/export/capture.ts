// Capture de la carte sans preserveDrawingBuffer permanent : on force un rendu et on lit le canvas
// dans le rappel 'render', avant que le navigateur ne vide le tampon de dessin.
import type { CarteCapturable } from './types'

/** Attend que la carte ait fini de charger et d'animer ('idle'). Un repaint garantit l'événement. */
export function attendreRepos(map: CarteCapturable, delaiMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    const minuterie = setTimeout(resolve, delaiMs)
    map.once('idle', () => {
      clearTimeout(minuterie)
      resolve()
    })
    map.triggerRepaint()
  })
}

/** Image PNG (data URL) de la carte telle qu'elle est affichée ; null si la capture échoue. */
export function capturerCarte(map: CarteCapturable, delaiMs = 4000): Promise<string | null> {
  return new Promise((resolve) => {
    let fini = false
    const minuterie = setTimeout(() => {
      if (!fini) {
        fini = true
        resolve(null)
      }
    }, delaiMs)
    map.once('render', () => {
      if (fini) return
      fini = true
      clearTimeout(minuterie)
      try {
        resolve(map.getCanvas().toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    })
    map.triggerRepaint()
  })
}
