// Mise en page A4 commune aux deux exports : marges constantes, en-tête, pied avec date d'export,
// numéros de page, tableaux paginés, légende dessinée (pas une capture du HTML).
import type { jsPDF } from 'jspdf'
import { cellule, dateHeureFr, estFumier, pdfTexte } from './texte'
import type { ElementChecklist, Legende, Tableau } from './types'

export const A4 = { largeur: 210, hauteur: 297 }
export const MARGE = 15
export const LARGEUR_UTILE = A4.largeur - 2 * MARGE
const HAUT = 22
export const BAS = A4.hauteur - 18
const MM_PAR_PT = 0.3528
const NOIR = '#1F2328'
const GRIS = '#5F6670'
const FILET = '#C8CCD1'
const FOND_ENTETE = '#EEF0F2'

/** jsPDF chargé à la demande : il reste hors du bundle initial. */
export async function creerDocument(): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf')
  return new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
}

const ETATS: Record<ElementChecklist['etat'], string> = { ok: 'Bon', attention: 'Attention', non: 'Alerte', info: 'Info' }

interface OptionsTexte {
  taille?: number
  style?: 'normal' | 'bold' | 'italic' | 'bolditalic'
  gris?: boolean
  retrait?: number
  apres?: number
}

export class Redacteur {
  doc: jsPDF
  titreDocument: string
  y = HAUT

  constructor(doc: jsPDF, titreDocument: string) {
    this.doc = doc
    this.titreDocument = pdfTexte(titreDocument)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(NOIR)
  }

  nouvellePage() {
    this.doc.addPage()
    this.y = HAUT
  }

  /** Change de page si la hauteur demandée ne tient pas. */
  place(hauteur: number) {
    if (this.y + hauteur > BAS) this.nouvellePage()
  }

  reste = () => BAS - this.y

  private police(taille: number, style: OptionsTexte['style'] = 'normal', gris = false) {
    this.doc.setFont('helvetica', style)
    this.doc.setFontSize(taille)
    this.doc.setTextColor(gris ? GRIS : NOIR)
  }

  hauteurLigne = (taille: number) => taille * MM_PAR_PT * 1.25

  /** Paragraphe replié à la largeur utile, paginé ligne à ligne. */
  texte(t: string, { taille = 10, style = 'normal', gris = false, retrait = 0, apres = 1.5 }: OptionsTexte = {}) {
    this.police(taille, style, gris)
    const lignes: string[] = this.doc.splitTextToSize(pdfTexte(t), LARGEUR_UTILE - retrait)
    const h = this.hauteurLigne(taille)
    for (const l of lignes) {
      this.place(h)
      this.doc.text(l, MARGE + retrait, this.y, { baseline: 'top' })
      this.y += h
    }
    this.y += apres
  }

  titre(t: string, taille = 15) {
    this.place(this.hauteurLigne(taille) + 12)
    this.texte(t, { taille, style: 'bold', apres: 2 })
  }

  sousTitre(t: string) {
    this.place(18)
    this.y += 1.5
    this.texte(t, { taille: 11.5, style: 'bold', apres: 1.5 })
  }

  /** « Clé : valeur », puis la source en petit gris. */
  champ(cle: string, valeur: string, source?: string | null) {
    const largeurCle = 42
    this.police(10)
    const lignes: string[] = this.doc.splitTextToSize(pdfTexte(valeur), LARGEUR_UTILE - largeurCle)
    const h = this.hauteurLigne(10)
    this.place(h * lignes.length + (source ? 4 : 0))
    this.police(10, 'bold')
    this.doc.text(pdfTexte(cle), MARGE, this.y, { baseline: 'top' })
    this.police(10)
    lignes.forEach((l, i) => this.doc.text(l, MARGE + largeurCle, this.y + i * h, { baseline: 'top' }))
    this.y += h * lignes.length
    if (source) this.texte(`Source : ${source}`, { taille: 7.5, gris: true, retrait: largeurCle, apres: 0 })
    this.y += 1.2
  }

