-- Contrôles de cohérence des besoins de référence (historiques, pas prévisionnels).
-- Le test échoue s'il renvoie au moins une ligne.
--
-- Règle NULL / 0 (19/11/2026) :
--   - éléments et semences : aucune dose retenue -> besoin NULL ; sinon superficie x dose / diviseur ;
--   - produits engrais (NPK x 3, urée, DAP) : sans formule retenue -> NULL ; formule retenue et produit
--     absent -> 0 ; sinon superficie x dose / 1000 ;
--   - fumier : besoin_fumier_t toujours NULL ;
--   - statut A_COMPLETER si et seulement si aucune source n'est retenue pour le groupe.

{% set besoins_engrais = [
    ('besoin_azote_n_t',        'N',            1000),
    ('besoin_phosphate_p2o5_t', 'P2O5',         1000),
    ('besoin_potasse_k2o_t',    'K2O',          1000),
    ('besoin_npk_15_15_15_t',   'NPK_15_15_15', 1000),
    ('besoin_npk_15_10_10_t',   'NPK_15_10_10', 1000),
    ('besoin_npk_6_20_10_t',    'NPK_6_20_10',  1000),
    ('besoin_uree_t',           'UREE',         1000),
    ('besoin_dap_t',            'DAP_18_46_0',  1000),
] %}
{% set produits_formule = ['NPK_15_15_15', 'NPK_15_10_10', 'NPK_6_20_10', 'UREE', 'DAP_18_46_0'] %}
{% set besoin_semences = ('besoin_semences_t', 'SEMENCES', 1000) %}

with fait as (

    select f.*, g.zone_agroecologique, c.culture
    from {{ ref('fact_besoin_reference') }} f
    join {{ ref('dim_geographie') }} g on g.id_departement = f.id_departement
    join {{ ref('dim_culture') }} c on c.id_culture = f.id_culture

),

-- Doses retenues de la zone du département
doses as (

    select upper(trim(zone_application)) as zone_cle, upper(trim(culture)) as culture_cle,
           code_intrant, groupe_dose, dose, source_reference
    from {{ ref('int_reference_dose') }}
    where est_retenue

),

fait_doses as (

    select f.*, d.code_intrant, d.groupe_dose, d.dose, d.source_reference as source_dose
    from fait f
    left join doses d
        on d.zone_cle = upper(trim(f.zone_agroecologique))
       and d.culture_cle = upper(trim(f.culture))

)

-- Grain
select max(id_besoin_reference) as id, 'grain dupliqué' as anomalie
from fait
group by id_departement, id_culture
having count(*) > 1

union all

select id_besoin_reference, 'superficie négative'
from fait
where superficie_reference_ha < 0

union all

-- Statut A_COMPLETER si et seulement si aucune source retenue
select id_besoin_reference, 'statut engrais incohérent avec la source retenue'
from fait
where (statut_validation_engrais = 'A_COMPLETER') <> (source_reference_engrais is null)

union all

select id_besoin_reference, 'statut semis incohérent avec la source retenue'
from fait
where (statut_validation_semis = 'A_COMPLETER') <> (source_reference_semis is null)

union all

-- Source affichée = source retenue (engrais et semences)
select f.id_besoin_reference, 'source affichée différente de la source retenue'
from fait_doses f
where (f.groupe_dose = 'ENGRAIS' and f.source_dose <> f.source_reference_engrais)
   or (f.groupe_dose = 'SEMENCES' and f.source_dose <> f.source_reference_semis)

{% for colonne, code, diviseur in besoins_engrais + [besoin_semences] %}

union all

-- {{ colonne }} : NULL si et seulement si aucune dose {{ code }} retenue
select f.id_besoin_reference, '{{ colonne }} : NULL incohérent avec la dose retenue'
from fait f
left join doses d
    on d.zone_cle = upper(trim(f.zone_agroecologique))
   and d.culture_cle = upper(trim(f.culture))
   and d.code_intrant = '{{ code }}'
{% if code in produits_formule %}
where (f.{{ colonne }} is null) <> (f.source_reference_engrais is null)
   or (f.source_reference_engrais is not null and d.dose is null
       and f.superficie_reference_ha is not null and f.{{ colonne }} <> 0)
{% else %}
where (f.{{ colonne }} is null) <> (d.dose is null)
{% endif %}

union all

select id_besoin_reference, '{{ colonne }} négatif'
from fait
where {{ colonne }} < 0

union all

-- {{ colonne }} = superficie x dose retenue (dose à 0 -> besoin à 0)
select f.id_besoin_reference, '{{ colonne }} différent de superficie x dose {{ code }}'
from fait_doses f
where f.code_intrant = '{{ code }}'
  and (f.{{ colonne }} is null
       or abs(f.{{ colonne }} - f.superficie_reference_ha * f.dose / {{ diviseur }}) > 0.001)
{% endfor %}

union all

-- Semences non applicables seulement pour le repiquage irrigué extrapolé (riz pluvial)
select id_besoin_reference, 'besoin_semences_applicable incohérent'
from fait
where besoin_semences_applicable
   <> (coalesce(source_reference_semis, '') <> {{ source_semis_faye_extrapole() }})

union all

-- Fumier : jamais chiffré dans les besoins
select id_besoin_reference, 'besoin_fumier_t renseigné'
from fait
where besoin_fumier_t is not null

union all

select id_besoin_reference, 'a_formule_engrais_retenue incohérent'
from fait
where a_formule_engrais_retenue <> (source_reference_engrais is not null)
