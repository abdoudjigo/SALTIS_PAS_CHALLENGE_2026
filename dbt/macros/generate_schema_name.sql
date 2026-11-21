{#
    Nom du schéma où dbt écrit un modèle.
    - Cible « ci » (CI GitHub) : toujours préfixé, CI_STAGING, CI_INTERMEDIATE, CI_MARTS. Le CI ne peut pas
      écrire dans les schémas de la production, quelle que soit la branche (audit, constat DATA-01).
    - Snowflake, autre cible : le nom configuré tel quel (STAGING, INTERMEDIATE, MARTS), lu par l'API.
    - Autre adaptateur (développement local) : <schéma de la cible>_<nom>.
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if target.name == 'ci' -%}
        {{ target.schema | trim }}_{{ (custom_schema_name or 'defaut') | trim }}
    {%- elif custom_schema_name is none -%}
        {{ target.schema }}
    {%- elif target.type == 'snowflake' -%}
        {{ custom_schema_name | trim }}
    {%- else -%}
        {{ target.schema }}_{{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