  /** Image de la carte, ou cadre avec une note si la carte manque. Renvoie la hauteur occupée. */
  carte(image: string | null, note: string, hauteurMax: number, largeur = LARGEUR_UTILE, x = MARGE) {
    let w = largeur
    let h = hauteurMax
    if (image) {
      try {
        const p = this.doc.getImageProperties(image)
        h = Math.min(hauteurMax, (w * p.height) / p.width)
        w = (h * p.width) / p.height
        this.place(h)
        this.doc.addImage(image, 'PNG', x + (largeur - w) / 2, this.y, w, h, undefined, 'FAST')
        this.doc.setDrawColor(FILET)
        this.doc.rect(x + (largeur - w) / 2, this.y, w, h)
        this.y += h + 2
        return h + 2
      } catch {
        // image illisible : on retombe sur la note
      }
    }
    h = Math.min(hauteurMax, 40)
    this.place(h)
    this.doc.setDrawColor(FILET)
    this.doc.rect(x, this.y, largeur, h)
    this.police(10, 'italic', true)
    this.doc.text(pdfTexte(note), x + largeur / 2, this.y + h / 2, { align: 'center', baseline: 'middle' })
    this.y += h + 2
    return h + 2
  }

  /** Légende de la vue, aux couleurs fournies par l'appelant. */
  legende(l: Legende, largeur = LARGEUR_UTILE, x = MARGE) {
    this.place(12)
    this.police(9, 'bold')
    this.doc.text(pdfTexte(l.titre), x, this.y, { baseline: 'top' })
    this.y += this.hauteurLigne(9) + 0.8
    this.police(8.5)
    const h = 5
    let cx = x
    for (const e of l.entrees) {
      const lib = pdfTexte(e.libelle)
      const w = 6 + this.doc.getTextWidth(lib) + 5
      if (cx + w > x + largeur && cx > x) {
        cx = x
        this.y += h
      }
      this.place(h)
      this.doc.setFillColor(e.couleur)
      this.doc.setDrawColor(FILET)
      this.doc.rect(cx, this.y + 0.3, 4, 3.4, 'FD')
      this.doc.setTextColor(NOIR)
      this.doc.text(lib, cx + 5.5, this.y + 0.2, { baseline: 'top' })
      cx += w
    }
    this.y += h
    if (l.note) this.texte(l.note, { taille: 7.5, gris: true, retrait: 0 })
  }

  checklist(elements: ElementChecklist[]) {
    for (const e of elements) {
      this.police(9.5)
      const lignes: string[] = this.doc.splitTextToSize(pdfTexte(e.texte.replace(/\*\*/g, '')), LARGEUR_UTILE - 32)
      const h = this.hauteurLigne(9.5)
      this.place(h * lignes.length + 1)
      this.doc.setDrawColor(GRIS)
      this.doc.setFillColor(NOIR)
      this.doc.rect(MARGE, this.y + 0.5, 3, 3, e.etat === 'ok' ? 'FD' : 'S')
      this.police(8.5, 'bold', e.etat !== 'ok')
      this.doc.text(pdfTexte(ETATS[e.etat]), MARGE + 5, this.y + 0.3, { baseline: 'top' })
      this.police(9.5)
      lignes.forEach((l, i) => this.doc.text(l, MARGE + 32, this.y + i * h, { baseline: 'top' }))
      this.y += h * lignes.length + 1
    }
    this.y += 1
  }

