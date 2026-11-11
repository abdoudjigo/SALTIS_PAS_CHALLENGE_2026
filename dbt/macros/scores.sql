{#
    Rang centile 0-100 d'une colonne parmi les lignes du modèle (ex. les 45 départements).
    Ex aequo : rang moyen. NULL conservé (jamais remplacé par 0), et exclu du calcul.
    inverse=true : 100 = plus petite valeur (ex. moins de pluie = plus vulnérable).
    Utilisé par mart_vulnerabilite_departement (méthode v1).
#}
{% macro rang_centile(colonne, inverse=false) -%}
    iff({{ colonne }} is null, null,
        {% if inverse %}100 - {% endif %}100 * (
            rank() over (order by {{ colonne }}) - 1
            + (count(*) over (partition by {{ colonne }}) - 1) / 2
        ) / nullif(count({{ colonne }}) over () - 1, 0)
    )
{%- endmacro %}
