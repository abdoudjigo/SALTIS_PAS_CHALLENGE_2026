{#
    Correspondance validée (A4) entre le texte libre des statuts de dose du dataset
    et statut_validation : VALIDEE / A_CONFIRMER / NON_VERIFIEE / A_COMPLETER.
    Partagée par fact_reference_agronomique et fact_besoin_reference : ne jamais
    la recopier à la main dans un modèle.

    VALIDEE est réservé aux doses validées par un spécialiste (ISRA, ANCAR) :
    aucun texte actuel n'y correspond. Un texte non prévu renvoie null, ce qui fait
    échouer les tests not_null et signale une nouvelle variante à classer.
#}

{# Zone d'origine de la référence Faye et al. (2020) : casier de Matam #}
{% macro zone_reference_faye() -%}
    'VALLÉE DU FLEUVE SÉNÉGAL'
{%- endmacro %}

{# Engrais (produits et éléments) #}
{% macro statut_validation_engrais(statut_dose) -%}
    case
        when {{ statut_dose }} ilike 'recommandation de la recherche%'  then 'A_CONFIRMER'
        when {{ statut_dose }} ilike 'pratique vulgarisée%'             then 'A_CONFIRMER'
        when {{ statut_dose }} ilike 'dose établie en Basse Casamance%' then 'NON_VERIFIEE'
        when {{ statut_dose }} ilike 'formule N120 P60 K60%'            then 'NON_VERIFIEE'
        when {{ statut_dose }} ilike 'à compléter%'                     then 'A_COMPLETER'
    end
{%- endmacro %}

{% macro source_reference_engrais(statut_dose, origine_dose) -%}
    case
        when {{ statut_dose }} ilike 'dose établie en Basse Casamance%' then 'Tounkara et al. (2022), extrapolé'
        when {{ origine_dose }} ilike 'Tounkara%'                       then 'Tounkara et al. (2022)'
        when {{ origine_dose }} ilike 'Faye%'                           then 'Faye et al. (2020)'
        when {{ origine_dose }} ilike 'résumé de recherche web%'        then 'Recherche web ISRA Saint-Louis (non vérifiée)'
    end
{%- endmacro %}

{# Semis : la dose Faye et al. (2020) est confirmée seulement dans sa zone d'origine #}
{% macro statut_validation_semis(statut_dose_semis, zone_agroecologique) -%}
    case
        when {{ statut_dose_semis }} ilike 'repiquage%'
         and upper(trim({{ zone_agroecologique }})) = {{ zone_reference_faye() }} then 'A_CONFIRMER'
        when {{ statut_dose_semis }} ilike 'repiquage%'                         then 'NON_VERIFIEE'
        when {{ statut_dose_semis }} ilike 'à compléter%'
          or {{ statut_dose_semis }} ilike 'densité documentée%'                then 'A_COMPLETER'
    end
{%- endmacro %}

{% macro source_reference_semis(origine_dose_semis, zone_agroecologique) -%}
    case
        when {{ origine_dose_semis }} ilike 'Faye%'
         and upper(trim({{ zone_agroecologique }})) = {{ zone_reference_faye() }} then 'Faye et al. (2020)'
        when {{ origine_dose_semis }} ilike 'Faye%'                             then 'Faye et al. (2020), extrapolé'
    end
{%- endmacro %}
