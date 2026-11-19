{{
    config(materialized='table')
}}

-- Prix des intrants, exposés tels quels (seed ref_prix_intrants).
-- Grain : code_intrant x campagne (une ligne par produit et par campagne).
--   - prix_cession_sac_50kg_fcfa : prix payé par le producteur (subventionné) ;
--   - subvention_tonne_fcfa      : subvention de l'État par tonne ;
--   - cout_reel_sac_50kg_fcfa    : prix de cession + subvention / 20 sacs par tonne (testé).
-- Sources : APS (30 sept. 2025), circulaire du ministère de l'Agriculture du 30 avril 2026.
-- Urée et DAP : prix non trouvés, statut A_SAISIR, valeurs NULL (jamais 0, aucun prix inventé).

select
    upper(trim(code_intrant)) as code_intrant,
    campagne,
    prix_cession_sac_50kg_fcfa,
    subvention_tonne_fcfa,
    cout_reel_sac_50kg_fcfa,
    upper(trim(statut_validation)) as statut_validation,
    trim(source) as source

from {{ ref('ref_prix_intrants') }}

where code_intrant is not null
