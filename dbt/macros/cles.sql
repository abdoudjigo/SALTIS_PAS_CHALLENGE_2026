{#
    Clés techniques partagées entre dimensions et faits.
    Toute table qui veut se joindre à une dimension doit utiliser
    la macro correspondante, jamais une expression écrite à la main.
#}

{# Département : code GADM tel quel (ex. SEN.10.1_1). Même expression que dim_geographie.id_departement #}
{% macro cle_departement(colonne) -%}
    md5(trim({{ colonne }}))
{%- endmacro %}

{# Zone agroécologique : libellé normalisé. Même expression que dim_zone_agroecologique.id_zone_agroecologique #}
{% macro cle_zone(colonne) -%}
    md5(upper(trim({{ colonne }})))
{%- endmacro %}

{# Culture : libellé normalisé. Même expression que dim_culture.id_culture #}
{% macro cle_culture(colonne) -%}
    md5(upper(trim({{ colonne }})))
{%- endmacro %}

{# Région administrative : libellé normalisé. Même expression que dim_region.id_region.
   Région et zone agroécologique sont deux regroupements parallèles des départements. #}
{% macro cle_region(colonne) -%}
    md5(upper(trim({{ colonne }})))
{%- endmacro %}

{# Variété : culture et variété normalisées. Même expression que dim_variete.id_variete :
   md5(concat(upper(trim(culture)), '|', upper(trim(variete)))). #}
{% macro cle_variete(culture, variete) -%}
    md5(concat(upper(trim({{ culture }})), '|', upper(trim({{ variete }}))))
{%- endmacro %}

{# Code GADM de la région déduit du code département : SEN.10.1_1 -> SEN.10_1.
   Règle GADM (GID_1 = pays.région + suffixe de version), à confirmer avec GID_1
   à réception du fichier GADM (test geo_departements_correspondance). #}
{% macro code_region_depuis_departement(colonne) -%}
    split_part(trim({{ colonne }}), '.', 1) || '.' || split_part(trim({{ colonne }}), '.', 2)
    || '_' || split_part(trim({{ colonne }}), '_', 2)
{%- endmacro %}
