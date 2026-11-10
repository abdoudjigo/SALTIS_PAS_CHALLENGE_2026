{{
    config(materialized='table')
}}

-- Calendrier journalier du 1980-01-01 au 2035-12-31 (20 454 jours).
-- Campagne agricole : de juin N à mai N+1, rattachée à l'année N
-- (l'hivernage juin-octobre porte l'année de la campagne).

with sequence_jours as (

    select
        row_number() over (order by seq4()) - 1 as decalage_jours
    from table(generator(rowcount => 20454))

),

calendrier as (

    select
        dateadd(day, decalage_jours, '1980-01-01'::date)::date as date_complete
    from sequence_jours

),

attributs as (

    select
        date_complete,
        year(date_complete) as annee,
        quarter(date_complete) as trimestre,
        month(date_complete) as mois,
        day(date_complete) as jour,
        dayofweekiso(date_complete) as jour_semaine,

        -- Décade du mois : 1 (1-10), 2 (11-20), 3 (21-fin du mois)
        least(ceil(day(date_complete) / 10.0), 3)::integer as decade_mois

    from calendrier

)

select
    to_number(to_char(date_complete, 'YYYYMMDD')) as id_temps,
    date_complete,

    annee,
    trimestre,
    mois,

    case mois
        when 1 then 'janvier'
        when 2 then 'fevrier'
        when 3 then 'mars'
        when 4 then 'avril'
        when 5 then 'mai'
        when 6 then 'juin'
        when 7 then 'juillet'
        when 8 then 'aout'
        when 9 then 'septembre'
        when 10 then 'octobre'
        when 11 then 'novembre'
        when 12 then 'decembre'
    end as nom_mois,

    jour,
    jour_semaine,

    decade_mois,

    -- Numéro de décade dans l'année : 1 à 36 (16 = 1-10 juin, 30 = 21-31 octobre)
    ((mois - 1) * 3 + decade_mois)::integer as numero_decade_annee,

    -- Libellé au même format que la colonne `periode` des données (ex. « 11-20 aout »)
    case decade_mois
        when 1 then '1-10 '
        when 2 then '11-20 '
        else '21-' || to_varchar(day(last_day(date_complete))) || ' '
    end
    || case mois
        when 1 then 'janvier'
        when 2 then 'fevrier'
        when 3 then 'mars'
        when 4 then 'avril'
        when 5 then 'mai'
        when 6 then 'juin'
        when 7 then 'juillet'
        when 8 then 'aout'
        when 9 then 'septembre'
        when 10 then 'octobre'
        when 11 then 'novembre'
        when 12 then 'decembre'
    end as libelle_decade,

    case
        when mois >= 6 then annee
        else annee - 1
    end as campagne_agricole,

    case
        when mois between 6 and 10 then 'HIVERNAGE'
        else 'HORS_HIVERNAGE'
    end as saison,

    mois between 6 and 10 as est_hivernage,

    -- Décades de la saison des pluies utilisées dans les données (16 à 30)
    ((mois - 1) * 3 + decade_mois) between 16 and 30 as est_decade_saison

from attributs