  /**
   * Tableau paginé (en-tête répété). Avec `limite`, ne déborde jamais de cette hauteur : renvoie
   * le nombre de lignes dessinées. Les lignes qui citent le fumier sont écartées (PDF ONG).
   */
  tableau(t: Tableau, limite?: number): { dessinees: number; total: number } {
    const lignes = t.lignes.filter((l) => !l.some(estFumier)).map((l) => l.map(cellule))
    const rel = t.largeurs ?? t.colonnes.map(() => 1)
    const somme = rel.reduce((a, b) => a + b, 0)
    const largeurs = rel.map((r) => (r / somme) * LARGEUR_UTILE)
    const taille = 8.5
    const lh = this.hauteurLigne(taille)
    const bas = limite ?? BAS
    const decouper = (cells: string[], style: 'normal' | 'bold') => {
      this.police(taille, style)
      return cells.map((c, i) => this.doc.splitTextToSize(c, largeurs[i] - 2) as string[])
    }
    const rangee = (cells: string[][], style: 'normal' | 'bold', fond: boolean) => {
      const h = Math.max(...cells.map((c) => c.length)) * lh + 1.8
      if (fond) {
        this.doc.setFillColor(FOND_ENTETE)
        this.doc.rect(MARGE, this.y, LARGEUR_UTILE, h, 'F')
      }
      this.police(taille, style)
      let x = MARGE
      cells.forEach((c, i) => {
        c.forEach((l, j) => this.doc.text(l, x + 1, this.y + 0.9 + j * lh, { baseline: 'top' }))
        x += largeurs[i]
      })
      this.y += h
      this.doc.setDrawColor(FILET)
      this.doc.line(MARGE, this.y, MARGE + LARGEUR_UTILE, this.y)
    }
    const entete = decouper(t.colonnes.map(pdfTexte), 'bold')
    const hEntete = Math.max(...entete.map((c) => c.length)) * lh + 1.8
    if (!limite) this.place(hEntete + lh * 2)
    rangee(entete, 'bold', true)
    let dessinees = 0
    for (const l of lignes) {
      const cells = decouper(l, 'normal')
      const h = Math.max(...cells.map((c) => c.length)) * lh + 1.8
      if (this.y + h > bas) {
        if (limite) break
        this.nouvellePage()
        rangee(entete, 'bold', true)
      }
      rangee(cells, 'normal', false)
      dessinees++
    }
    if (lignes.length === 0) this.texte('Aucune ligne.', { taille: 8.5, gris: true })
    this.y += 1
    if (t.source) this.texte(`Source : ${t.source}`, { taille: 7.5, gris: true, apres: 0.5 })
    if (t.note) this.texte(t.note, { taille: 7.5, gris: true, apres: 0.5 })
    this.y += 2
    return { dessinees, total: lignes.length }
  }

  /** En-tête et pied sur chaque page, numéros « page n / N ». */
  finaliser(dateExport: Date) {
    const n = this.doc.getNumberOfPages()
    const pied = pdfTexte(`Assaman & Suuf · équipe AKAI · exporté le ${dateHeureFr(dateExport)}`)
    for (let i = 1; i <= n; i++) {
      this.doc.setPage(i)
      this.police(8, 'normal', true)
      this.doc.setDrawColor(FILET)
      this.doc.text('Assaman & Suuf', MARGE, 12, { baseline: 'bottom' })
      this.doc.text(this.titreDocument, A4.largeur - MARGE, 12, { baseline: 'bottom', align: 'right' })
      this.doc.line(MARGE, 14, A4.largeur - MARGE, 14)
      this.doc.line(MARGE, A4.hauteur - 14, A4.largeur - MARGE, A4.hauteur - 14)
      this.doc.text(pied, MARGE, A4.hauteur - 10, { baseline: 'middle' })
      this.doc.text(`Page ${i} / ${n}`, A4.largeur - MARGE, A4.hauteur - 10, { baseline: 'middle', align: 'right' })
    }
    return n
  }
}

/** Fin commune : octets, téléchargement éventuel. */
export function terminer(doc: jsPDF, nomFichier: string, telecharger: boolean) {
  const octets = doc.output('arraybuffer')
  if (telecharger) {
    const url = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = nomFichier
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Le navigateur lit le fichier de façon asynchrone : l'adresse reste valable une minute
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  return octets
}
