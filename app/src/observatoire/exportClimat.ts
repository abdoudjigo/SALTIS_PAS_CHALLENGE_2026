// Rapport PDF du tableau de bord (A4 paysage, côté navigateur) : bandeau aux couleurs du site, 4 chiffres clés en
// cartes, puis les graphiques tels qu'affichés, chacun dans son cadre avec sa source. Données réelles seulement.
import { terminer } from '../export/pdf'
import { dateHeureFr, pdfTexte, slug } from '../export/texte'
import type { EtatTableau } from './Climat45'
import { SITE } from './palette'

const L = 297, H = 210, M = 14

export async function exporterTableau(e: EtatTableau, dateExport = new Date()) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true })
  const t = (s: string) => pdfTexte(s)
  const police = (taille: number, style: 'normal' | 'bold' = 'normal', couleur: string = SITE.encre) => { doc.setFont('helvetica', style); doc.setFontSize(taille); doc.setTextColor(couleur) }

  const bandeau = (grand: boolean) => {
    const h = grand ? 44 : 20
    doc.setFillColor(SITE.vert900); doc.rect(0, 0, L, h, 'F')
    doc.setFillColor(SITE.vert700); doc.rect(0, h, L, 1.6, 'F')
    doc.setFillColor(SITE.terre500); doc.rect(0, h + 1.6, L * 0.42, 1.2, 'F')
    doc.setFillColor(SITE.pluie500); doc.rect(L * 0.42, h + 1.6, L * 0.58, 1.2, 'F')
    police(8, 'bold', '#a9d9b8'); doc.text(t('ASSAMAN & SUUF · TABLEAU DE BORD · DONNÉES RÉELLES 1981-2025'), M, grand ? 13 : 9)
    if (grand) {
      police(24, 'bold', '#ffffff'); doc.text(t(e.titre), M, 26)
      police(13, 'normal', '#e3efe6'); doc.text(t(e.filtres), M, 35)
      police(8.5, 'normal', '#cfe3d5'); doc.text(t(`Rapport généré le ${dateHeureFr(dateExport)}`), L - M, 35, { align: 'right' })
    } else {
      police(11, 'bold', '#ffffff'); doc.text(t(`${e.titre} · ${e.filtres}`), M, 15.5)
    }
    return h + 2.8
  }
  const carteGraphique = (g: EtatTableau['graphiques'][number], x: number, y: number, w: number, h: number) => {
    doc.setFillColor('#ffffff'); doc.setDrawColor(SITE.trait); doc.setLineWidth(0.3); doc.roundedRect(x, y, w, h, 3, 3, 'FD')
    police(12, 'bold'); doc.text(t(g.titre), x + 6, y + 9)
    police(8, 'normal', SITE.douce); doc.text(doc.splitTextToSize(t(g.sousTitre), w - 12).slice(0, 2), x + 6, y + 14.5)
    const haut = y + 22, bas = y + h - 12, place = { w: w - 12, h: bas - haut }
    if (g.image) {
      const p = doc.getImageProperties(g.image)
      const k = Math.min(place.w / p.width, place.h / p.height)
      doc.addImage(g.image, 'PNG', x + 6 + (place.w - p.width * k) / 2, haut + (place.h - p.height * k) / 2, p.width * k, p.height * k, undefined, 'FAST')
    } else {
      doc.setFillColor(SITE.sol); doc.roundedRect(x + 6, haut, place.w, place.h, 2, 2, 'F')
      police(9, 'normal', SITE.douce); doc.text(t('Pas de donnée pour cette sélection'), x + w / 2, haut + place.h / 2, { align: 'center', baseline: 'middle' })
    }
    doc.setDrawColor(SITE.trait); doc.line(x + 6, y + h - 9, x + w - 6, y + h - 9)
    police(6.5, 'normal', SITE.douce); doc.text(doc.splitTextToSize(t(g.source), w - 12).slice(0, 1), x + 6, y + h - 4.5)
  }

  // ---- Page 1 : bandeau, chiffres clés, premier graphique
  doc.setFillColor(SITE.sol); doc.rect(0, 0, L, H, 'F')
  let y = bandeau(true) + 8
  police(9, 'bold', SITE.vert700); doc.text(t('LES CHIFFRES CLÉS'), M, y); y += 4
  const n = e.kpi.length, ecart = 5, w = (L - 2 * M - ecart * (n - 1)) / n, hk = 46
  e.kpi.forEach((k, i) => {
    const x = M + i * (w + ecart)
    doc.setFillColor('#ffffff'); doc.setDrawColor(SITE.trait); doc.setLineWidth(0.3); doc.roundedRect(x, y, w, hk, 3, 3, 'FD')
    doc.setFillColor(k.teinte ?? SITE.vert700); doc.roundedRect(x, y, w, 2.2, 1, 1, 'F'); doc.rect(x, y + 1, w, 1.2, 'F')
    police(9, 'normal', SITE.douce); doc.text(t(k.titre), x + 6, y + 11)
    const vide = k.valeur === 'non disponible'
    police(vide ? 13 : 21, 'bold', vide ? SITE.douce : SITE.encre); doc.text(t(k.valeur), x + 6, y + 23)
    let yy = y + 30
    if (k.tendance !== undefined && k.tendance !== null && Number.isFinite(k.tendance)) {
      const haut = k.tendance >= 0
      const txt = t(`${haut ? '+' : '-'} ${Math.abs(k.tendance).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} %`)
      police(8, 'bold', haut ? SITE.vert700 : SITE.alerte700)
      const lw = doc.getTextWidth(txt) + 5
      doc.setFillColor(haut ? SITE.vert50 : SITE.alerte100); doc.roundedRect(x + 6, yy - 3.6, lw, 5.4, 2.7, 2.7, 'F')
      doc.text(txt, x + 8.5, yy)
      yy += 6
    }
    police(7.5, 'normal', SITE.douce); doc.text(doc.splitTextToSize(t(k.phrase), w - 12).slice(0, 3), x + 6, yy)
  })
  y += hk + 7
  const [g1, g2, g3, g4] = e.graphiques
  const reste = H - y - 14
  carteGraphique(g1, M, y, (L - 2 * M) * 0.62 - 2.5, reste)
  carteGraphique(g2, M + (L - 2 * M) * 0.62 + 2.5, y, (L - 2 * M) * 0.38 - 2.5, reste)

  // ---- Page 2 : rendement et classement
  doc.addPage()
  doc.setFillColor(SITE.sol); doc.rect(0, 0, L, H, 'F')
  y = bandeau(false) + 8
  carteGraphique(g3, M, y, (L - 2 * M) * 0.58 - 2.5, H - y - 14)
  carteGraphique(g4, M + (L - 2 * M) * 0.58 + 2.5, y, (L - 2 * M) * 0.42 - 2.5, H - y - 14)

  // ---- Pied sur chaque page
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    police(7, 'normal', SITE.douce)
    doc.text(t('Assaman & Suuf · AKAI TECH · assaman-suuf.tech · données réelles, aucune prévision'), M, H - 6)
    doc.text(`${i} / ${total}`, L - M, H - 6, { align: 'right' })
  }
  const nomFichier = `Tableau_de_bord_${slug(e.filtres)}.pdf`
  terminer(doc, nomFichier, true)
  return { nomFichier }
}
