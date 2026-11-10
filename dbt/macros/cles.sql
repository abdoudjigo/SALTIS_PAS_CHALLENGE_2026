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