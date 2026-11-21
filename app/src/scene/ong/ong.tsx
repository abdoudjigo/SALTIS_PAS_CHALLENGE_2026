// Briques partagées des étapes de l'ONG : intrant choisi, prix et budget, sacs, date limite de livraison.
// Une règle = une fonction (invariant I2) : les étapes 4, 5 et l'export lisent les mêmes.
import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { optionsCarteSemis, optionsRisqueSemis } from '../../hooks/previsions'
import { nombre } from '../../lib/format'
import type { Intrant, PrixIntrant, Referentiels } from '../../types/marts'
import { anneeCouverte, type RisqueSemis } from '../../types/previsions'
import { lireNombre } from '../../lib/saisie'
import type { Cadre } from '../cadre'
import type { DossierOng } from './dossier'
import { sacs } from '../regles/conseil'
import { puceChoix, type Puce } from '../interface/fiche'
import { debutDecade } from '../regles/fiabilite'

/** Les intrants chiffrés : le fumier (non chiffré) n'entre jamais dans les totaux, le budget ni la répartition. */
export const intrantsChiffres = (ref: Referentiels) => ref.intrants.filter((i) => i.dans_totaux !== false && i.colonne_besoin !== 'besoin_fumier_t')

/** L'intrant des étapes 4 et 5 (sélection partagée du dossier) ; par défaut, les semences. */
export function intrantOng(ref: Referentiels, dossier: DossierOng): Intrant | undefined {
  const liste = intrantsChiffres(ref)
  return liste.find((i) => i.code_intrant === dossier.intrant) ?? liste.find((i) => i.colonne_besoin === 'besoin_semences_retenu_t') ?? liste[0]
}

export function puceIntrant(ref: Referentiels, intrant: Intrant | undefined, majDossier: (modif: Partial<DossierOng>) => void): Puce {
  return puceChoix('intrant', 'Intrant', intrantsChiffres(ref).map((i) => ({ id: i.code_intrant, libelle: i.nom_intrant })), intrant?.code_intrant ?? '', (id) => majDossier({ intrant: id }))
}

/** Le nom de l'intrant dans une phrase : « semences », « NPK 15-15-15 ». */
export const nomIntrant = (i: Intrant | undefined) => (!i ? 'intrant' : /^[A-Z]{2}/.test(i.nom_intrant) ? i.nom_intrant : i.nom_intrant.toLowerCase())
/** « de semences », « d’urée 46-0-0 », « de NPK 15-15-15 ». */
export const deIntrant = (i: Intrant | undefined) => {
  const n = nomIntrant(i)
  return /^[aeiouyéèêàâîôûh]/i.test(n) && !/^[A-Z]{2}/.test(n) ? `d’${n}` : `de ${n}`
}

/** Sacs de 50 kg pour un besoin en tonnes (règle de conseil.ts : au demi-sac supérieur). */
export const sacsDeTonnes = (t: number) => sacs(t * 1000)
export const tonnesDeSacs = (n: number) => (n * 50) / 1000

export const fcfa = (v: number | null | undefined) => (v === null || v === undefined ? 'non disponible' : `${nombre(v)} FCFA`)

export interface PrixRetenu {
  /** prix de cession subventionné et coût réel (FCFA / sac de 50 kg) ; null : à saisir */
  cession: number | null
  reel: number | null
  /** prix d'achat saisi par l'organisation pour la session (FCFA / sac) */
  saisi: number | null
  /** campagne du prix lu ; null : aucun prix pour cet intrant */
  campagne: number | null
  source: string | null
  statut: PrixIntrant['statut_validation'] | null
}

/**
 * Le prix d'un intrant pour une campagne : celui de la campagne s'il existe, sinon celui de la dernière campagne
 * connue (sa campagne est alors affichée). Jamais 0 : un prix absent reste null, « à saisir ».
 */
export function prixRetenu(prix: PrixIntrant[] | null | undefined, code: string | undefined, annee: number, saisis: Record<string, string>): PrixRetenu {
  const tape = code ? lireNombre(saisis[code]) : null
  const lignes = (prix ?? []).filter((p) => p.code_intrant === code).sort((a, b) => b.campagne - a.campagne)
  const p = lignes.find((l) => l.campagne === annee) ?? lignes[0]
  return {
    cession: p?.prix_cession_sac_50kg_fcfa ?? null, reel: p?.cout_reel_sac_50kg_fcfa ?? null, saisi: tape !== null && tape > 0 ? tape : null,
    campagne: p?.campagne ?? null, source: p?.source ?? null, statut: p?.statut_validation ?? null,
  }
}

