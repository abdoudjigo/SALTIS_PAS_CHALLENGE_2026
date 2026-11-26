# Rapport Observatoire, lot 3 (export PDF)

## Fait
- Export PDF A4 côté navigateur : `app/src/observatoire/exportPdf.ts` (jsPDF chargé à la demande). Il réutilise `app/src/export/` (`creerDocument`, `Redacteur`, `terminer`, `texte.ts`) sans le recopier.
- Bouton `data-emplacement="export-observatoire"` activé dans `app/src/observatoire/Observatoire.tsx`. Il est désactivé tant que les données ne sont pas prêtes.
- Page 1 : titre, filtres, encadré « Couverture des données », chiffres clés, jauges d'objectifs (ou « Pas d'objectif chiffré… »), courbe.
- Page 2 : carte avec légende (« Pas de donnée »), 10 premiers du classement, « Ce qu'il faut retenir », sources avec contradictions et erreurs probables.
- Pied « Assaman & Suuf · équipe AKAI · exporté le … » et numéros de page. Nom du fichier : `Observatoire_{culture}_{zone}_{annee}.pdf`.
- Valeur absente : « non disponible », jamais 0. Aucune prévision exportée.

## Vérifications : NON exécutées
L'agent n'avait pas d'outil Bash (lecture et écriture de fichiers seulement). Restent à faire :
- `cd app && npx tsc -b && npx eslint src --max-warnings 0 && npm run build`, puis `rm tsconfig.tsbuildinfo`
- `npx vitest run`
- `venv/bin/python -m pytest api/tests -q`
- les 4 captures (1440x900 et 390x844, national et Kaffrine, mil 2021) dans `docs/recette/observatoire/`
- un PDF mil, national, 2021, à contrôler avec `pdftotext` : 2 pages, accents, pas de 0 pour une absence, encadré couverture présent
- 0 erreur console

Risque connu : la page 2 peut déborder sur une 3e page si les sources et contradictions sont longues. À contrôler sur le PDF de test. Les tailles de police sont déjà réduites.

## Choix prudents
- Courbe et carte : le SVG est converti en PNG (styles calculés recopiés dans le clone). Si la conversion échoue, le PDF écrit « non disponible » à la place de l'image.
- Légende de la carte : classes relatives (basses, intermédiaires, hautes), parce que les seuils de classes sont calculés dans `Carte.tsx` et ne sont pas exposés.
- Jauges limitées à 4 dans le PDF, avec une mention du reste.
- Sésame : pas de totaux pays ni région ; le PDF écrit le message de la page.
- Riz national : série arrêtée en 2020.
- FAOSTAT : 2022-2024 seulement, série distincte, jamais additionnée aux départements.
- Rufisque et Diourbel : 0 t renvoyé par la source. C'est une valeur de la source, affichée telle quelle et non une absence.
- Test pytest instable vu une fois, à surveiller.

## Données à demander au ministère (DA / DAPSA)
- Productions et surfaces 2022-2025 par département.
- Riz 2021 complet.
- Oignon et fonio.
- Sésame après 2016.
- Série officielle des taux de couverture des besoins.
- Convention d'année de campagne.
- Valeurs 2023 définitives.
