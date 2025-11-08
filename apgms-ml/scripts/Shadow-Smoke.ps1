Param(
    [string]$Python = "python"
)

$evaluators = @(
    "gstfree",
    "bas_conf",
    "paygw_var",
    "dups",
    "apportion"
)

$packageRoot = Join-Path $PSScriptRoot '..'

foreach ($model in $evaluators) {
    Write-Host "Evaluating $model"
    $modelRoot = Join-Path $packageRoot $model
    $scriptPath = Join-Path $modelRoot 'eval.py'
    & $Python $scriptPath
    if ($LASTEXITCODE -ne 0) {
        throw "Evaluation failed for $model"
    }
}