/** Budget = sacs × prix du sac ; null si le prix manque. */
export const budget = (nbSacs: number | null, prixSac: number | null) => (nbSacs === null || prixSac === null ? null : nbSacs * prixSac)

// --- Date limite de livraison (modèle 4) ------------------------------------------------------------
/** Appels au modèle 4 pour les dates limites, au plus, appel témoin compris (décision du chef de projet). */
export const APPELS_SEMIS_MAX = 6

export interface DateLimite {
  culture: string
  decade: number
  /** « 21 juillet 2026 » : premier jour de la décade de semis conseillée */
  date: string
}

/**
 * La date limite de livraison par département : le premier jour de la décade de semis conseillée par le modèle 4
 * (/previsions/semis/carte) pour la culture du département. Année que le modèle 4 ne couvre pas (`anneeCouverte`) :
 * aucun appel. Six appels au plus en tout : un appel témoin (les cultures couvertes, lues sur un département, pour ne
 * jamais demander une culture absente du modèle, qui répondrait 404) et cinq cultures, les plus fréquentes.
 * Aucun délai logistique n'est ajouté.
 */
export function useDatesLimites(cadre: Cadre, annee: number, cultureParDepartement: Map<string, string>) {
  const couverte = anneeCouverte(cadre.ref.campagnes, 'M4', annee)
  const temoin = cadre.ref.departements[0]?.code_departement ?? null
  const liste = useQuery(optionsRisqueSemis(couverte ? temoin : null, annee))
  const listeLue = !liste.isPlaceholderData && (liste.data !== undefined || Boolean(liste.error))
  const couvertes = useMemo(() => new Set(liste.isPlaceholderData ? [] : liste.data?.donnees.map((l) => l.culture)), [liste.data, liste.isPlaceholderData])
  const demandees = useMemo(() => {
    const compte = new Map<string, number>()
    cultureParDepartement.forEach((c) => couvertes.has(c) && compte.set(c, (compte.get(c) ?? 0) + 1))
    return [...compte.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, APPELS_SEMIS_MAX - 1).map(([c]) => c)
  }, [cultureParDepartement, couvertes])
  const requetes = useQueries({ queries: demandees.map((c) => optionsCarteSemis(couverte ? c : null, annee)) })
  const pret = !couverte || (listeLue && requetes.every((r) => (r.data !== undefined && !r.isPlaceholderData) || Boolean(r.error)))
  const cleDonnees = requetes.map((r, i) => `${demandees[i]}:${r.dataUpdatedAt}:${r.isPlaceholderData}`).join('|')
  const donnees = requetes.map((r) => (r.isPlaceholderData ? undefined : r.data))
  const dates = useMemo(() => {
    const r = new Map<string, DateLimite>()
    if (!couverte) return r
    const parCulture = new Map<string, Map<string, RisqueSemis>>()
    donnees.forEach((d, i) => {
      const m = new Map<string, RisqueSemis>()
      ;(d?.donnees ?? []).filter((l) => l.decade_conseillee).forEach((l) => {
        const x = m.get(l.code_departement)
        if (!x || l.decade_semis < x.decade_semis) m.set(l.code_departement, l)
      })
      parCulture.set(demandees[i], m)
    })
    cultureParDepartement.forEach((culture, code) => {
      const l = parCulture.get(culture)?.get(code)
      if (l) r.set(code, { culture, decade: l.decade_semis, date: `${debutDecade(l.decade_semis)} ${annee}` })
    })
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `donnees` est résumé par `cleDonnees` (un tableau neuf à chaque rendu)
  }, [cleDonnees, demandees, cultureParDepartement, couverte, annee])
  /** Le texte de la date limite d'un département. */
  const texte = (code: string) => {
    const d = dates.get(code)
    if (d) return d.date
    if (!couverte) return 'non disponible'
    if (!pret) return 'chargement'
    const c = cultureParDepartement.get(code)
    // Culture couverte par le modèle 4 mais au-delà des cultures interrogées
    if (c && couvertes.has(c) && !demandees.includes(c)) return `hors des ${demandees.length} cultures interrogées`
    return 'non disponible'
  }
  return { couverte, pret, dates, texte }
}
