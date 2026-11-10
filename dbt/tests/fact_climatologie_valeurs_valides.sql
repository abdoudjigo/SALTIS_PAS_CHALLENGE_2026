-- Contrôles de cohérence de la climatologie décadaire.
-- Le test échoue s'il renvoie au moins une ligne.

with fait as (

    select *
    from {{ ref('fact_climatologie_decadaire') }}

),

-- Part cumulée : ne doit jamais diminuer d'une décade à la suivante dans la saison
cumulee as (

    select
        id_climatologie,
        part_cumulee_saison_pct,
        lag(part_cumulee_saison_pct) over (
            partition by niveau_geographique, coalesce(id_departement, id_zone_agroecologique)
            order by numero_decade_annee
        ) as part_cumulee_precedente
    from fait
    where est_decade_saison

)

-- Grain : une ligne par niveau, territoire et décade
select max(id_climatologie) as id_climatologie, 'grain dupliqué' as anomalie
from fait
group by niveau_geographique, coalesce(id_departement, id_zone_agroecologique), numero_decade_annee
having count(*) > 1

union all

-- Exactement une clé géographique, cohérente avec le niveau
select id_climatologie, 'clé géographique incohérente avec le niveau'
from fait
where not (
        (niveau_geographique = 'DEPARTEMENT' and id_departement is not null and id_zone_agroecologique is null)
     or (niveau_geographique = 'ZONE' and id_zone_agroecologique is not null and id_departement is null)
)

union all

select id_climatologie, 'probabilité hors de [0, 100]'
from fait
where proba_decade_seche_pct not between 0 and 100
   or proba_decade_tres_pluvieuse_pct not between 0 and 100
   or proba_sequence_seche_7j_pct not between 0 and 100

union all

-- Quantile bas <= médiane <= quantile haut
select id_climatologie, 'quantiles non ordonnés'
from fait
where pluie_1_annee_sur_5_mm > pluie_mediane_mm
   or pluie_mediane_mm > pluie_4_annees_sur_5_mm

union all

select id_climatologie, 'part cumulée décroissante dans la saison'
from cumulee
where part_cumulee_saison_pct < part_cumulee_precedente - 0.001
