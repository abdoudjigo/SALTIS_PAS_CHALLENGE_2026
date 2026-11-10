-- Contrôles de cohérence des besoins de référence (historiques, pas prévisionnels).
-- Le test échoue s'il renvoie au moins une ligne.
--
-- Règle NULL / 0 :
--   - dose inconnue (statut A_COMPLETER) -> besoin NULL, jamais 0 ;
--   - dose connue -> besoin renseigné ; dose à 0 -> besoin à 0.

{% set besoins_engrais = [
    ('besoin_azote_n_t',        'N',            1000),
    ('besoin_phosphate_p2o5_t', 'P2O5',         1000),
    ('besoin_potasse_k2o_t',    'K2O',          1000),
    ('besoin_npk_15_15_15_t',   'NPK_15_15_15', 1000),
    ('besoin_uree_t',           'UREE',         1000),
    ('besoin_dap_t',            'DAP_18_46_0',  1000),
    ('besoin_fumier_t',         'FUMIER',       1),
] %}
{% set besoin_semences = ('besoin_semences_t', 'SEMENCES', 1000) %}

with fait as (

    select f.*, g.zone_agroecologique, c.culture
    from {{ ref('fact_besoin_reference') }} f
    join {{ ref('dim_geographie') }} g on g.id_departement = f.id_departement
    join {{ ref('dim_culture') }} c on c.id_culture = f.id_culture

),

-- Doses de référence de la zone du département (sources actuelles uniquement)
doses as (

    select g.id_departement, r.id_culture, r.code_intrant, r.dose
    from {{ ref('fact_reference_agronomique') }} r
    join {{ ref('dim_geographie') }} g
        on g.id_zone_agroecologique = r.id_zone_agroecologique
    where r.source_reference not ilike 'ISRA%'

)

-- Grain
select max(id_besoin_reference) as id, 'grain dupliqué' as anomalie
from fait
group by id_departement, id_culture
having count(*) > 1

union all

-- Jamais de superficie négative
select id_besoin_reference, 'superficie négative'
from fait
where superficie_reference_ha < 0

{% for colonne, code, diviseur in besoins_engrais + [besoin_semences] %}
{% set statut = 'statut_validation_semis' if code == 'SEMENCES' else 'statut_validation_engrais' %}

union all

-- {{ colonne }} : NULL si et seulement si la dose est inconnue (jamais 0 à la place)
select id_besoin_reference, '{{ colonne }} : NULL incohérent avec {{ statut }}'
from fait
where ({{ colonne }} is null) <> ({{ statut }} = 'A_COMPLETER')

union all

-- {{ colonne }} : jamais négatif
select id_besoin_reference, '{{ colonne }} négatif'
from fait
where {{ colonne }} < 0

union all

-- {{ colonne }} = superficie x dose de référence de la zone (dose à 0 -> besoin à 0)
select f.id_besoin_reference, '{{ colonne }} différent de superficie x dose {{ code }}'
from fait f
join doses d
    on d.id_departement = f.id_departement
   and d.id_culture = f.id_culture
   and d.code_intrant = '{{ code }}'
where f.{{ colonne }} is null
   or abs(f.{{ colonne }} - f.superficie_reference_ha * d.dose / {{ diviseur }}) > 0.05
   or (d.dose = 0 and f.{{ colonne }} <> 0)
{% endfor %}

union all

-- besoin_semences_applicable : faux exactement pour « Riz (irrigué) » en Casamance
select id_besoin_reference, 'besoin_semences_applicable incohérent'
from fait
where besoin_semences_applicable
   <> (not (culture = 'RIZ (IRRIGUÉ)' and zone_agroecologique = 'CASAMANCE'))
