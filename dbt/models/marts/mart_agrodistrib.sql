-- Module D : besoins consolidés par département (partiels, voir part_superficie_avec_dose_pct)
select * from {{ ref('stg_besoins') }}
