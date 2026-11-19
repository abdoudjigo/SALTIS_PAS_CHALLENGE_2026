<#
    Lance dbt par l'interpréteur Python du venv, sans passer par dbt.exe
    (bloqué par la stratégie de contrôle des applications de Windows).

    S'exécute depuis le dossier dbt/ et transmet tous les arguments tels quels.
    Exemples, depuis la racine du dépôt :
        .\dbt.ps1 debug --profiles-dir . --target snowflake
        .\dbt.ps1 build --profiles-dir . --target snowflake --select fact_saison_departement
#>

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    Write-Error "Interpréteur introuvable : $python. Créer le venv à la racine (python -m venv .venv)."
    exit 1
}

Push-Location (Join-Path $PSScriptRoot 'dbt')
try {
    & $python -c "from dbt.cli.main import cli; cli()" @args
    $code = $LASTEXITCODE
}
finally {
    Pop-Location
}
exit $code
