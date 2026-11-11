-- Contrôle de la méthode 'FAO décadaire v1' (int_couverture_eau_cycle) sur le cycle moyen,
-- seul cycle où la source calcule proba_besoin_eau_couvert_pct.
-- Échec si l'écart absolu moyen dépasse 7 points ou si la corrélation est < 0,95,
-- ou si moins de 300 couples département x culture sont comparables.
-- Valeurs au 11/11/2026 : 352 couples, écart moyen 4,95 points, corrélation 0,984.
-- Hors comparaison : manioc (la source met 0, non évalué chez nous), Guédiawaye (pas de
-- données décadaires), cultures irriguées (NULL des deux côtés).

with paires as (

    select
        i.proba_besoin_eau_couvert_calc_pct as calc,
        f.proba_besoin_eau_couvert_pct as source
    from {{ ref('int_couverture_eau_cycle') }} i
    join {{ ref('fact_adequation_culture') }} f
        on f.id_departement = i.id_departement
       and f.id_culture = i.id_culture
       and f.classe_cycle = i.classe_cycle
    where i.classe_cycle = 'moyenne'
      and i.proba_besoin_eau_couvert_calc_pct is not null
      and f.proba_besoin_eau_couvert_pct is not null

),

bilan as (

    select
        count(*) as nb_paires,
        avg(abs(calc - source)) as ecart_moyen,
        corr(calc, source) as correlation
    from paires

)

select *
from bilan
where nb_paires < 300
   or ecart_moyen > 7
   or correlation < 0.95
   or correlation is null
