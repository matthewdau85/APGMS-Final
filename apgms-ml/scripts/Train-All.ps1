Param(
    [string]$Python = "python"
)

$models = @(
    "gstfree",
    "bas_conf",
    "paygw_var",
    "dups",
    "apportion"
)

$packageRoot = Join-Path $PSScriptRoot '..'

foreach ($model in $models) {
    Write-Host "Training $model"
    $modelRoot = Join-Path $packageRoot $model
    $scriptPath = Join-Path $modelRoot 'train.py'
    & $Python $scriptPath
}
