-- Module B : cultures adaptées par département
select * from {{ ref('stg_adequation') }}
where niveau_adequation is not null
