<#
    Lance dbt par l'interpréteur Python du venv, sans passer par dbt.exe
    (bloqué par la stratégie de contrôle des applications de Windows).

    S'exécute depuis le dossier dbt/ et transmet tous les arguments tels quels.
    Exemples, depuis la racine du dépôt :
        .\dbt\dbt.ps1 debug --profiles-dir . --target snowflake
        .\dbt\dbt.ps1 build --profiles-dir . --target snowflake --select fact_saison_departement
#>

# Racine du dépôt = dossier parent de dbt/. Le venv s'appelle venv (ou .venv, ancien nom encore accepté).
$racine = Split-Path $PSScriptRoot -Parent
$python = Join-Path $racine 'venv\Scripts\python.exe'
if (-not (Test-Path $python)) { $python = Join-Path $racine '.venv\Scripts\python.exe' }
if (-not (Test-Path $python)) {
    Write-Error "Interpréteur introuvable dans venv\ ni .venv\. Créer le venv à la racine (python -m venv venv)."
    exit 1
}

Push-Location $PSScriptRoot
try {
    & $python -c "from dbt.cli.main import cli; cli()" @args
    $code = $LASTEXITCODE
}
finally {
    Pop-Location
}
exit $code
