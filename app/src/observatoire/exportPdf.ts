// Export PDF de l'Observatoire (A4, 2 pages, côté navigateur). Mise en page et textes : app/src/export/ (réutilisés).
// Les valeurs sont celles de l'état de la page (useEtatObservatoire) : aucun calcul différent, absent = « non disponible ».
// Aucune prévision n'est affichée par l'Observatoire, donc aucune n'est exportée.
import { creerDocument, LARGEUR_UTILE, MARGE, Redacteur, terminer } from '../export/pdf'
import { dateHeureFr, NON_DISPONIBLE, slug } from '../export/texte'
import type { Cellule } from '../export/types'
import { nombre } from '../lib/format'
import type { EtatObservatoire } from './contexte'
import { codeCulture, COULEURS, dateTexte, pctTexte, RAMPE, texteIncomplet, valeurTexte } from './outils'
import { UNITES, type IndicateurZone, type ObjectifObs } from './types'

const TITRE = 'Observatoire Sénégal 2050'
const MAX_JAUGES = 2

export const nomFichierObservatoire = (e: EtatObservatoire) =>
  `Observatoire_${slug(e.selection.culture)}_${slug(e.libelles.zone)}_${e.selection.annee}.pdf`

/** SVG -> PNG (XMLSerializer, Image, canvas) ; styles calculés recopiés car le SVG sérialisé perd les feuilles de style. */
async function svgVersPng(svg: SVGSVGElement, largeurPx = 1100): Promise<string | null> {
  try {
    const cadre = svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0
      ? { w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height }
      : { w: svg.getBoundingClientRect().width, h: svg.getBoundingClientRect().height }
    if (!cadre.w || !cadre.h) return null
    const clone = svg.cloneNode(true) as SVGSVGElement
    const PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linejoin', 'stroke-linecap', 'opacity',
      'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor']
    const originaux = [svg, ...svg.querySelectorAll('*')]
    const copies = [clone, ...clone.querySelectorAll('*')]
    originaux.forEach((o, i) => {
      const c = copies[i]
      if (!(c instanceof SVGElement) || !(o instanceof SVGElement)) return
      const s = getComputedStyle(o)
      c.setAttribute('style', PROPS.map((p) => `${p}:${s.getPropertyValue(p)}`).join(';'))
    })
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(cadre.w))
    clone.setAttribute('height', String(cadre.h))
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${cadre.w} ${cadre.h}`)
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`
    const image = new Image()
    await new Promise<void>((ok, ko) => { image.onload = () => ok(); image.onerror = () => ko(new Error('image')); image.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = largeurPx
    canvas.height = Math.round((largeurPx * cadre.h) / cadre.w)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

const val = (v: number, unite: string | null) => nombre(v, { decimales: 1, unite: unite ?? '' })
const pageObj = (o: ObjectifObs) => `${o.document}, p. ${o.page}`

function valeurCle(i: IndicateurZone | undefined): string {
  if (!i || i.valeur === null) return `${NON_DISPONIBLE}${i?.derniere_annee_disponible ? ` (dernière donnée : ${i.derniere_annee_disponible})` : ''}`
  return valeurTexte(i.valeur, i.indicateur, i.unite)
}

/** Jauge « référence -> cible » dessinée en vectoriel (échelle de la page : 0 à 100 pour un %, sinon 0 à la cible). */
function jauge(r: Redacteur, o: ObjectifObs) {
  const ref = o.valeur_reference!
  const cible = o.cible!
  const max = o.unite === '%' ? 100 : cible
  const pos = (v: number) => Math.max(0, Math.min(1, v / max)) * LARGEUR_UTILE
  r.place(17)
  r.texte(o.libelle, { taille: 9, style: 'bold', apres: 0.5 })
  const { doc } = r
  doc.setFillColor('#E3E8ED')
  doc.rect(MARGE, r.y, LARGEUR_UTILE, 2.6, 'F')
  doc.setFillColor(COULEURS.bleu)
  doc.rect(MARGE, r.y, pos(ref), 2.6, 'F')
  doc.setFillColor(COULEURS.or)
  doc.rect(MARGE + pos(cible) - 0.6, r.y - 0.8, 1.2, 4.2, 'F')
  r.y += 4.6
  r.texte(`Référence : ${val(ref, o.unite)}${o.annee_reference ? ` (${o.annee_reference})` : ' (année non précisée)'} ; cible : ${val(cible, o.unite)}${o.annee_cible ? ` en ${o.annee_cible}` : ' (échéance non précisée)'}`, { taille: 8.5, apres: 0 })
  r.texte(`${pageObj(o)}${o.note ? ` · ${o.note}` : ''}`, { taille: 7.5, gris: true, apres: 1.5 })
}

export async function exporterObservatoire(e: EtatObservatoire, dateExport = new Date()) {
  const { selection, libelles, filtres, donnees, refs } = e
  const doc = await creerDocument()
  const r = new Redacteur(doc, TITRE)
  const culture = filtres.cultures.find((c) => codeCulture(c.culture) === selection.culture)
  const zone = filtres.zones.find((z) => z.code === selection.zone)
  const servie = Boolean(culture && zone && (zone.niveau === 'DEPARTEMENT' || culture.a_totaux))
  const unite = UNITES[selection.indicateur]

  // ---- Page 1
  r.titre(TITRE, 18)
  r.texte('Ce que le Sénégal produit, et où il en est de ses objectifs de souveraineté alimentaire.', { gris: true })
  r.champ('Culture', libelles.culture)
  r.champ('Zone', `${libelles.zone} (${libelles.niveau})`)
  r.champ('Année', String(selection.annee))
  r.champ('Indicateur de la carte', `${libelles.indicateur} (${unite})`)
  r.champ('Généré le', dateHeureFr(dateExport))

  const y0 = r.y
  r.y += 1.5
  r.texte('Couverture des données', { taille: 10.5, style: 'bold', apres: 1 })
  for (const t of filtres.couverture) r.texte(`• ${t}`, { taille: 8.5, retrait: 2, apres: 0.6 })
  r.texte(`Sources : ${filtres.sources.join(' · ')}`, { taille: 7.5, gris: true, apres: 0 })
  r.doc.setDrawColor(COULEURS.gris)
  r.doc.rect(MARGE - 1.5, y0, LARGEUR_UTILE + 3, r.y - y0 + 1, 'S')
  r.y += 4

  r.sousTitre('Chiffres clés')
  const ind = donnees.indicateurs?.donnees
  if (!servie || !ind) {
    r.texte(!servie
      ? `${libelles.culture} : pas de total ${zone?.niveau === 'PAYS' ? 'national' : 'régional'}, les données sont trop partielles${culture?.mention ? ` (${culture.mention})` : ''}. Choisir un département.`
      : 'Pas de donnée pour cette culture dans cette zone.', { taille: 9, gris: true })
  } else {
    const de = (k: string) => ind.indicateurs.find((x) => x.indicateur === k)
    const prod = de('production'), surf = de('surface'), rdt = de('rendement')
    const badge = (i?: IndicateurZone) => (i ? texteIncomplet(i) : null)
    const fao = ind.rendement_faostat
    const lignes: Cellule[][] = [
      ['Production', valeurCle(prod), [prod?.valeur != null ? `${pctTexte(prod.variation_n1_pct)} par rapport à ${ind.annee - 1}` : null, badge(prod)].filter(Boolean).join(' ; ') || null, prod?.source ?? donnees.indicateurs?.meta.source],
      ['Superficie', valeurCle(surf), [surf?.type_superficie ? `superficie ${surf.type_superficie}` : null, badge(surf)].filter(Boolean).join(' ; ') || null, surf?.source ?? donnees.indicateurs?.meta.source],
      ['Rendement', valeurCle(rdt), [rdt?.valeur != null ? `${pctTexte(rdt.ecart_moyenne_10_ans_pct)} par rapport à la moyenne des ${rdt.nb_annees_moyenne ?? 10} années précédentes` : null, badge(rdt)].filter(Boolean).join(' ; ') || null, rdt?.source ?? donnees.indicateurs?.meta.source],
      ind.niveau === 'PAYS'
        ? ['Rendement national FAOSTAT', fao && fao.rendement_kg_ha !== null ? nombre(fao.rendement_kg_ha, { decimales: 0, unite: 'kg/ha' }) : NON_DISPONIBLE, 'série distincte, jamais additionnée aux départements', 'FAOSTAT']
        : [ind.niveau === 'REGION' ? 'Rang parmi les régions' : 'Rang parmi les départements',
          prod && prod.rang !== null && prod.nb_classes !== null ? `${prod.rang} sur ${prod.nb_classes}` : NON_DISPONIBLE,
          `part nationale de la production : ${prod?.part_nationale_pct != null ? nombre(prod.part_nationale_pct, { decimales: 1, unite: '%' }) : NON_DISPONIBLE}`, prod?.source ?? donnees.indicateurs?.meta.source],
    ]
    r.tableau({ colonnes: ['Chiffre', 'Valeur', 'Repère', 'Source'], lignes, largeurs: [2.2, 2.6, 4, 2.6] })
  }

  r.sousTitre("Objectifs de l'État")
  const obj = donnees.objectifs?.donnees
  const chiffres = (obj?.objectifs ?? []).filter((o) => !o.indicateur.startsWith('evaluation_'))
  const jauges = chiffres.filter((o) => o.valeur_reference !== null && o.cible !== null)
  if (chiffres.length === 0) r.texte(obj?.message ?? "Pas d'objectif chiffré dans la SSA 2025-2034", { taille: 9, gris: true })
  else {
    const compte = new Map<string, number>()
    for (const o of jauges) compte.set(`${o.indicateur}|${o.culture}`, (compte.get(`${o.indicateur}|${o.culture}`) ?? 0) + 1)
    for (const o of jauges.slice(0, MAX_JAUGES)) {
      const n = compte.get(`${o.indicateur}|${o.culture}`) ?? 1
      if (n > 1) r.texte(`Les documents se contredisent : les ${n} valeurs sont affichées.`, { taille: 7.5, style: 'bold', apres: 0.3 })
      jauge(r, o)
    }
    if (jauges.length > MAX_JAUGES) r.texte(`${jauges.length - MAX_JAUGES} autre(s) objectif(s) chiffré(s) : voir la page de l'Observatoire.`, { taille: 7.5, gris: true })
    for (const o of chiffres.filter((x) => !jauges.includes(x) && x.cible !== null).slice(0, 3)) {
      r.texte(`${o.libelle} : ${val(o.cible!, o.unite)}${o.annee_cible ? ` en ${o.annee_cible}` : ''} (${pageObj(o)})`, { taille: 8, apres: 0.5 })
    }
  }

  r.sousTitre(`Évolution : ${libelles.indicateur.toLowerCase()}, ${libelles.culture.toLowerCase()}, ${libelles.zone}`)
  const svgCourbe = refs.courbe.current?.querySelector<SVGSVGElement>('svg.recharts-surface') ?? null
  const imgCourbe = servie && svgCourbe ? await svgVersPng(svgCourbe) : null
  r.texte(`Source : ${donnees.serie?.meta.source ?? NON_DISPONIBLE}, données du ${dateTexte(donnees.serie?.meta.genere_le)}. Trait plein : valeurs observées ; années absentes : pas de point, jamais 0.`, { taille: 7.5, gris: true, apres: 0 })
  const restePage1 = Math.max(28, r.reste() - 4)
  r.carte(imgCourbe, 'Courbe non disponible pour cette vue', Math.min(restePage1, 70))

  // ---- Page 2
  r.nouvellePage()
  r.titre(`Carte des départements, ${libelles.culture.toLowerCase()} ${selection.annee}`, 13)
  const imgCarte = refs.carte.current ? await svgVersPng(refs.carte.current) : null
  r.carte(imgCarte, 'Carte non disponible sur cet appareil', 52)
  r.legende({
    titre: `Légende (${libelles.indicateur.toLowerCase()}, ${unite}) : cinq classes au plus, découpées par quantiles des valeurs observées`,
    entrees: [
      { couleur: RAMPE[0], libelle: 'valeurs les plus basses' },
      { couleur: RAMPE[2], libelle: 'valeurs intermédiaires' },
      { couleur: RAMPE[4], libelle: 'valeurs les plus hautes' },
      { couleur: '#EEF1F4', libelle: 'Pas de donnée' },
      { couleur: COULEURS.or, libelle: 'Zone choisie (contour or)' },
    ],
  })

  r.sousTitre(`Classement des 10 premiers, ${libelles.indicateur.toLowerCase()} ${selection.annee}`)
  const classement = (donnees.classement?.donnees ?? []).slice(0, 10)
  r.tableau({
    colonnes: ['Rang', 'Département', 'Région', `Valeur (${unite})`, 'Statut'],
    lignes: classement.map((c): Cellule[] => [c.rang, c.departement, c.region, valeurTexte(c.valeur, selection.indicateur, unite), c.est_complet === false ? 'incomplet' : null]),
    largeurs: [0.8, 2.6, 2.4, 2, 1.4],
    source: donnees.classement?.meta.source ?? NON_DISPONIBLE,
  })

  r.sousTitre("Ce qu'il faut retenir")
  if (e.phrases.length === 0) r.texte('Pas assez de données pour cette vue.', { taille: 9, gris: true })
  for (const p of e.phrases) r.texte(`• ${p}`, { taille: 9, retrait: 2, apres: 0.8 })

  r.sousTitre('Sources et limites')
  const petit = { taille: 7.5, retrait: 2, apres: 0.4 } as const
  for (const s of filtres.sources) r.texte(`• ${s}`, petit)
  r.texte('• Contours des départements : GADM 4.1 (gadm.org), simplifiés ; usage non commercial, citation obligatoire.', petit)
  const serie = donnees.serie?.donnees
  const limites = [culture?.mention, serie?.mention_arret, serie?.note_faostat].filter((t): t is string => Boolean(t))
  for (const t of limites) r.texte(`• Limite : ${t}`, petit)
  const regles = donnees.indicateurs?.meta.avertissements ?? donnees.serie?.meta.avertissements ?? []
  for (const a of regles.slice(0, 3)) r.texte(`• ${a}`, petit)
  const points = serie?.points_officiels ?? []
  const notes = (obj?.objectifs ?? []).filter((o) => o.note && /contradi|erreur|coquille|faux/i.test(o.note))
  if (points.length > 0 || notes.length > 0) {
    r.texte('Chiffres officiels : contradictions et erreurs probables', { taille: 8.5, style: 'bold', apres: 0.6 })
    for (const o of points) r.texte(`• ${o.document}, p. ${o.page}${o.annee ? ` (${o.annee})` : ''} : ${nombre(o.valeur, { unite: o.unite ?? '' })}${o.note ? `. ${o.note}` : ''}`, petit)
    for (const o of notes) r.texte(`• ${o.libelle} (${pageObj(o)}) : ${o.note}`, petit)
  }
  r.texte(`Table ${donnees.indicateurs?.meta.source ?? donnees.carte?.meta.source ?? NON_DISPONIBLE}, données du ${dateTexte(donnees.indicateurs?.meta.genere_le ?? donnees.carte?.meta.genere_le)}.`, { taille: 7.5, gris: true, apres: 0 })

  r.finaliser(dateExport)
  const nomFichier = nomFichierObservatoire(e)
  const octets = terminer(doc, nomFichier, true)
  return { nomFichier, octets, nbPages: doc.getNumberOfPages() }
}
