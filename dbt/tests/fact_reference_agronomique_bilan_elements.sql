-- Bilan des éléments fertilisants : pour chaque zone x culture x source qui porte
-- des doses d'éléments, N = somme des doses de produits x teneur N (dim_intrant),
-- idem P2O5 et K2O, à 0,1 kg/ha près.
-- Les produits sans teneur (fumier, semences) n'entrent pas dans le bilan.
-- Le test échoue s'il renvoie au moins une ligne.

with fait as (

    select
        f.id_zone_agroecologique,
        f.id_culture,
        f.source_reference,
        f.code_intrant,
        f.type_intrant,
        f.dose,
        i.teneur_n_pct,
        i.teneur_p2o5_pct,
        i.teneur_k2o_pct
    from {{ ref('fact_reference_agronomique') }} f
    join {{ ref('dim_intrant') }} i
        on i.code_intrant = f.code_intrant
    where f.type_intrant in ('PRODUIT', 'ELEMENT')

),

bilan as (

    select
        coalesce(id_zone_agroecologique, 'NATIONAL') as zone,
        id_culture,
        source_reference,

        max(iff(code_intrant = 'N', dose, null)) as n_declare,
        max(iff(code_intrant = 'P2O5', dose, null)) as p2o5_declare,
        max(iff(code_intrant = 'K2O', dose, null)) as k2o_declare,

        sum(iff(type_intrant = 'PRODUIT', dose * teneur_n_pct / 100, null)) as n_calcule,
        sum(iff(type_intrant = 'PRODUIT', dose * teneur_p2o5_pct / 100, null)) as p2o5_calcule,
        sum(iff(type_intrant = 'PRODUIT', dose * teneur_k2o_pct / 100, null)) as k2o_calcule

    from fait
    group by 1, 2, 3

)

select *
from bilan
where (n_declare is not null and abs(n_declare - coalesce(n_calcule, 0)) > 0.1)
   or (p2o5_declare is not null and abs(p2o5_declare - coalesce(p2o5_calcule, 0)) > 0.1)
   or (k2o_declare is not null and abs(k2o_declare - coalesce(k2o_calcule, 0)) > 0.1)
