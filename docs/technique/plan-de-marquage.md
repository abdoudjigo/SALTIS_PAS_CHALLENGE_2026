# Plan de marquage — mesure d'audience

Outil : **Umami**, auto-hébergé sur le VPS, sans cookie (`deploy/README.md`, section 7). Code : un seul point d'envoi, `suivre()` dans [`app/src/lib/mesure.ts`](../../app/src/lib/mesure.ts).

## Règles

- **Rien sans accord** : aucun événement tant que le visiteur n'a pas accepté la mesure dans le bandeau (`consentement/consentement.ts`).
- **Jamais de donnée personnelle** : position, nom, texte libre, surface, stock, prix et quantité sont refusés par `suivre()`. Les propriétés sont des valeurs d'une liste fermée.
- **Un événement absent de ce plan n'est pas envoyé** : la liste `EVENEMENTS` de `mesure.ts` et ce tableau changent ensemble, par une Pull Request.
- **Appareils de l'équipe exclus** : ouvrir une fois le site avec `?equipe=1` (développement, répétitions, démos). `?equipe=0` annule.
- Les pages vues (`/`, `/methode`, `/donnees`…) sont comptées automatiquement par Umami. La scène tient sous `/` : ce sont les événements ci-dessous qui disent ce que font les visiteurs.

## Événements

| Événement | Déclencheur | Propriétés (valeurs possibles) | Question à laquelle il répond | Fichier |
|---|---|---|---|---|
| `porte_entree` | Entrée par une porte de la landing | `profil` : `agriculteur`, `organisation` | Qui utilise la plateforme ? | `landing/entrer.ts` |
| `ecran_ouvert` | Clic sur un écran du dock | `ecran` (12 identifiants), `profil` : `PRODUCTEUR`, `ORGANISATION` | Quels écrans servent, lesquels retirer ? | `pages/Scene.tsx` |
| `annee_choisie` | Changement d'année | `type` : `passee`, `ocean`, `tendance` | La prévision intéresse-t-elle ? | `pages/Scene.tsx` |
| `parcelle_localisee` | « Me localiser » ou choix dans la liste | `resultat` : `ok`, `refus`, `indisponible`, `liste` (jamais la position) | Le GPS marche-t-il sur le terrain ? | `scene/modes/Parcelle.tsx` |
| `voix_lue` | Lecture à voix haute | `langue` : `fr`, `wo` ; `resultat` : `ok`, `erreur`, `occupee` | Le wolof est-il utilisé et fiable ? | `scene/voix/lecture.ts` |
| `export_pdf` | Téléchargement d'un PDF | `type` : `dossier`, `fiche`, `autre` | Les ONG et l'État exportent-ils ? | `export/pdf.ts` |
| `scenario_choisi` | Changement de scénario de répartition | `scenario` : identifiant du scénario | Quels scénarios AgroDistrib servent ? | `scene/modes/Repartir.tsx` |
| `avis_envoye` | Avis envoyé | `type_organisation` (liste du formulaire), `etape` | Qui donne son avis, depuis quel écran ? | `scene/ong/AvisOng.tsx` |
| `avis_erreur` | Échec de l'envoi | `code` : statut HTTP (0 = réseau) | L'envoi des avis fonctionne-t-il ? | `scene/ong/AvisOng.tsx` |
| `carte_indisponible` | Pas de carte 3D (une fois par visite) | `raison` : `webgl_ou_erreur` | Quelle part des appareils n'a pas la carte ? | `pages/Scene.tsx` |
| `hors_ligne` | Bandeau réseau affiché | `cause` : `reseau`, `serveur` | Les coupures sont-elles fréquentes ? | `scene/interface/EtatReseau.tsx` |

Hors ligne, l'envoi d'un événement échoue lui-même : `hors_ligne` avec `cause: reseau` sous-compte les coupures réelles.

## Indicateurs à suivre chaque mois

| Indicateur | Calcul |
|---|---|
| Visiteurs et visites | Umami |
| Taux d'acceptation de la mesure | visiteurs mesurés ÷ visites estimées (journaux du serveur) : les chiffres d'Umami ne couvrent que ceux qui acceptent |
| Répartition des profils | `porte_entree` par `profil` |
| Écrans les plus ouverts | `ecran_ouvert` par `ecran` et par `profil` |
| Part de lecture en wolof | `voix_lue` `wo` ÷ `voix_lue` ; taux d'`erreur` et d'`occupee` |
| Exports et scénarios | `export_pdf`, `scenario_choisi` par mois |
| Appareils sans carte, coupures | `carte_indisponible`, `hors_ligne` ÷ visites |

Responsable de la lecture mensuelle : à désigner par l'équipe. Noter dans le tableau de bord les dates des démos et des ateliers, pour lire les pics.
